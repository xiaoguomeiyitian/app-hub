import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room, GameMessage } from '../../types/game.js';
import { JoinData } from '../../types/messages.js';

export const description = '黑白棋 - 经典翻转对战';
export const router = Router();

const BOARD_SIZE = 8;
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
  const b = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  b[3][3] = b[4][4] = 2;
  b[3][4] = b[4][3] = 1;
  return b;
}

function validMoves(b: number[][], p: number): [number, number][] {
  const opp = 3 - p;
  const moves: [number, number][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (b[r][c] !== 0) continue;
      let valid = false;
      for (const [dr, dc] of [
        [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1],
      ]) {
        let nr = r + dr;
        let nc = c + dc;
        let found = false;
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc] === opp) {
          nr += dr;
          nc += dc;
          found = true;
        }
        if (found && nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc] === p) {
          valid = true;
          break;
        }
      }
      if (valid) moves.push([r, c]);
    }
  }
  return moves;
}

function flip(b: number[][], r: number, c: number, p: number): void {
  const opp = 3 - p;
  b[r][c] = p;
  for (const [dr, dc] of [
    [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1],
  ]) {
    let nr = r + dr;
    let nc = c + dc;
    const flips: [number, number][] = [];
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc] === opp) {
      flips.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc] === p) {
      for (const [fr, fc] of flips) {
        b[fr][fc] = p;
      }
    }
  }
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
        validMoves: validMoves(room.board, 1),
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
        validMoves: validMoves(room.board, 1),
      });
    }
  }

  if (msg.type === 'game:move') {
    for (const [, room] of rooms) {
      const pos = room.players.findIndex((p) => p.id === sid);
      if (pos >= 0 && room.phase === 'playing') {
        const { row, col } = msg.data as { row: number; col: number };
        const moves = validMoves(room.board, room.current!);
        if (!moves.some(([mr, mc]) => mr === row && mc === col)) {
          return send(ws, 'error', { message: '无效位置' });
        }
        flip(room.board, row, col, room.current!);
        const next = 3 - room.current!;
        const nMoves = validMoves(room.board, next);
        if (nMoves.length === 0) {
          const fMoves = validMoves(room.board, room.current!);
          if (fMoves.length === 0) {
            room.phase = 'finished';
            let s1 = 0, s2 = 0;
            for (const row of room.board) {
              for (const c of row) {
                if (c === 1) s1++;
                if (c === 2) s2++;
              }
            }
            broadcast(room, 'game:over', { winner: s1 > s2 ? 1 : s2 > s1 ? 2 : 0, scores: [s1, s2] });
          } else {
            broadcast(room, 'game:move', {
              row,
              col,
              player: room.current,
              nextPlayer: room.current,
              validMoves: fMoves,
            });
          }
        } else {
          room.current = next;
          broadcast(room, 'game:move', {
            row,
            col,
            player: 3 - next,
            nextPlayer: next,
            validMoves: nMoves,
          });
        }
        break;
      }
    }
  }
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'reversi' }));

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
        console.error('[reversi] 消息处理错误:', err);
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
