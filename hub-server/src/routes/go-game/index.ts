import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room, GameMessage } from '../../types/game.js';
import { JoinData } from '../../types/messages.js';

export const description = '围棋 - 经典黑白棋对弈';

export const router = Router();

interface GoGamePlayer extends Player {
  captures: number;
  side: number;
}

const S = 19;
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

function initBoard(): number[][] {
  return Array.from({ length: S }, () => Array(S).fill(0));
}

interface Group {
  stones: [number, number][];
  liberties: Set<string>;
}

function getGroup(b: number[][], r: number, c: number): Group {
  const color = b[r][c];
  if (color === 0) return { stones: [], liberties: new Set() };
  const visited = new Set<string>();
  const stones: [number, number][] = [];
  const liberties = new Set<string>();
  const stack: [number, number][] = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    const key = `${cr},${cc}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (b[cr][cc] === color) stones.push([cr, cc]);
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nr = cr + dr, nc = cc + dc;
      if (nr >= 0 && nr < S && nc >= 0 && nc < S) {
        if (b[nr][nc] === 0) liberties.add(`${nr},${nc}`);
        else if (b[nr][nc] === color && !visited.has(`${nr},${nc}`)) stack.push([nr, nc]);
      }
    }
  }
  return { stones, liberties };
}

function handleMessage(msg: GameMessage, sid: string, ws: WebSocket): void {
  if (msg.type === 'match:join') {
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
      const room: Room = {
        id,
        players: m.map((x) => ({ ...x, captures: 0 })),
        board: initBoard(),
        current: 1,
        phase: 'playing',
        history: [],
      };
      rooms.set(id, room);
      m.filter((x) => !x.isBot).forEach((x) => {
        if (x.ws) send(x.ws, 'match:found', { roomId: id, position: m.indexOf(x) });
      });
      broadcast(room, 'game:start', { boardSize: S, currentPlayer: 1 });
    }, 8000);
  }

  if (msg.type === 'room:create') {
    const room: Room = {
      id: nanoid(8),
      players: [
        {
          id: sid,
          ws,
          nick: ((msg.data as JoinData)?.nick) || '匿名',
          isBot: false,
          score: 0,
          captures: 0,
        },
      ],
      board: initBoard(),
      current: 1,
      phase: 'playing',
      history: [],
    };
    rooms.set(room.id, room);
    send(ws, 'room:created', { roomId: room.id, boardSize: S });
  }

  if (msg.type === 'room:join') {
    const roomId = (msg.data as JoinData)?.roomId;
    if (!roomId) return send(ws, 'error', { message: '缺少房间号' });
    const room = rooms.get(roomId);
    if (!room) return send(ws, 'error', { message: '不存在' });
    if (room.players.length >= 2) return send(ws, 'error', { message: '已满' });
    room.players.push({
      id: sid,
      ws,
      nick: ((msg.data as JoinData)?.nick) || '匿名',
      isBot: false,
      score: 0,
      captures: 0,
    });
    broadcast(room, 'room:joined', { total: room.players.length });
    if (room.players.length >= 2) {
      broadcast(room, 'game:start', { boardSize: S, currentPlayer: 1 });
    }
  }

  if (msg.type === 'game:move') {
    for (const [, room] of rooms) {
      const pos = room.players.findIndex((p) => p.id === sid);
      if (pos >= 0 && room.phase === 'playing' && room.current === pos + 1) {
        const { row, col } = msg.data as { row: number; col: number };
        if (row < 0 || row >= S || col < 0 || col >= S || (room.board as number[][])[row][col] !== 0) {
          return send(ws, 'error', { message: '无效位置' });
        }
        (room.board as number[][])[row][col] = room.current!;
        const captured: [number, number][] = [];
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const nr = row + dr, nc = col + dc;
          if (nr >= 0 && nr < S && nc >= 0 && nc < S && (room.board as number[][])[nr][nc] === 3 - room.current!) {
            const g = getGroup(room.board as number[][], nr, nc);
            if (g.liberties.size === 0) {
              captured.push(...g.stones);
              for (const [sr, sc] of g.stones) (room.board as number[][])[sr][sc] = 0;
            }
          }
        }
        (room.players[pos] as GoGamePlayer).captures += captured.length;
        room.current = 3 - room.current!;
        broadcast(room, 'game:move', {
          row,
          col,
          player: pos + 1,
          captured,
          nextPlayer: room.current,
          scores: room.players.map((p) => (p as GoGamePlayer).captures),
        });
        break;
      }
    }
  }
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'go-game' }));

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
        console.error('[go-game] 消息处理错误:', err);
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
