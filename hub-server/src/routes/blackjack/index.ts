import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room, GameMessage } from '../../types/game.js';
import { JoinData, GameActionData } from '../../types/messages.js';

export const description = '21点 - 经典赌场纸牌游戏';
export const router = Router();

const clients = new Map<string, WebSocket>();
const rooms = new Map<string, Room>();
const matchQueue: Player[] = [];

// Blackjack specific types
interface BlackjackPlayer extends Player {
  hand: string[];
  stand: boolean;
  busted: boolean;
  bet: number;
  doubled: boolean;
  side: number;
}

interface BlackjackRoom extends Room {
  dealer: string[];
  deck: string[];
  currentPlayer: number;
}

function createDeck(numDecks = 6): string[] {
  const suits = ['♠', '♥', '♣', '♦'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: string[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const s of suits) {
      for (const r of ranks) {
        deck.push(s + r);
      }
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(card: string): number[] {
  const rank = card.endsWith('10') ? '10' : card.slice(-1);
  if (rank === 'A') return [1, 11];
  if (['K', 'Q', 'J'].includes(rank) || rank === '10') return [10];
  return [parseInt(rank)];
}

function handTotal(hand: string[]): number {
  let totals = [0];
  for (const c of hand) {
    const vals = cardValue(c);
    totals = totals.flatMap((t) => vals.map((v) => t + v));
  }
  const valid = totals.filter((t) => t <= 21);
  return valid.length > 0 ? Math.max(...valid) : Math.min(...totals);
}

function send(ws: WebSocket, type: string, data?: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

function broadcast(room: Room, type: string, data?: unknown): void {
  const br = room as BlackjackRoom;
  for (const p of br.players) {
    if (!p.isBot && p.ws?.readyState === WebSocket.OPEN) {
      send(p.ws, type, data);
    }
  }
}

function startRound(room: Room): void {
  const br = room as BlackjackRoom;
  br.deck = createDeck();
  br.dealer = [br.deck.pop()!, br.deck.pop()!];
  for (const p of br.players) {
    const bp = p as BlackjackPlayer;
    bp.hand = [br.deck.pop()!, br.deck.pop()!];
    bp.stand = false;
    bp.busted = false;
    bp.bet = bp.bet || 100;
    bp.doubled = false;
  }
  br.currentPlayer = 0;
  br.phase = 'playing';
  for (let i = 0; i < br.players.length; i++) {
    const p = br.players[i] as BlackjackPlayer;
    if (!p.isBot && p.ws) {
      send(p.ws, 'game:deal', {
        hand: p.hand,
        dealerUp: br.dealer[0],
        position: i,
      });
    }
  }
  const currentPlayer = br.players[0] as BlackjackPlayer;
  broadcast(room, 'game:turn', {
    position: 0,
    hand: currentPlayer.hand,
    total: handTotal(currentPlayer.hand),
  });
}

function settle(room: Room): void {
  const br = room as BlackjackRoom;
  const dealerTotal = handTotal(br.dealer);
  const results = br.players.map((p) => {
    const bp = p as BlackjackPlayer;
    const pt = handTotal(bp.hand);
    let result = 'lose';
    if (bp.busted) result = 'bust';
    else if (pt > dealerTotal || dealerTotal > 21) result = 'win';
    else if (pt === dealerTotal) result = 'push';
    return { nick: bp.nick, hand: bp.hand, total: pt, result, bet: bp.bet };
  });
  br.phase = 'finished';
  broadcast(room, 'game:settle', {
    dealer: br.dealer,
    dealerTotal,
    results,
  });
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
      while (matchQueue.length < 3) {
        matchQueue.push({
          id: 'bot-' + nanoid(4),
          ws: null,
          isBot: true,
          nick: 'AI',
          score: 0,
        });
      }
      const matched = matchQueue.splice(0, 3);
      const roomId = nanoid(8);
      const room = {
        id: roomId,
        players: matched.map((m, i) => ({
          ...m,
          hand: [],
          stand: false,
          busted: false,
          bet: 100,
          doubled: false,
          side: i,
        })),
        board: null,
        phase: 'waiting',
        timeLeft: 120,
        seed: nanoid(8),
        dealer: [],
        deck: [],
        currentPlayer: 0,
      } as BlackjackRoom;
      rooms.set(roomId, room);
      matched.filter((m) => !m.isBot).forEach((m) => {
        if (m.ws) {
          send(m.ws, 'match:found', { roomId, position: matched.indexOf(m), seed: room.seed });
        }
      });
      setTimeout(() => startRound(room), 1000);
    }, 8000);
  }

  if (msg.type === 'game:hit') {
    for (const [, room] of rooms) {
      const br = room as BlackjackRoom;
      const pos = br.players.findIndex((p) => p.id === sid);
      if (pos >= 0 && pos === br.currentPlayer && br.phase === 'playing') {
        const player = br.players[pos] as BlackjackPlayer;
        player.hand.push(br.deck.pop()!);
        const total = handTotal(player.hand);
        if (total > 21) {
          player.busted = true;
          player.stand = true;
        }
        broadcast(room, 'game:hit', {
          position: pos,
          hand: player.hand,
          total,
          busted: total > 21,
        });
        br.currentPlayer++;
        if (br.currentPlayer >= br.players.length) {
          while (handTotal(br.dealer) < 17) {
            br.dealer.push(br.deck.pop()!);
          }
          settle(room);
        } else {
          const nextPlayer = br.players[br.currentPlayer] as BlackjackPlayer;
          broadcast(room, 'game:turn', {
            position: br.currentPlayer,
            hand: nextPlayer.hand,
            total: handTotal(nextPlayer.hand),
          });
        }
        break;
      }
    }
  }

  if (msg.type === 'game:stand') {
    for (const [, room] of rooms) {
      const br = room as BlackjackRoom;
      const pos = br.players.findIndex((p) => p.id === sid);
      if (pos >= 0 && pos === br.currentPlayer && br.phase === 'playing') {
        const player = br.players[pos] as BlackjackPlayer;
        player.stand = true;
        broadcast(room, 'game:stand', { position: pos });
        br.currentPlayer++;
        if (br.currentPlayer >= br.players.length) {
          while (handTotal(br.dealer) < 17) {
            br.dealer.push(br.deck.pop()!);
          }
          settle(room);
        } else {
          const nextPlayer = br.players[br.currentPlayer] as BlackjackPlayer;
          broadcast(room, 'game:turn', {
            position: br.currentPlayer,
            hand: nextPlayer.hand,
            total: handTotal(nextPlayer.hand),
          });
        }
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

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'blackjack' }));

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
        console.error('[blackjack] 消息处理错误:', err);
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
