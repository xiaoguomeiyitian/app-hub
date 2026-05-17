import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room, GameMessage } from '../../types/game.js';
import { JoinData } from '../../types/messages.js';

export const description = '跳棋 - 经典跳吃对战';
export const router = Router();

const S = 8;
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
  const b = Array.from({ length: S }, () => Array(S).fill(0));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < S; c++) {
      if ((r + c) % 2 === 1) b[r][c] = 2;
    }
  }
  for (let r = 5; r < S; r++) {
    for (let c = 0; c < S; c++) {
      if ((r + c) % 2 === 1) b[r][c] = 1;
    }
  }
  return b;
}

interface Move {
  from: [number, number];
  to: [number, number];
  jump: boolean;
  capture?: [number, number];
}

function validMoves(b: number[][], p: number): Move[] {
  const moves: Move[] = [];
  const dir = p === 1 ? -1 : 1;
  for (let r = 0; r < S; r++) {
    for (let c = 0; c < S; c++) {
      if (b[r][c] !== p) continue;
      for (const dc of [-1, 1]) {
        const nr = r + dir;
        const nc = c + dc;
        if (nr >= 0 && nr < S && nc >= 0 && nc < S && b[nr][nc] === 0) {
          moves.push({ from: [r, c], to: [nr, nc], jump: false });
        }
        const jr = r + dir * 2;
        const jc = c + dc * 2;
        if (
          jr >= 0 && jr < S && jc >= 0 && jc < S &&
          b[nr][nc] === 3 - p && b[jr][jc] === 0
        ) {
          moves.push({ from: [r, c], to: [jr, jc], jump: true, capture: [nr, nc] });
        }
      }
    }
  }
  return moves;
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
        players: m.map((x) => ({ ...x })),
        board: initBoard(),
        current: 1,
        phase: 'playing',
      };
      rooms.set(id, room);
      m.filter((x) => !x.isBot).forEach((x) => {
        if (x.ws) send(x.ws, 'match:found', { roomId: id, position: m.indexOf(x) });
      });
      broadcast(room, 'game:start', {
        board: room.board,
        currentPlayer: 1,
        validMoves: validMoves(room.board as number[][], 1),
      });
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
        },
      ],
      board: initBoard(),
      current: 1,
      phase: 'playing',
    };
    rooms.set(room.id, room);
    send(ws, 'room:created', { roomId: room.id });
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
    });
    broadcast(room, 'room:joined', { total: room.players.length });
    if (room.players.length >= 2) {
      broadcast(room, 'game:start', {
        board: room.board,
        currentPlayer: 1,
        validMoves: validMoves(room.board as number[][], 1),
      });
    }
  }

  if (msg.type === 'game:move') {
    for (const [, room] of rooms) {
      const pos = room.players.findIndex((p) => p.id === sid);
      if (pos >= 0 && room.phase === 'playing') {
        const { from, to } = msg.data as { from: number[]; to: number[] };
        const moves = validMoves(room.board as number[][], room.current!);
        const m = moves.find(
          (x) =>
            x.from[0] === from[0] &&
            x.from[1] === from[1] &&
            x.to[0] === to[0] &&
            x.to[1] === to[1]
        );
        if (!m) return send(ws, 'error', { message: '无效移动' });
        (room.board as number[][])[to[0]][to[1]] = room.current!;
        (room.board as number[][])[from[0]][from[1]] = 0;
        if (m.capture) {
          (room.board as number[][])[m.capture[0]][m.capture[1]] = 0;
        }
        const next = 3 - room.current!;
        room.current = next;
        broadcast(room, 'game:move', {
          from,
          to,
          capture: m.capture,
          nextPlayer: next,
          validMoves: validMoves(room.board as number[][], next),
        });
        break;
      }
    }
  }
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'checkers' }));

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
        console.error('[checkers] 消息处理错误:', err);
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
