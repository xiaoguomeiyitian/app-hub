import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room, GameMessage } from '../../types/game.js';
import { JoinData } from '../../types/messages.js';

interface PongPlayer extends Player {
  paddleY?: number;
  side?: number;
  score: number;
}

interface PongRoom extends Room {
  ball: { x: number; y: number; dx: number; dy: number };
}

export const description = '乒乓球 - 经典双人对打';
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
      const room: Room = {
        id,
        players: m.map((x, i) => ({ ...x, paddleY: 0.5, score: 0, side: i })),
        board: null,
        phase: 'playing',
        ball: { x: 0.5, y: 0.5, dx: 0.005, dy: 0.003 },
        timeLeft: 120,
        seed: nanoid(8),
      };
      rooms.set(id, room);
      m.filter((x) => !x.isBot).forEach((x) => {
        if (x.ws) send(x.ws, 'match:found', { roomId: id, position: m.indexOf(x), seed: room.seed });
      });
      broadcast(room, 'game:start', {
        side0: room.players[0].side,
        side1: room.players[1].side,
      });
      // Ball movement interval
      const timerId = setInterval(() => {
        if (room.phase !== 'playing') return;
        const ball = (room as PongRoom).ball!;
        ball.x += ball.dx;
        ball.y += ball.dy;
        if (ball.y <= 0 || ball.y >= 1) ball.dy *= -1;
        if (ball.x <= 0) {
          const p1 = room.players[1] as PongPlayer;
          p1.score++;
          broadcast(room, 'game:state', {
            ball,
            scores: [room.players[0]!.score, room.players[1]!.score],
          });
          (room as PongRoom).ball = { x: 0.5, y: 0.5, dx: 0.005, dy: (Math.random() - 0.5) * 0.006 };
        }
        if (ball!.x >= 1) {
          const p0 = room.players[0] as PongPlayer;
          p0.score++;
          broadcast(room, 'game:state', {
            ball,
            scores: [(room.players[0] as PongPlayer).score, (room.players[1] as PongPlayer).score],
          });
          (room as PongRoom).ball = { x: 0.5, y: 0.5, dx: -0.005, dy: (Math.random() - 0.5) * 0.006 };
        }
      }, 16);
      (room as PongRoom).timerId = timerId;
    }, 8000);
  }

  if (msg.type === 'game:paddle') {
    for (const [, room] of rooms) {
      const p = room.players.find((player) => player.id === sid);
      if (p) {
        (p as PongPlayer).paddleY = (msg.data as { y?: number }).y;
        broadcast(room, 'game:paddle', { side: p.side, y: (p as PongPlayer).paddleY });
        break;
      }
    }
  }
}

function destroyRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const pongRoom = room as PongRoom;
  if (pongRoom.timerId) {
    clearInterval(pongRoom.timerId);
    pongRoom.timerId = undefined;
  }
  rooms.delete(roomId);
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'pong', rooms: rooms.size }));

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
        console.error('[pong] 消息处理错误:', err);
      }
    });
    ws.on('close', () => {
      clients.delete(sid);
      // 销毁玩家所在房间
      for (const [roomId, room] of rooms) {
        if (room.players.some((p: any) => p.id === sid)) {
          destroyRoom(roomId);
          break;
        }
      }
      const i = matchQueue.findIndex((q) => q.id === sid);
      if (i >= 0) matchQueue.splice(i, 1);
    });
    ws.on('error', () => clients.delete(sid));
  });
  log(LogLevel.INFO, `🔌 WebSocket 已注册: ${tp}`);
}
