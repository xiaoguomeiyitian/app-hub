import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room, GameMessage } from '../../types/game.js';
import { JoinData, GameActionData } from '../../types/messages.js';

export const description = '炸弹人 - 多人对战放置炸弹';
export const router = Router();

const clients = new Map<string, WebSocket>();
const rooms = new Map<string, Room>();
const matchQueue: Player[] = [];

function send(ws: WebSocket, type: string, data?: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

function broadcast(room: Room, type: string, data?: unknown): void {
  for (const p of room.players) {
    if (!p.isBot && p.ws?.readyState === WebSocket.OPEN) {
      send(p.ws, type, data);
    }
  }
}

// Bomberman specific types
interface Bomb {
  x: number;
  y: number;
  range: number;
  owner: number;
  timer: number;
}

interface BombermanPlayer extends Player {
  x: number;
  y: number;
  alive: boolean;
  bombs: number;
  range: number;
  side: number;
}

interface BombermanRoom extends Room {
  board: number[][];
  bombs: Bomb[];
  w: number;
  h: number;
  spawns: number[][];
}

function generateMap(w: number, h: number): number[][] {
  const map: number[][] = [];
  for (let y = 0; y < h; y++) {
    map[y] = [];
    for (let x = 0; x < w; x++) {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) map[y][x] = 1; // wall
      else if (x % 2 === 0 && y % 2 === 0) map[y][x] = 1; // pillar
      else if (Math.random() < 0.6) map[y][x] = 2; // destructible
      else map[y][x] = 0; // empty
    }
  }
  // Clear spawn points
  map[1][1] = map[1][2] = map[2][1] = 0;
  map[1][w - 2] = map[1][w - 3] = map[2][w - 2] = 0;
  map[h - 2][1] = map[h - 2][2] = map[h - 3][1] = 0;
  map[h - 2][w - 2] = map[h - 2][w - 3] = map[h - 3][w - 2] = 0;
  return map;
}

function handleMessage(msg: GameMessage, sid: string, ws: WebSocket): void {
  if (msg.type === 'room:create') {
    const w = 13, h = 11;
    const spawns = [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]];
    const room = {
      id: nanoid(8),
      players: [
        {
          id: sid,
          ws,
          nick: ((msg.data as JoinData)?.nick) || '匿名',
          isBot: false,
          score: 0,
          x: spawns[0][0],
          y: spawns[0][1],
          alive: true,
          bombs: 1,
          range: 2,
          side: 0,
        } as BombermanPlayer,
      ],
      board: generateMap(w, h),
      phase: 'waiting',
      bombs: [],
      w,
      h,
      spawns,
    } as BombermanRoom;
    rooms.set(room.id, room);
    send(ws, 'room:created', { roomId: room.id });
  }

  if (msg.type === 'room:join') {
    const roomId = (msg.data as JoinData)?.roomId;
    if (!roomId) return send(ws, 'error', { message: '缺少房间号' });
    const room = rooms.get(roomId) as BombermanRoom;
    if (!room) return send(ws, 'error', { message: '房间不存在' });
    if (room.players.length >= 4) return send(ws, 'error', { message: '房间已满' });
    const pos = room.players.length;
    room.players.push({
      id: sid,
      ws,
      nick: ((msg.data as JoinData)?.nick) || '匿名',
      isBot: false,
      score: 0,
      x: room.spawns[pos][0],
      y: room.spawns[pos][1],
      alive: true,
      bombs: 1,
      range: 2,
      side: pos,
    } as BombermanPlayer);
    broadcast(room, 'room:joined', { position: pos, total: room.players.length });
    if (room.players.length >= 2 && room.phase === 'waiting') {
      room.phase = 'playing';
      broadcast(room, 'game:start', {
        map: room.board,
        players: room.players.map((p) => ({
          x: (p as BombermanPlayer).x,
          y: (p as BombermanPlayer).y,
          nick: p.nick,
          alive: (p as BombermanPlayer).alive,
        })),
        w: room.w,
        h: room.h,
      });
    }
  }

  if (msg.type === 'game:move') {
    for (const [, room] of rooms) {
      const br = room as BombermanRoom;
      const pos = br.players.findIndex((p) => p.id === sid);
      if (pos >= 0 && br.phase === 'playing' && (br.players[pos] as BombermanPlayer).alive) {
        const player = br.players[pos] as BombermanPlayer;
        const { x, y } = msg.data as { x: number; y: number };
        const nx = player.x + x;
        const ny = player.y + y;
        if (nx >= 0 && nx < br.w && ny >= 0 && ny < br.h && br.board[ny][nx] === 0) {
          player.x = nx;
          player.y = ny;
          broadcast(room, 'game:move', { position: pos, x: nx, y: ny });
        }
        break;
      }
    }
  }

  if (msg.type === 'game:bomb') {
    for (const [, room] of rooms) {
      const br = room as BombermanRoom;
      const pos = br.players.findIndex((p) => p.id === sid);
      if (pos >= 0 && br.phase === 'playing' && (br.players[pos] as BombermanPlayer).alive) {
        const player = br.players[pos] as BombermanPlayer;
        const bomb: Bomb = {
          x: player.x,
          y: player.y,
          range: player.range,
          owner: pos,
          timer: 3 * 20, // 3 seconds at 20Hz
        };
        br.bombs.push(bomb);
        broadcast(room, 'game:bomb', { x: bomb.x, y: bomb.y, range: bomb.range, owner: pos });
        // Explode after timer
        setTimeout(() => {
          const idx = br.bombs.indexOf(bomb);
          if (idx >= 0) br.bombs.splice(idx, 1);
          const hits: { x: number; y: number }[] = [];
          for (let d = 0; d <= bomb.range; d++) {
            for (const [dx, dy] of [[0, d], [0, -d], [d, 0], [-d, 0]]) {
              const bx = bomb.x + dx, by = bomb.y + dy;
              if (bx < 0 || bx >= br.w || by < 0 || by >= br.h) break;
              if (br.board[by][bx] === 1) break;
              hits.push({ x: bx, y: by });
              if (br.board[by][bx] === 2) {
                br.board[by][bx] = 0;
                break;
              }
              // Hit players
              for (const pl of br.players) {
                const bpl = pl as BombermanPlayer;
                if (bpl.alive && bpl.x === bx && bpl.y === by) {
                  bpl.alive = false;
                }
              }
            }
          }
          broadcast(room, 'game:explode', {
            hits,
            destroyed: hits.filter(h => br.board[h.y][h.x] === 0).length,
          });
          const alive = br.players.filter((p) => (p as BombermanPlayer).alive);
          if (alive.length <= 1) {
            br.phase = 'finished';
            broadcast(room, 'game:over', { winner: alive.length ? br.players.indexOf(alive[0]) : -1 });
          }
        }, 3000);
        break;
      }
    }
  }

  if (msg.type === 'game:state') {
    for (const [, room] of rooms) {
      const p = room.players.find((player) => player.id === sid);
      if (p) {
        broadcast(room, 'game:state', { id: sid, state: msg.data as GameActionData });
        break;
      }
    }
  }
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'bomberman' }));

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
        console.error('[bomberman] 消息处理错误:', err);
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
