import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';

export const description = '扫雷 - 多人竞技扫雷';
export const router = Router();

const clients = new Map<string, WebSocket>();

interface MineGame {
  id: string;
  players: { id: string; ws: WebSocket; nick: string; revealed: Set<string>; lost: boolean }[];
  mines: Set<string>;
  width: number;
  height: number;
  mineCount: number;
  started: boolean;
  seed: string;
}

const games = new Map<string, MineGame>();

function generateMines(width: number, height: number, count: number, seed: string): Set<string> {
  const mines = new Set<string>();
  let hash = 0;
  for (const c of seed) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  while (mines.size < count) {
    const x = Math.abs((hash * (mines.size + 1)) % width);
    const y = Math.abs(((hash * 7 + mines.size * 13)) % height);
    mines.add(`${x},${y}`);
    hash = (hash * 1103515245 + 12345) | 0;
  }
  return mines;
}

function countAdjacentMines(x: number, y: number, mines: Set<string>, w: number, h: number): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < w && ny >= 0 && ny < h && mines.has(`${nx},${ny}`)) count++;
  }
  return count;
}

function send(ws: WebSocket, type: string, data?: unknown) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, data })); }
function broadcast(game: MineGame, type: string, data?: unknown) { for (const p of game.players) if (p.ws?.readyState === WebSocket.OPEN) send(p.ws, type, data); }

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'minesweeper', games: games.size }));

export function socketSetup(httpServer: HttpServer, wsPath: string): void {
  const targetPath = wsPath.replace(/\/$/, '') + '/websocket';
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => { const url = (req.url || '').split('?')[0]; if (url !== targetPath) return; wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req)); });

  wss.on('connection', (ws: WebSocket) => {
    const sid = nanoid(12);
    clients.set(sid, ws);
    send(ws, 'connected', { socketId: sid });

    ws.on('message', (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') return send(ws, 'pong');

        if (msg.type === 'room:create') {
          const w = msg.data?.width || 16, h = msg.data?.height || 16, mc = msg.data?.mines || 40;
          const gameId = nanoid(8);
          const seed = nanoid(16);
          const game: MineGame = { id: gameId, players: [{ id: sid, ws, nick: msg.data?.nick || '匿名', revealed: new Set(), lost: false }], mines: generateMines(w, h, mc, seed), width: w, height: h, mineCount: mc, started: false, seed };
          games.set(gameId, game);
          send(ws, 'room:created', { gameId });
        }

        if (msg.type === 'room:join') {
          const game = games.get(msg.data?.gameId);
          if (!game) return send(ws, 'error', { message: '房间不存在' });
          if (game.players.length >= 4) return send(ws, 'error', { message: '房间已满' });
          game.players.push({ id: sid, ws, nick: msg.data?.nick || '匿名', revealed: new Set(), lost: false });
          broadcast(game, 'room:joined', { total: game.players.length });
          if (game.players.length >= 2 && !game.started) {
            game.started = true;
            broadcast(game, 'game:start', { width: game.width, height: game.height, mineCount: game.mineCount, seed: game.seed });
          }
        }

        if (msg.type === 'game:reveal') {
          for (const [, game] of games) {
            const player = game.players.find(p => p.id === sid);
            if (!player || player.lost) continue;
            const { x, y } = msg.data;
            const key = `${x},${y}`;
            if (player.revealed.has(key)) continue;
            player.revealed.add(key);
            if (game.mines.has(key)) {
              player.lost = true;
              broadcast(game, 'game:mine', { position: game.players.indexOf(player), x, y });
              const alive = game.players.filter(p => !p.lost);
              if (alive.length <= 1) {
                broadcast(game, 'game:over', { winner: alive.length === 1 ? game.players.indexOf(alive[0]) : -1, scores: game.players.map(p => ({ nick: p.nick, revealed: p.revealed.size })) });
              }
            } else {
              const adjacent = countAdjacentMines(x, y, game.mines, game.width, game.height);
              broadcast(game, 'game:reveal', { position: game.players.indexOf(player), x, y, adjacent, revealed: player.revealed.size });
            }
            break;
          }
        }
      } catch (err) {
        console.error('[minesweeper] 消息处理错误:', err);
      }
    });
    ws.on('close', () => clients.delete(sid));
    ws.on('error', () => clients.delete(sid));
  });
  log(LogLevel.INFO, `🔌 WebSocket 已注册: ${targetPath}`);
}
