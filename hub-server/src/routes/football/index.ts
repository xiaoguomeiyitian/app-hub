import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room, GameMessage } from '../../types/game.js';
import { JoinData, MoveData, GameActionData } from '../../types/messages.js';

export const description = '像素足球 - 多人对战';

export const router = Router();

interface FootballPlayer extends Player {
  side: number;
  score: number;
  alive: boolean;
}

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
        players: m.map((x, i) => ({ ...x, pos: 0, score: 0, alive: true, side: i })),
        board: null,
        phase: 'playing',
        timeLeft: 120,
        seed: nanoid(8),
      };
      rooms.set(id, room);
      m.filter((x) => !x.isBot).forEach((x) => {
        if (x.ws) send(x.ws, 'match:found', { roomId: id, position: m.indexOf(x), seed: room.seed });
      });
      broadcast(room, 'game:start', {
        seed: room.seed,
        players: room.players.map((p) => ({ id: p.id, nick: p.nick, side: (p as FootballPlayer).side })),
      });
    }, 8000);
  }

  if (msg.type === 'game:action') {
    for (const [, room] of rooms) {
      const p = room.players.find((player) => player.id === sid);
      if (p) {
        const action = msg.data as GameActionData;
        broadcast(room, 'game:action', { id: sid, ...action });
        if (action.score !== undefined) p.score = action.score!;
        if (action.pos !== undefined) p.pos = action.pos!;
        if (action.alive === false) {
          p.alive = false;
          const alive = room.players.filter((pl) => (pl as FootballPlayer).alive);
          if (alive.length <= 1) {
            room.phase = 'finished';
            broadcast(room, 'game:over', {
              winner: alive.length ? alive[0].id : null,
              scores: room.players.map((pl) => ({
                nick: pl.nick,
                score: (pl as FootballPlayer).score,
              })),
            });
          }
        }
        break;
      }
    }
  }

  if (msg.type === 'game:state') {
    for (const [, room] of rooms) {
      const p = room.players.find((player) => player.id === sid);
      if (p) {
        broadcast(room, 'game:state', { id: sid, state: (msg.data as MoveData) });
        break;
      }
    }
  }
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'football', rooms: rooms.size }));

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
        console.error('[football] 消息处理错误:', err);
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
