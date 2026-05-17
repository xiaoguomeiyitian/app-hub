import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room } from '../../types/game.js';

interface SudokuPlayer extends Player {
  filled: number;
  errors: number;
}

interface SudokuRoom extends Room {
  puzzle: number[][];
  solution: number[][];
  startTime: number;
}

export const description = '数独 - 竞速数独对战';
export const router = Router();

const clients = new Map<string, WebSocket>();
const rooms = new Map<string, Room>();
const matchQ: Player[] = [];

function send(ws: WebSocket, t: string, d?: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: t, data: d }));
}

function bc(r: Room, t: string, d?: unknown) {
  for (const p of r.players) {
    if (!p.isBot && p.ws?.readyState === WebSocket.OPEN) send(p.ws, t, d);
  }
}

function genPuzzle(difficulty: number): { puzzle: number[][]; solution: number[][] } {
  const puzzles = [
    [[5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],[8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],[0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]],
    [[0,0,0,2,6,0,7,0,1],[6,8,0,0,7,0,0,9,0],[1,9,0,0,0,4,5,0,0],[8,2,0,1,0,0,0,4,0],[0,0,4,6,0,2,9,0,0],[0,5,0,0,0,3,0,2,8],[0,0,9,3,0,0,0,7,4],[0,4,0,0,5,0,0,3,6],[7,0,3,0,1,8,0,0,0]],
  ];
  const sol = [
    [[5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],[8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],[9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]],
    [[4,3,5,2,6,9,7,8,1],[6,8,2,5,7,1,4,9,3],[1,9,7,8,3,4,5,6,2],[8,2,6,1,9,5,3,4,7],[3,7,4,6,8,2,9,1,5],[9,5,1,7,4,3,6,2,8],[5,1,9,3,2,6,8,7,4],[2,4,8,9,5,7,1,3,6],[7,6,3,4,1,8,2,5,9]],
  ];
  const idx = difficulty % 2;
  return { puzzle: puzzles[idx].map(r => [...r]), solution: sol[idx] };
}

function handleMsg(msg: any, sid: string, ws: WebSocket) {
  if (msg.type === 'match:join') {
    matchQ.push({ id: sid, ws, nick: msg.data?.nick || '匿名' } as SudokuPlayer);
    send(ws, 'match:queued', { position: matchQ.length });
    const timerId = setTimeout(() => {
      const idx = matchQ.findIndex(q => q.id === sid);
      if (idx < 0) return;
      while (matchQ.length < 2) matchQ.push({ id: 'bot-' + nanoid(4), ws: null, isBot: true, nick: 'AI' } as SudokuPlayer);
      const m = matchQ.splice(0, 2);
      const id = nanoid(8);
      const { puzzle, solution } = genPuzzle(Math.floor(Math.random() * 10));
      const r: any = { id, players: m.map(x => ({ ...x, filled: 0, errors: 0 })), puzzle, solution, phase: 'playing', startTime: Date.now(), timerId: null };
      r.timerId = timerId;
      rooms.set(id, r);
      m.filter(x => !x.isBot).forEach(x => send(x.ws!, 'match:found', { roomId: id, position: m.indexOf(x) }));
      bc(r, 'game:start', { puzzle, timeLimit: 300 });
    }, 8000);
  }
  if (msg.type === 'room:create') {
    const { puzzle, solution } = genPuzzle(msg.data?.difficulty || 1);
    const r: SudokuRoom = { id: nanoid(8), players: [{ id: sid, ws, nick: msg.data?.nick || '匿名', filled: 0, errors: 0 } as SudokuPlayer], puzzle, solution, phase: 'playing', startTime: Date.now() };
    rooms.set(r.id, r);
    send(ws, 'room:created', { roomId: r.id, puzzle });
  }
  if (msg.type === 'room:join') {
    const r = rooms.get(msg.data?.roomId) as SudokuRoom;
    if (!r) return send(ws, 'error', { message: '不存在' });
    if (r.players.length >= 2) return send(ws, 'error', { message: '已满' });
    r.players.push({ id: sid, ws, nick: msg.data?.nick || '匿名', filled: 0, errors: 0 } as SudokuPlayer);
    bc(r, 'room:joined', { total: r.players.length });
    if (r.players.length >= 2) bc(r, 'game:start', { puzzle: r.puzzle, timeLimit: 300 });
  }
  if (msg.type === 'game:fill') {
    for (const [, r] of rooms) {
      const room = r as SudokuRoom;
      const pos = room.players.findIndex((p: Player) => p.id === sid);
      if (pos >= 0 && room.phase === 'playing') {
        const { row, col, value } = msg.data as { row: number; col: number; value: number };
        const correct = room.solution[row][col] === value;
        const player = room.players[pos] as SudokuPlayer;
        player.filled++;
        if (!correct) player.errors++;
        send(ws, 'game:fill', { row, col, value, correct, filled: player.filled });
        if (player.filled >= 81 - room.puzzle.flat().filter((x: number) => x !== 0).length) {
          room.phase = 'finished';
          bc(room, 'game:over', { winner: pos, time: (Date.now() - room.startTime) / 1000 });
        }
        break;
      }
    }
  }
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'sudoku' }));

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
        handleMsg(msg, sid, ws);
      } catch (e) { console.warn('[sudoku] msg error:', e); }
    });
    ws.on('close', () => clients.delete(sid));
    ws.on('error', () => clients.delete(sid));
  });
  log(LogLevel.INFO, `🔌 WebSocket 已注册: ${tp}`);
}
