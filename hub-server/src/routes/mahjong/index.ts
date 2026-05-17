import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room, GameMessage } from '../../types/game.js';
import { JoinData, MoveData } from '../../types/messages.js';

export const description = '麻将 - 四人国标麻将';
export const router = Router();

const clients = new Map<string, WebSocket>();
const rooms = new Map<string, Room>();
const matchQueue: Player[] = [];

// Mahjong specific types
interface MahjongPlayer extends Player {
  hand: string[];
  side: number;
}

interface MahjongRoom extends Room {
  drawPile: string[];
  currentPlayer: number;
  discards: string[];
}

const ALL_TILES: string[] = [];
const SUITS = ['wan', 'tong', 'tiao'];

for (const s of SUITS) {
  for (let i = 1; i <= 9; i++) {
    for (let j = 0; j < 4; j++) ALL_TILES.push(s + i);
  }
}
for (const z of ['dong', 'nan', 'xi', 'bei', 'zhong', 'fa', 'bai']) {
  for (let j = 0; j < 4; j++) ALL_TILES.push(z);
}

function shuffle(arr: string[]): string[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function send(ws: WebSocket, type: string, data?: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

function broadcast(room: Room, type: string, data?: unknown): void {
  const mr = room as MahjongRoom;
  for (const p of mr.players) {
    if (!p.isBot && p.ws?.readyState === WebSocket.OPEN) {
      send(p.ws, type, data);
    }
  }
}

function startGame(room: Room): void {
  const mr = room as MahjongRoom;
  const wall = shuffle([...ALL_TILES]);
  for (let i = 0; i < 4; i++) {
    const player = mr.players[i] as MahjongPlayer;
    player.hand = wall.slice(i * 13, (i + 1) * 13).sort();
    if (player.isBot) {
      player.hand.sort();
    }
  }
  mr.drawPile = wall.slice(52);
  mr.currentPlayer = 0;
  mr.phase = 'playing';

  for (let i = 0; i < 4; i++) {
    const player = mr.players[i] as MahjongPlayer;
    if (!player.isBot && player.ws) {
      send(player.ws, 'game:start', {
        hand: player.hand,
        position: i,
        wind: 'dong',
      });
    }
  }
  broadcast(room, 'game:turn', { position: 0, action: 'draw' });
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
      while (matchQueue.length < 4) {
        matchQueue.push({
          id: 'bot-' + nanoid(4),
          ws: null,
          isBot: true,
          nick: 'AI',
          score: 0,
        });
      }
      const matched = matchQueue.splice(0, 4);
      const roomId = nanoid(8);
      const room = {
        id: roomId,
        players: matched.map((m, i) => ({
          ...m,
          hand: [],
          side: i,
        } as MahjongPlayer)),
        board: null,
        phase: 'waiting',
        drawPile: [],
        currentPlayer: 0,
        discards: [],
      } as MahjongRoom;
      rooms.set(roomId, room);
      matched.filter((m) => !m.isBot).forEach((m) => {
        if (m.ws) {
          send(m.ws, 'match:found', { roomId, position: matched.indexOf(m) });
        }
      });
      setTimeout(() => startGame(room), 1000);
    }, 10000);
  }

  if (msg.type === 'room:create') {
    const roomId = nanoid(8);
    const room = {
      id: roomId,
      players: [
        {
          id: sid,
          ws,
          nick: ((msg.data as JoinData)?.nick) || '匿名',
          isBot: false,
          score: 0,
          hand: [],
          side: 0,
        } as MahjongPlayer,
      ],
      board: null,
      phase: 'waiting',
      drawPile: [],
      currentPlayer: 0,
      discards: [],
    } as MahjongRoom;
    rooms.set(roomId, room);
    send(ws, 'room:created', { roomId });
  }

  if (msg.type === 'room:join') {
    const roomId = (msg.data as JoinData)?.roomId;
    if (!roomId) return send(ws, 'error', { message: '缺少房间号' });
    const room = rooms.get(roomId) as MahjongRoom;
    if (!room) return send(ws, 'error', { message: '房间不存在' });
    if (room.players.length >= 4) return send(ws, 'error', { message: '房间已满' });
    room.players.push({
      id: sid,
      ws,
      nick: ((msg.data as JoinData)?.nick) || '匿名',
      isBot: false,
      score: 0,
      hand: [],
      side: room.players.length,
    } as MahjongPlayer);
    broadcast(room, 'room:joined', { nick: ((msg.data as JoinData)?.nick) || '匿名', total: room.players.length });
    if (room.players.length === 4) setTimeout(() => startGame(room), 1000);
  }

  if (msg.type === 'game:discard') {
    for (const [, room] of rooms) {
      const mr = room as MahjongRoom;
      const pos = mr.players.findIndex((p) => p.id === sid);
      if (pos >= 0 && pos === mr.currentPlayer && mr.phase === 'playing') {
        const tile = ((msg.data as MoveData)?.tile as string) || '';
        const player = mr.players[pos] as MahjongPlayer;
        const idx = player.hand.indexOf(tile);
        if (idx >= 0) player.hand.splice(idx, 1);
        mr.discards.push(tile);
        broadcast(room, 'game:discard', {
          position: pos,
          tile,
          handSize: player.hand.length,
        });
        if (player.hand.length === 0) {
          mr.phase = 'finished';
          broadcast(room, 'game:over', { winner: pos });
          return;
        }
        mr.currentPlayer = (mr.currentPlayer + 1) % 4;
        broadcast(room, 'game:turn', { position: mr.currentPlayer, action: 'draw' });
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

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'mahjong' }));

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
        console.error('[mahjong] 消息处理错误:', err);
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
