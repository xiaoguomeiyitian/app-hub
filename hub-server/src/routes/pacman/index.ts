import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room, GameMessage } from '../../types/game.js';
import { JoinData } from '../../types/messages.js';

interface PacmanPlayer extends Player {
  x: number;
  y: number;
  alive: boolean;
  score: number;
  side: number;
}

interface PacmanRoom extends Room {
  w: number;
  h: number;
  board: number[][];
  dots: number;
}

export const description = '吃豆人 - 多人竞速吃豆';
export const router = Router();

const clients = new Map<string, WebSocket>();
const rooms = new Map<string, Room>();
const matchQueue: Player[] = [];

function send(ws: WebSocket, t: string, d?: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: t, data: d }));
  }
}

function broadcast(room: Room, t: string, d?: unknown): void {
  for (const p of room.players) {
    if (!p.isBot && p.ws?.readyState === WebSocket.OPEN) {
      send(p.ws, t, d);
    }
  }
}

function genMap(w: number, h: number): number[][] {
  const m: number[][] = [];
  for (let y = 0; y < h; y++) {
    m[y] = [];
    for (let x = 0; x < w; x++) {
      m[y][x] = (x === 0 || y === 0 || x === w - 1 || y === h - 1 || (x % 2 === 0 && y % 2 === 0)) ? 1 : 0;
    }
  }
  // Clear spawn points
  m[1][1] = m[1][2] = m[2][1] = 0;
  m[1][w - 2] = m[1][w - 3] = m[2][w - 2] = 0;
  m[h - 2][1] = m[h - 2][2] = m[h - 3][1] = 0;
  m[h - 2][w - 2] = m[h - 2][w - 3] = m[h - 3][w - 2] = 0;
  return m;
}

function handleMessage(msg: GameMessage, sid: string, ws: WebSocket): void {
  if (msg.type === 'match:join' || msg.type === 'room:create') {
    const player: Player = {
      id: sid,
      ws,
      nick: ((msg.data as JoinData)?.nick) || '匿名',
      isBot: false,
      score: 0,
    };
    matchQueue.push(player);
    send(ws, 'match:queued', { position: matchQueue.length });
    setTimeout(() => {
      const idx = matchQueue.findIndex((q) => q.id === sid);
      if (idx < 0) return;
      while (matchQueue.length < 2) {
        matchQueue.push({
          id: 'bot-' + nanoid(4),
          ws: null,
          isBot: true,
          nick: 'AI',
          score: 0,
        });
      }
      const m = matchQueue.splice(0, 2);
      const id = nanoid(8);
      const w = 21, h = 15;
      const room: Room = {
        id,
        players: m.map((x, i) => ({ ...x, x: 1, y: 1, score: 0, alive: true, side: i })),
        board: genMap(w, h),
        phase: 'playing',
        timeLeft: 120,
        seed: nanoid(8),
        w,
        h,
        dots: Math.floor(w * h * 0.3),
      };
      rooms.set(id, room);
      m.filter((x) => !x.isBot).forEach((x) => {
        if (x.ws) send(x.ws, 'match:found', { roomId: id, position: m.indexOf(x), seed: room.seed });
      });
      broadcast(room, 'game:start', {
        map: room.board,
        players: room.players.map((p) => ({
          id: p.id,
          nick: p.nick,
          side: (p as PacmanPlayer).side,
        })),
        w,
        h,
      });
    }, 8000);
  }

  if (msg.type === 'game:move') {
    for (const [, room] of rooms) {
      const p = room.players.find((player) => player.id === sid);
      if (p && p.alive) {
        const { dx, dy } = msg.data as { dx?: number; dy?: number };
        const nx = (p as PacmanPlayer).x + (dx || 0);
        const ny = (p as PacmanPlayer).y + (dy || 0);
        if (nx >= 0 && nx < (room as PacmanRoom).w && ny >= 0 && ny < (room as PacmanRoom).h && (room.board as number[][])[ny][nx] !== 1) {
          (p as PacmanPlayer).x = nx;
          (p as PacmanPlayer).y = ny;
          if ((room.board as number[][])[ny][nx] === 0) {
            (room.board as number[][])[ny][nx] = -1;
            (p as PacmanPlayer)!.score += 10;
            (room as PacmanRoom).dots--;
            broadcast(room, 'game:move', {
              id: sid,
              x: nx,
              y: ny,
              score: (p as PacmanPlayer)!.score,
            });
            if ((room as PacmanRoom).dots <= 0) {
              (room as PacmanRoom).phase = 'finished';
              broadcast(room, 'game:over', {
                winner: sid,
                scores: room.players.map((pl) => ({
                  nick: pl.nick,
                  score: (pl as PacmanPlayer).score,
                })),
              });
            }
          }
        }
        break;
      }
    }
  }
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'pacman' }));

export function socketSetup(httpServer: HttpServer, wsPath: string): void {
  const tp = wsPath.replace(/\/$/, '') + '/websocket';
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, s, head) => {
    const u = (req.url || '').split('?')[0];
    if (u !== tp) return;
    wss.handleUpgrade(req, s, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    const sid = nanoid(12);
    clients.set(sid, ws);
    send(ws, 'connected', { socketId: sid });
    ws.on('message', (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') return send(ws, 'pong');
        handleMessage(msg, sid, ws);
      } catch (err) {
        console.error('[pacman] 消息处理错误:', err);
      }
    });
    ws.on('close', () => {
      clients.delete(sid);
      const i = matchQueue.findIndex((q) => q.id === sid);
      if (i >= 0) matchQueue.splice(i, 1);
    });
    ws.on('error', () => clients.delete(sid));
  });
  log(LogLevel.INFO, `🔌 WebSocket 已注册: ${tp}`);
}
