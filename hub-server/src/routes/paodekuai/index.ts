import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room } from '../../types/game.js';

export const description = '跑得快 - 三人扑克牌游戏';
export const router = Router();

const clients = new Map<string, WebSocket>();
const rooms = new Map<string, Room>();
const matchQueue: Player[] = [];

const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

function rankValue(card: string): number {
  const r = card.endsWith('10') ? '10' : card.slice(-1);
  return RANKS.indexOf(r);
}

function createDeck(): string[] {
  const suits = ['♠', '♥', '♣', '♦'];
  const deck: string[] = [];
  for (const suit of suits) {
    for (const rank of RANKS) {
      deck.push(suit + rank);
    }
  }
  // 洗牌
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

interface HandResult {
  type:
    | 'pass'
    | 'single'
    | 'pair'
    | 'trio'
    | 'bomb'
    | 'trio_single'
    | 'trio_pair'
    | 'straight';
  rank?: number;
  length?: number;
}

function identifyHand(cards: string[]): HandResult | null {
  if (!cards.length) return { type: 'pass' };

  const vals = cards.map(rankValue).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const v of vals) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }

  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const n = cards.length;

  if (n === 1) return { type: 'single', rank: vals[0] };
  if (n === 2 && groups[0][1] === 2) return { type: 'pair', rank: groups[0][0] };
  if (n === 3 && groups[0][1] === 3) return { type: 'trio', rank: groups[0][0] };
  if (n === 4 && groups[0][1] === 4) return { type: 'bomb', rank: groups[0][0] };
  if (n === 4 && groups[0][1] === 3) return { type: 'trio_single', rank: groups[0][0] };
  if (n === 5 && groups[0][1] === 3 && groups[1][1] === 2) {
    return { type: 'trio_pair', rank: groups[0][0] };
  }
  if (n >= 5 && groups.every(([, c]) => c === 1) && vals[n - 1] <= 11) {
    let ok = true;
    for (let i = 1; i < n; i++) {
      if (vals[i] !== vals[i - 1] + 1) ok = false;
    }
    if (ok) return { type: 'straight', rank: vals[n - 1], length: n };
  }
  return null;
}

function canBeat(current: HandResult, last: HandResult | null): boolean {
  if (!last || last.type === 'pass') return true;
  if (current.type === 'bomb' && last.type !== 'bomb') return true;
  if (current.type === last.type && current.length === last.length) {
    return (current.rank || 0) > (last.rank || 0);
  }
  return false;
}

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

function startGame(room: Room): void {
  const deck = createDeck();
  for (let i = 0; i < 3; i++) {
    room.players[i].hand = deck.slice(i * 16, (i + 1) * 16).sort((a, b) => rankValue(a) - rankValue(b));
  }
  room.remaining = [deck[48]];
  room.currentPlayer = 0;
  room.lastPlay = null;
  room.passCount = 0;
  room.phase = 'playing';

  for (let i = 0; i < 3; i++) {
    if (!room.players[i].isBot) {
      send(room.players[i].ws!, 'game:start', { hand: room.players[i].hand, position: i });
    }
  }
  broadcast(room, 'game:turn', { position: 0, timeLeft: 30 });
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'paodekuai', rooms: rooms.size }));

export function socketSetup(httpServer: HttpServer, wsPath: string): void {
  const targetPath = wsPath.replace(/\/$/, '') + '/websocket';
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = (req.url || '').split('?')[0];
    if (url !== targetPath) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    const sid = nanoid(12);
    clients.set(sid, ws);
    send(ws, 'connected', { socketId: sid });

    ws.on('message', (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') return send(ws, 'pong');

        if (msg.type === 'match:join') {
          const player: Player = {
            id: sid,
            ws,
            nick: msg.data?.nick || '匿名',
            isBot: false,
            score: 0,
          };
          matchQueue.push(player);
          send(ws, 'match:queued', { position: matchQueue.length });

          setTimeout(() => {
            const idx = matchQueue.findIndex((q) => q.id === sid);
            if (idx < 0) return;

            while (matchQueue.length < 3) {
              matchQueue.push({
                id: 'bot-' + nanoid(4),
                ws: null,
                isBot: true,
                nick: 'AI',
                score: 0,
              });
            }

            const m = matchQueue.splice(0, 3);
            const roomId = nanoid(8);
            const room: Room = {
              id: roomId,
              players: m.map((x) => ({ ...x, hand: [] })),
              board: null, // 扑克牌游戏不使用 board
              phase: 'waiting',
              currentPlayer: 0,
              lastPlay: null,
              passCount: 0,
              remaining: [],
            };
            rooms.set(roomId, room);
            m.filter((x) => !x.isBot).forEach((x) => {
              if (x.ws) send(x.ws, 'match:found', { roomId, position: m.indexOf(x) });
            });
            setTimeout(() => startGame(room), 1000);
          }, 8000);
        }

        if (msg.type === 'game:play') {
          for (const [, room] of rooms) {
            const pos = room.players.findIndex((p) => p.id === sid);
            if (pos >= 0 && pos === room.currentPlayer && room.phase === 'playing') {
              const cards: string[] = msg.data?.cards || [];
              if (cards.length === 0) {
                room.passCount!++;
                if (room.passCount! >= 2) room.lastPlay = null;
                broadcast(room, 'game:pass', { position: pos });
              } else {
                const parsed = identifyHand(cards);
                if (!parsed) return send(ws, 'error', { message: '无效牌型' });
                if (!canBeat(parsed, room.lastPlay)) {
                  return send(ws, 'error', { message: '打不过' });
                }
                for (const c of cards) {
                  const i = room.players[pos].hand!.indexOf(c);
                  if (i >= 0) room.players[pos].hand!.splice(i, 1);
                }
                room.lastPlay = parsed;
                room.passCount = 0;
                broadcast(room, 'game:play', {
                  position: pos,
                  cards,
                  handSize: room.players[pos].hand!.length,
                });
                if (!room.players[pos].hand!.length) {
                  room.phase = 'finished';
                  broadcast(room, 'game:over', { winner: pos });
                  return;
                }
              }
              room.currentPlayer = (room.currentPlayer! + 1) % 3;
              broadcast(room, 'game:turn', { position: room.currentPlayer, timeLeft: 30 });
              break;
            }
          }
        }
      } catch (err) {
        console.error('[paodekuai] 消息处理错误:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(sid);
      const i = matchQueue.findIndex((q) => q.id === sid);
      if (i >= 0) matchQueue.splice(i, 1);
    });

    ws.on('error', () => clients.delete(sid));
  });

  log(LogLevel.INFO, `🔌 WebSocket 已注册: ${targetPath}`);
}
