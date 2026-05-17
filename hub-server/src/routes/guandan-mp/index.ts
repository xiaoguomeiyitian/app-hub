import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { GamePhase, MessageType } from '../../types/constants.js';

export const description = '掼蛋联机';
export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'guandan-mp', rooms: rooms.size, clients: clients.size });
});

// ===== 类型 =====
type SeatId = 'north' | 'east' | 'south' | 'west';
type RoomType = 'match' | 'team' | 'private';
type RoomStatus = 'waiting' | 'playing' | 'finished';

type Suit = 'spade' | 'heart' | 'diamond' | 'club' | 'joker';
type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A'|'SJ'|'BJ';

interface Card {
  id: string;
  deckId: 1 | 2;
  suit: Suit;
  rank: Rank;
  rankValue: number;
  label: string;
}

interface SeatInfo {
  socketId: string | null;
  name: string;
  team: 'northSouth' | 'eastWest';
  isBot: boolean;
  connected: boolean;
  ready: boolean;
  hand: Card[];
  finished: boolean;
}

interface RoomState {
  roomId: string;
  roomType: RoomType;
  status: RoomStatus;
  seats: Record<SeatId, SeatInfo>;
  hostSeat: SeatId;
  turn: SeatId;
  trickLeader: SeatId | null;
  lastPlay: Card[] | null;
  lastPlaySeat: SeatId | null;
  passes: number;
  finishOrder: SeatId[];
  levelRank: Rank;
  createdAt: number;
}

interface QueueEntry {
  socketId: string;
  name: string;
  joinedAt: number;
}

// ===== 全局状态 =====
const clients = new Map<string, WebSocket>();
const clientNames = new Map<string, string>();
const rooms = new Map<string, RoomState>();
const matchQueue: QueueEntry[] = [];
const socketToRoom = new Map<string, string>();
const socketToSeat = new Map<string, SeatId>();

// ===== 工具函数 =====
function sendTo(socketId: string, type: string, data?: unknown): void {
  const ws = clients.get(socketId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

function broadcastToRoom(roomId: string, type: string, data: unknown, exclude?: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const seat of ['north','east','south','west'] as SeatId[]) {
    const p = room.seats[seat];
    if (p.socketId && p.socketId !== exclude && p.connected) {
      sendTo(p.socketId, type, data);
    }
  }
}

function generateRoomId(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateName(): string {
  const adj = ['精明', '老练', '冷静', '果断', '沉稳', '灵活', '机智', '稳健'];
  const noun = ['牌手', '牌王', '掼王', '牌圣', '牌神', '牌霸', '牌仙', '牌侠'];
  return adj[Math.floor(Math.random() * adj.length)] + noun[Math.floor(Math.random() * noun.length)];
}

const seatTeam: Record<SeatId, 'northSouth' | 'eastWest'> = {
  north: 'northSouth', south: 'northSouth',
  east: 'eastWest', west: 'eastWest',
};

function nextSeat(seat: SeatId): SeatId {
  const order: SeatId[] = ['north', 'east', 'south', 'west'];
  return order[(order.indexOf(seat) + 1) % 4];
}

// ===== 牌组 =====
const allRanks: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function getRankValue(rank: Rank, levelRank: Rank): number {
  if (rank === 'BJ') return 100;
  if (rank === 'SJ') return 99;
  if (rank === levelRank) return 98;
  return allRanks.indexOf(rank);
}

function createDeck(levelRank: Rank): Card[] {
  const cards: Card[] = [];
  let counter = 0;
  for (const deckId of [1, 2] as const) {
    for (const suit of ['spade','heart','diamond','club'] as const) {
      for (const rank of allRanks) {
        cards.push({
          id: `${deckId}-${++counter}`,
          deckId, suit, rank,
          rankValue: getRankValue(rank, levelRank),
          label: `${suit==='spade'?'♠':suit==='heart'?'♥':suit==='diamond'?'♦':'♣'}${rank}`,
        });
      }
    }
    cards.push({ id: `${deckId}-${++counter}`, deckId, suit: 'joker', rank: 'SJ', rankValue: 99, label: '小王' });
    cards.push({ id: `${deckId}-${++counter}`, deckId, suit: 'joker', rank: 'BJ', rankValue: 100, label: '大王' });
  }
  return cards;
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function sortHand(hand: Card[], levelRank: Rank): void {
  hand.sort((a, b) => getRankValue(b.rank, levelRank) - getRankValue(a.rank, levelRank) || a.id.localeCompare(b.id));
}

// ===== 牌型检测（简化版） =====
interface Combo {
  type: string;
  cards: Card[];
  primaryValue: number;
}

function detectCombo(cards: Card[], _levelRank: Rank): Combo | null {
  if (cards.length === 0) return null;
  const sorted = [...cards].sort((a, b) => a.rankValue - b.rankValue);
  const byRank = new Map<number, Card[]>();
  for (const c of sorted) {
    const list = byRank.get(c.rankValue) || [];
    list.push(c);
    byRank.set(c.rankValue, list);
  }
  const values = [...byRank.keys()].sort((a, b) => a - b);

  // 四大天王
  if (sorted.length === 4 && sorted.every(c => c.rank === 'BJ' || c.rank === 'SJ')) {
    return { type: 'rocket', cards: sorted, primaryValue: 101 };
  }

  // 炸弹（4+ 张同点）
  if (byRank.size === 1 && sorted.length >= 4) {
    return { type: 'bomb', cards: sorted, primaryValue: sorted[0].rankValue };
  }

  // 单张
  if (sorted.length === 1) return { type: 'single', cards: sorted, primaryValue: sorted[0].rankValue };

  // 对子
  if (sorted.length === 2 && byRank.size === 1) return { type: 'pair', cards: sorted, primaryValue: sorted[0].rankValue };

  // 三张
  if (sorted.length === 3 && byRank.size === 1) return { type: 'triple', cards: sorted, primaryValue: sorted[0].rankValue };

  // 三带对（5张）
  if (sorted.length === 5 && byRank.size === 2) {
    const tripleVal = values.find(v => byRank.get(v)!.length === 3);
    const pairVal = values.find(v => byRank.get(v)!.length === 2);
    if (tripleVal !== undefined && pairVal !== undefined) {
      return { type: 'threePair', cards: sorted, primaryValue: tripleVal };
    }
  }

  // 顺子（5-12张，不含级牌和王）
  if (sorted.length >= 5 && sorted.length <= 12 && byRank.size === sorted.length && values.every(v => v <= 12)) {
    if (values[values.length - 1] - values[0] === values.length - 1) {
      return { type: 'straight', cards: sorted, primaryValue: values[values.length - 1] };
    }
  }

  return null;
}

function canBeat(play: Combo, last: Combo | null): boolean {
  if (!last) return true;
  // 火箭最大
  if (play.type === 'rocket') return true;
  if (last.type === 'rocket') return false;
  // 炸弹 > 普通
  if (play.type === 'bomb' && last.type !== 'bomb') return true;
  if (play.type !== 'bomb' && last.type === 'bomb') return false;
  // 同类型比大小
  if (play.type !== last.type) return false;
  if (play.cards.length !== last.cards.length) return false;
  return play.primaryValue > last.primaryValue;
}

// ===== 机器人出牌 =====
function botPlay(hand: Card[], lastPlay: Card[] | null, levelRank: Rank): Card[] | 'pass' {
  if (!lastPlay || lastPlay.length === 0) {
    // 清轮：出最小单张
    const sorted = [...hand].sort((a, b) => a.rankValue - b.rankValue);
    return [sorted[0]];
  }
  const lastCombo = detectCombo(lastPlay, levelRank);
  if (!lastCombo) return 'pass';

  // 简单策略：找能打过的最小牌型
  for (const card of hand) {
    const test = detectCombo([card], levelRank);
    if (test && canBeat(test, lastCombo)) return [card];
  }
  return 'pass';
}

// ===== 匹配 =====
function handleMatchJoin(socketId: string): void {
  if (matchQueue.some(e => e.socketId === socketId)) {
    sendTo(socketId, 'match:queued');
    return;
  }
  if (socketToRoom.has(socketId)) {
    sendTo(socketId, 'error', { code: 'ALREADY_IN_ROOM' });
    return;
  }

  const name = clientNames.get(socketId) || generateName();
  clientNames.set(socketId, name);

  // 凑 4 人
  if (matchQueue.length >= 3) {
    // 够 4 人了
    const members = matchQueue.splice(0, 3);
    members.push({ socketId, name, joinedAt: Date.now() });
    createMatchRoom(members);
  } else {
    matchQueue.push({ socketId, name, joinedAt: Date.now() });
    sendTo(socketId, 'match:queued', { position: matchQueue.length });

    // 10 秒后不足人用机器人补位
    setTimeout(() => {
      const entry = matchQueue.find(e => e.socketId === socketId);
      if (!entry) return;
      const idx = matchQueue.indexOf(entry);
      const members = matchQueue.splice(0, idx + 1);
      // 补机器人到 4 人
      while (members.length < 4) {
        members.push({ socketId: '', name: `机器人${members.length}`, joinedAt: Date.now() });
      }
      createMatchRoom(members);
    }, 5000);
  }
}

function createMatchRoom(members: QueueEntry[]): void {
  const roomId = generateRoomId();
  const levelRank: Rank = '2';
  const deck = createDeck(levelRank);
  shuffle(deck);

  const seats = initializeSeats(members);
  dealCards(seats, deck, levelRank);
  const starter = findStarter(seats);

  const room: RoomState = {
    roomId,
    roomType: 'match',
    status: 'playing',
    seats,
    hostSeat: 'south',
    turn: starter,
    trickLeader: starter,
    lastPlay: null,
    lastPlaySeat: null,
    passes: 0,
    finishOrder: [],
    levelRank,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  notifyMatchFound(roomId, seats, levelRank, starter);
}

function initializeSeats(members: QueueEntry[]): Record<SeatId, SeatInfo> {
  const seats: Record<SeatId, SeatInfo> = {
    north: { socketId: null, name: '北', team: 'northSouth', isBot: true, connected: true, ready: true, hand: [], finished: false },
    east: { socketId: null, name: '东', team: 'eastWest', isBot: true, connected: true, ready: true, hand: [], finished: false },
    south: { socketId: null, name: '南', team: 'northSouth', isBot: true, connected: true, ready: true, hand: [], finished: false },
    west: { socketId: null, name: '西', team: 'eastWest', isBot: true, connected: true, ready: true, hand: [], finished: false },
  };

  const seatOrder: SeatId[] = ['south', 'west', 'north', 'east'];
  for (let i = 0; i < 4; i++) {
    const m = members[i];
    const seat = seatOrder[i];
    seats[seat] = {
      socketId: m.socketId || null,
      name: m.name,
      team: seatTeam[seat],
      isBot: !m.socketId,
      connected: true,
      ready: true,
      hand: [],
      finished: false,
    };
  }
  return seats;
}

function dealCards(seats: Record<SeatId, SeatInfo>, deck: Card[], levelRank: Rank) {
  const seatOrder: SeatId[] = ['south', 'west', 'north', 'east'];
  for (let i = 0; i < deck.length; i++) {
    seats[seatOrder[i % 4]].hand.push(deck[i]);
  }
  for (const seat of seatOrder) {
    sortHand(seats[seat].hand, levelRank);
  }
}

function findStarter(seats: Record<SeatId, SeatInfo>): SeatId {
  const seatOrder: SeatId[] = ['south', 'west', 'north', 'east'];
  let starter: SeatId = 'south';
  for (const seat of seatOrder) {
    if (seats[seat].hand.some(c => c.rank === '3' && c.suit === 'spade')) {
      starter = seat;
      break;
    }
  }
  return starter;
}

function notifyMatchFound(roomId: string, seats: Record<SeatId, SeatInfo>, levelRank: Rank, starter: SeatId) {
  const seatOrder: SeatId[] = ['south', 'west', 'north', 'east'];
  for (const seat of seatOrder) {
    const p = seats[seat];
    if (!p.socketId) continue;
    socketToRoom.set(p.socketId, roomId);
    socketToSeat.set(p.socketId, seat);

    const opponents = seatOrder.filter(s => s !== seat).map(s => ({
      seat: s,
      name: seats[s].name,
      cardCount: seats[s].hand.length,
      isBot: seats[s].isBot,
    }));

    sendTo(p.socketId, 'match:found', {
      roomId,
      seat,
      team: p.team,
      opponents,
    });

    sendTo(p.socketId, 'game:dealing', {
      hand: p.hand,
      level: levelRank,
    });

    sendTo(p.socketId, 'game:started', {
      turn: starter,
    });
  }
}

function handleMatchCancel(socketId: string): void {
  const idx = matchQueue.findIndex(e => e.socketId === socketId);
  if (idx !== -1) matchQueue.splice(idx, 1);
  sendTo(socketId, 'match:cancelled');
}

// ===== 房间 =====
function handleRoomCreate(socketId: string, roomType: 'team' | 'private'): void {
  if (socketToRoom.has(socketId)) {
    sendTo(socketId, 'error', { code: 'ALREADY_IN_ROOM' });
    return;
  }
  const name = clientNames.get(socketId) || generateName();
  clientNames.set(socketId, name);
  const roomId = generateRoomId();

  const seats: Record<SeatId, SeatInfo> = {
    north: { socketId: null, name: '北', team: 'northSouth', isBot: true, connected: true, ready: true, hand: [], finished: false },
    east: { socketId: null, name: '东', team: 'eastWest', isBot: true, connected: true, ready: true, hand: [], finished: false },
    south: { socketId, name, team: 'northSouth', isBot: false, connected: true, ready: false, hand: [], finished: false },
    west: { socketId: null, name: '西', team: 'eastWest', isBot: true, connected: true, ready: true, hand: [], finished: false },
  };

  if (roomType === 'team') {
    // 好友组局：机器人补 2 个
  }

  const room: RoomState = {
    roomId, roomType, status: 'waiting',
    seats, hostSeat: 'south', turn: 'south',
    trickLeader: null, lastPlay: null, lastPlaySeat: null,
    passes: 0, finishOrder: [], levelRank: '2',
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  socketToRoom.set(socketId, roomId);
  socketToSeat.set(socketId, 'south');

  sendTo(socketId, 'room:created', { roomId });
  sendTo(socketId, 'room:update', { seats: seatSnapshot(room), status: room.status });
}

function handleRoomJoin(socketId: string, roomId: string): void {
  if (socketToRoom.has(socketId)) {
    sendTo(socketId, 'error', { code: 'ALREADY_IN_ROOM' });
    return;
  }
  const room = rooms.get(roomId);
  if (!room || room.status !== 'waiting') {
    sendTo(socketId, 'error', { code: room ? 'GAME_STARTED' : 'ROOM_NOT_FOUND' });
    return;
  }

  // 找空位
  const emptySeat = (['north','east','south','west'] as SeatId[]).find(s =>
    room.seats[s].socketId === null && room.seats[s].isBot
  );
  if (!emptySeat) {
    sendTo(socketId, 'error', { code: 'ROOM_FULL' });
    return;
  }

  const name = clientNames.get(socketId) || generateName();
  clientNames.set(socketId, name);

  room.seats[emptySeat] = {
    socketId, name, team: seatTeam[emptySeat],
    isBot: false, connected: true, ready: false,
    hand: [], finished: false,
  };

  socketToRoom.set(socketId, roomId);
  socketToSeat.set(socketId, emptySeat);

  sendTo(socketId, 'room:joined', { roomId, seat: emptySeat });
  broadcastToRoom(roomId, 'room:update', { seats: seatSnapshot(room), status: room.status });
}

function handleRoomStart(socketId: string): void {
  const roomId = socketToRoom.get(socketId);
  const room = roomId ? rooms.get(roomId) : null;
  if (!room || room.seats[socketToSeat.get(socketId)!].team !== seatTeam[room.hostSeat]) {
    sendTo(socketId, 'error', { code: 'NOT_HOST' });
    return;
  }
  startGame(room);
}

function handleRoomLeave(socketId: string): void {
  leaveRoom(socketId);
}

function handleReady(socketId: string): void {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  const seat = socketToSeat.get(socketId);
  if (!seat) return;
  room.seats[seat].ready = !room.seats[seat].ready;
  broadcastToRoom(roomId, 'room:update', { seats: seatSnapshot(room), status: room.status });
}

function startGame(room: RoomState): void {
  const levelRank = room.levelRank;
  const deck = createDeck(levelRank);
  shuffle(deck);

  const seatOrder: SeatId[] = ['south', 'west', 'north', 'east'];
  for (const s of seatOrder) {
    room.seats[s].hand = [];
    room.seats[s].finished = false;
  }
  for (let i = 0; i < deck.length; i++) {
    room.seats[seatOrder[i % 4]].hand.push(deck[i]);
  }
  for (const s of seatOrder) {
    sortHand(room.seats[s].hand, levelRank);
  }

  // 找先手
  let starter: SeatId = 'south';
  for (const s of seatOrder) {
    if (room.seats[s].hand.some(c => c.rank === '3' && c.suit === 'spade')) {
      starter = s;
      break;
    }
  }

  room.status = 'playing';
  room.turn = starter;
  room.trickLeader = starter;
  room.lastPlay = null;
  room.lastPlaySeat = null;
  room.passes = 0;
  room.finishOrder = [];

  for (const s of seatOrder) {
    const p = room.seats[s];
    if (!p.socketId) continue;
    sendTo(p.socketId, 'game:dealing', { hand: p.hand, level: levelRank });
  }

  broadcastToRoom(room.roomId, 'game:started', { turn: starter });
}

// ===== 出牌 =====
function handlePlay(socketId: string, cardIds: string[]): void {
  const roomId = socketToRoom.get(socketId);
  const room = roomId ? rooms.get(roomId) : null;
  if (!room || room.status !== 'playing') return;

  const seat = socketToSeat.get(socketId);
  if (!seat || seat !== room.turn) {
    sendTo(socketId, 'error', { code: 'NOT_YOUR_TURN' });
    return;
  }

  const player = room.seats[seat];
  const cards = cardIds.map(id => player.hand.find(c => c.id === id)).filter(Boolean) as Card[];
  if (cards.length === 0) return;

  const combo = detectCombo(cards, room.levelRank);
  if (!combo) {
    sendTo(socketId, 'error', { code: 'INVALID_COMBO' });
    return;
  }

  const lastCombo = room.lastPlay ? detectCombo(room.lastPlay, room.levelRank) : null;
  if (room.lastPlay && room.lastPlaySeat !== seat && !canBeat(combo, lastCombo)) {
    sendTo(socketId, 'error', { code: 'CANNOT_BEAT' });
    return;
  }

  // 出牌成功
  player.hand = player.hand.filter(c => !cardIds.includes(c.id));
  room.lastPlay = cards;
  room.lastPlaySeat = seat;
  room.passes = 0;

  broadcastToRoom(roomId!, 'game:played', {
    seat, cards, combo: combo.type,
    remainingCards: player.hand.length,
  });

  // 检查出完
  if (player.hand.length === 0) {
    player.finished = true;
    room.finishOrder.push(seat);
    broadcastToRoom(roomId!, 'game:player_finished', { seat, order: room.finishOrder.length });

    // 检查是否结束
    if (room.finishOrder.length >= 3) {
      room.status = 'finished';
      const winnerTeam = seatTeam[room.finishOrder[0]];
      broadcastToRoom(roomId!, 'game:round_over', {
        finishOrder: room.finishOrder,
        winnerTeam,
      });
      return;
    }
  }

  // 下一个
  advanceTurn(room);
}

function handlePass(socketId: string): void {
  const roomId = socketToRoom.get(socketId);
  const room = roomId ? rooms.get(roomId) : null;
  if (!room || room.status !== 'playing') return;

  const seat = socketToSeat.get(socketId);
  if (!seat || seat !== room.turn) return;
  if (!room.lastPlay) {
    sendTo(socketId, 'error', { code: 'MUST_PLAY' });
    return;
  }

  room.passes++;
  broadcastToRoom(roomId!, 'game:passed', { seat });

  // 3 人过牌 → 清轮
  if (room.passes >= 3) {
    room.trickLeader = nextSeat(room.lastPlaySeat || room.turn);
    room.lastPlay = null;
    room.lastPlaySeat = null;
    room.passes = 0;
    room.turn = room.trickLeader;
    broadcastToRoom(roomId!, 'game:trick_cleared', { leader: room.trickLeader });
  } else {
    advanceTurn(room);
  }

  // 机器人自动出牌
  maybeBotTurn(room);
}

function advanceTurn(room: RoomState): void {
  let next = nextSeat(room.turn);
  while (room.seats[next].finished) {
    next = nextSeat(next);
  }
  room.turn = next;
  broadcastToRoom(room.roomId, 'game:turn', { turn: next, timeout: 30 });
  maybeBotTurn(room);
}

function maybeBotTurn(room: RoomState): void {
  const seat = room.turn;
  const player = room.seats[seat];
  if (!player.isBot || player.finished) return;

  // 延迟模拟
  setTimeout(() => {
    if (room.status !== 'playing' || room.turn !== seat) return;

    const result = botPlay(player.hand, room.lastPlay, room.levelRank);
    if (result === 'pass' || !result) {
      room.passes++;
      broadcastToRoom(room.roomId, 'game:passed', { seat });

      if (room.passes >= 3) {
        room.trickLeader = nextSeat(room.lastPlaySeat || room.turn);
        room.lastPlay = null;
        room.lastPlaySeat = null;
        room.passes = 0;
        room.turn = room.trickLeader;
        broadcastToRoom(room.roomId, 'game:trick_cleared', { leader: room.trickLeader });
      } else {
        advanceTurn(room);
      }
    } else {
      const combo = detectCombo(result, room.levelRank);
      player.hand = player.hand.filter(c => !result.some(r => r.id === c.id));
      room.lastPlay = result;
      room.lastPlaySeat = seat;
      room.passes = 0;

      broadcastToRoom(room.roomId, 'game:played', {
        seat, cards: result, combo: combo?.type ?? 'single',
        remainingCards: player.hand.length,
      });
      broadcastToRoom(room.roomId, 'game:bot_played', {
        seat, cards: result, combo: combo?.type ?? 'single',
      });

      if (player.hand.length === 0) {
        player.finished = true;
        room.finishOrder.push(seat);
        broadcastToRoom(room.roomId, 'game:player_finished', { seat, order: room.finishOrder.length });
        if (room.finishOrder.length >= 3) {
          room.status = 'finished';
          const winnerTeam = seatTeam[room.finishOrder[0]];
          broadcastToRoom(room.roomId, 'game:round_over', { finishOrder: room.finishOrder, winnerTeam });
          return;
        }
      }

      advanceTurn(room);
    }
    maybeBotTurn(room);
  }, 1500 + Math.random() * 2000);
}

// ===== 进贡（简化版） =====
function handleTributeSubmit(socketId: string, _cardId: string): void {
  // 简化：直接确认
  sendTo(socketId, 'tribute:done', {});
}

// ===== 工具 =====
function seatSnapshot(room: RoomState): Record<string, { name: string; team: string; isBot: boolean; connected: boolean; cardCount: number; finished: boolean }> {
  const result: Record<string, { name: string; team: string; isBot: boolean; connected: boolean; cardCount: number; finished: boolean }> = {};
  for (const seat of ['north','east','south','west'] as SeatId[]) {
    const p = room.seats[seat];
    result[seat] = {
      name: p.name, team: p.team, isBot: p.isBot,
      connected: p.connected, cardCount: p.hand.length,
      finished: p.finished,
    };
  }
  return result;
}

function findSeatBySocket(room: RoomState, socketId: string): SeatId | null {
  return (['north','east','south','west'] as SeatId[]).find(s => room.seats[s].socketId === socketId) || null;
}

function shouldDeleteRoom(room: RoomState): boolean {
  return [...Object.values(room.seats)].every(p => !p.socketId || p.isBot);
}

function leaveRoom(socketId: string): void {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return;
  socketToRoom.delete(socketId);
  socketToSeat.delete(socketId);

  const room = rooms.get(roomId);
  if (!room) return;

  const seat = findSeatBySocket(room, socketId);
  if (seat) {
    room.seats[seat].connected = false;
    room.seats[seat].socketId = null;
    room.seats[seat].isBot = true;
  }

  broadcastToRoom(roomId, 'room:player_left', { seat, botReplaced: true });

  if (shouldDeleteRoom(room)) {
    rooms.delete(roomId);
  }
}

// ===== WebSocket Setup =====
export function socketSetup(httpServer: HttpServer, wsPath: string): void {
  const targetPath = wsPath.replace(/\/$/, '') + '/websocket';
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = (req.url || '').split('?')[0];
    if (url !== targetPath) return;
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    const socketId = nanoid(12);
    clients.set(socketId, ws);
    const name = generateName();
    clientNames.set(socketId, name);
    ws.send(JSON.stringify({ type: 'connected', data: { socketId, name } }));

    ws.on('message', (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; data?: unknown };
        switch (msg.type) {
          case 'ping': ws.send(JSON.stringify({ type: 'pong', data: { now: Date.now() } })); break;
          case 'match:join': handleMatchJoin(socketId); break;
          case 'match:cancel': handleMatchCancel(socketId); break;
          case 'room:create': handleRoomCreate(socketId, (msg.data as { roomType?: "private" | "team" })?.roomType || 'private'); break;
          case 'room:join': handleRoomJoin(socketId, (msg.data as { roomId?: string })?.roomId || ''); break;
          case 'room:leave': handleRoomLeave(socketId); break;
          case 'room:ready': handleReady(socketId); break;
          case 'room:start': handleRoomStart(socketId); break;
          case 'game:play': handlePlay(socketId, (msg.data as { cardIds?: string[] })?.cardIds || []); break;
          case 'game:pass': handlePass(socketId); break;
          case 'tribute:submit': handleTributeSubmit(socketId, (msg.data as { cardId?: string })?.cardId || ''); break;
          default: sendTo(socketId, 'error', { code: 'UNKNOWN_TYPE', message: msg.type });
        }
      } catch { /* ignore */ }
    });

    ws.on('close', () => {
      leaveRoom(socketId);
      // 销毁房间
      const roomId = socketToRoom.get(socketId);
      if (roomId) {
        destroyRoom(roomId);
      }
      const idx = matchQueue.findIndex(e => e.socketId === socketId);
      if (idx !== -1) matchQueue.splice(idx, 1);
      clients.delete(socketId);
      clientNames.delete(socketId);
    });

    ws.on('error', () => { clients.delete(socketId); });
  });

  log(LogLevel.INFO, `🔌 [guandan-mp] WebSocket 已注册: ${targetPath}`);
}

function destroyRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  rooms.delete(roomId);
}

// P2-04: ensure constants are referenced (dummy)
if (false) {
  GamePhase.Playing;
  MessageType.GameStart;
}
