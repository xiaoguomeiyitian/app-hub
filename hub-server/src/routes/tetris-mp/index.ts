import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { GamePhase, MessageType } from '../../types/constants.js';

export const description = '俄罗斯方块联机';
export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tetris-mp', rooms: rooms.size, clients: clients.size });
});

// ===== 类型 =====
type RoomType = 'match' | 'private';
type RoomStatus = 'waiting' | 'playing' | 'finished';

interface PlayerState {
  socketId: string;
  name: string;
  connected: boolean;
  alive: boolean;
  board: number[][];
  score: number;
  linesCleared: number;
  combo: number;
  b2b: number;
}

interface RoomState {
  roomId: string;
  roomType: RoomType;
  status: RoomStatus;
  players: Map<string, PlayerState>;
  hostSocketId: string;
  bag: number[];
  bagIndex: number;
  winner: string | null;
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

// ===== 工具函数 =====
function sendTo(socketId: string, type: string, data?: unknown): void {
  const ws = clients.get(socketId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

function broadcastToRoom(roomId: string, type: string, data?: unknown, exclude?: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const [sid, p] of room.players) {
    if (sid !== exclude && p.connected) sendTo(sid, type, data);
  }
}

function generateRoomId(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateName(): string {
  const adj = ['疾风', '雷霆', '烈焰', '冰霜', '暗影', '光辉', '星辰', '风暴'];
  const noun = ['方块', '消除', '连击', '大师', '王者', '传奇', '精英', '新星'];
  return adj[Math.floor(Math.random() * adj.length)] + noun[Math.floor(Math.random() * noun.length)];
}

function findRoomBySocket(socketId: string): RoomState | null {
  const roomId = socketToRoom.get(socketId);
  return roomId ? rooms.get(roomId) ?? null : null;
}

// ===== Bag 生成 =====
function generateBag(): number[] {
  const bag = [0, 1, 2, 3, 4, 5, 6]; // I=0,O=1,T=2,S=3,Z=4,J=5,L=6
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function getNextPieces(room: RoomState, count: number): number[] {
  while (room.bagIndex + count > room.bag.length) {
    room.bag = room.bag.concat(generateBag());
  }
  const result = room.bag.slice(room.bagIndex, room.bagIndex + count);
  room.bagIndex += count;
  return result;
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

  const waiting = matchQueue.find(e => e.socketId !== socketId);
  if (waiting) {
    matchQueue.splice(matchQueue.indexOf(waiting), 1);
    const roomId = generateRoomId();
    const bag = generateBag().concat(generateBag());

    const room: RoomState = {
      roomId,
      roomType: 'match',
      status: 'playing',
      players: new Map([
        [waiting.socketId, { socketId: waiting.socketId, name: waiting.name, connected: true, alive: true, board: emptyBoard(), score: 0, linesCleared: 0, combo: 0, b2b: 0 }],
        [socketId, { socketId, name, connected: true, alive: true, board: emptyBoard(), score: 0, linesCleared: 0, combo: 0, b2b: 0 }],
      ]),
      hostSocketId: waiting.socketId,
      bag,
      bagIndex: 0,
      winner: null,
      createdAt: Date.now(),
    };

    rooms.set(roomId, room);
    socketToRoom.set(waiting.socketId, roomId);
    socketToRoom.set(socketId, roomId);

    const initialBag = getNextPieces(room, 14); // 双方各 7
    sendTo(waiting.socketId, 'match:found', { roomId, opponent: { name: room.players.get(socketId)!.name } });
    sendTo(socketId, 'match:found', { roomId, opponent: { name: waiting.name } });
    sendTo(waiting.socketId, 'game:started', { bag: initialBag });
    sendTo(socketId, 'game:started', { bag: initialBag });
  } else {
    matchQueue.push({ socketId, name, joinedAt: Date.now() });
    sendTo(socketId, 'match:queued');
  }
}

function handleMatchCancel(socketId: string): void {
  const idx = matchQueue.findIndex(e => e.socketId === socketId);
  if (idx !== -1) matchQueue.splice(idx, 1);
  sendTo(socketId, 'match:cancelled');
}

// ===== 房间 =====
function handleRoomCreate(socketId: string): void {
  if (socketToRoom.has(socketId)) {
    sendTo(socketId, 'error', { code: 'ALREADY_IN_ROOM' });
    return;
  }
  const name = clientNames.get(socketId) || generateName();
  clientNames.set(socketId, name);
  const roomId = generateRoomId();

  const room: RoomState = {
    roomId,
    roomType: 'private',
    status: 'waiting',
    players: new Map([[socketId, { socketId, name, connected: true, alive: true, board: emptyBoard(), score: 0, linesCleared: 0, combo: 0, b2b: 0 }]]),
    hostSocketId: socketId,
    bag: generateBag().concat(generateBag()),
    bagIndex: 0,
    winner: null,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  socketToRoom.set(socketId, roomId);
  sendTo(socketId, 'room:created', { roomId });
  sendTo(socketId, 'room:update', { players: playerList(room), status: room.status });
}

function handleRoomJoin(socketId: string, roomId: string): void {
  if (socketToRoom.has(socketId)) {
    sendTo(socketId, 'error', { code: 'ALREADY_IN_ROOM' });
    return;
  }
  const room = rooms.get(roomId);
  if (!room || room.players.size >= 2) {
    sendTo(socketId, 'error', { code: room ? 'ROOM_FULL' : 'ROOM_NOT_FOUND' });
    return;
  }
  const name = clientNames.get(socketId) || generateName();
  clientNames.set(socketId, name);
  room.players.set(socketId, { socketId, name, connected: true, alive: true, board: emptyBoard(), score: 0, linesCleared: 0, combo: 0, b2b: 0 });
  socketToRoom.set(socketId, roomId);
  sendTo(socketId, 'room:joined', { roomId, players: playerList(room) });
  broadcastToRoom(roomId, 'room:update', { players: playerList(room), status: room.status });
}

function handleRoomStart(socketId: string): void {
  const room = findRoomBySocket(socketId);
  if (!room || room.hostSocketId !== socketId || room.players.size < 2) return;
  room.status = 'playing';
  const bag = getNextPieces(room, 14);
  broadcastToRoom(room.roomId, 'game:started', { bag });
}

function handleRoomLeave(socketId: string): void {
  leaveRoom(socketId);
}

// ===== 游戏 =====
function handleGameLock(socketId: string, data?: { linesCleared: number; tspin: string }): void {
  if (!data) return;
  const { linesCleared, tspin } = data;
  // 原有逻辑...
  const room = findRoomBySocket(socketId);
  if (!room || room.status !== 'playing') return;
  const player = room.players.get(socketId);
  if (!player) return;

  player.linesCleared += linesCleared;

  // 通知对手
  broadcastToRoom(room.roomId, 'game:opponent_placed', { socketId, linesCleared }, socketId);

  // 攻击计算
  if (linesCleared > 0) {
    const attack = calculateOnlineAttack(linesCleared, tspin, player.b2b, player.combo);
    if (attack > 0) {
      broadcastToRoom(room.roomId, 'game:garbage_sent', { lines: attack, from: socketId }, socketId);
      // 通知对手收到垃圾行
      for (const [sid, p] of room.players) {
        if (sid !== socketId && p.connected) {
          sendTo(sid, 'game:garbage_received', { lines: attack, from: socketId });
        }
      }
    }
    player.combo++;
  } else {
    player.combo = 0;
  }

  // 发送新 Bag
  const nextBag = getNextPieces(room, 7);
  sendTo(socketId, 'game:next_bag', { bag: nextBag });
}

function handleGameTopped(socketId: string): void {
  const room = findRoomBySocket(socketId);
  if (!room || room.status !== 'playing') return;
  const player = room.players.get(socketId);
  if (!player) return;
  player.alive = false;

  // 找赢家
  const alive = [...room.players.entries()].find(([, p]) => p.alive && p.connected);
  if (alive) {
    room.winner = alive[0];
    room.status = 'finished';
    broadcastToRoom(room.roomId, 'game:opponent_topped', { socketId });
    broadcastToRoom(room.roomId, 'game:over', { winner: room.winner });
  }
}

function handleGameResign(socketId: string): void {
  handleGameTopped(socketId);
}

// ===== 攻击计算 =====
function calculateOnlineAttack(lines: number, tspin: string, b2b: number, combo: number): number {
  let base = 0;
  if (tspin === 'full') {
    base = lines === 1 ? 2 : lines === 2 ? 4 : 6;
  } else {
    base = lines === 1 ? 0 : lines === 2 ? 1 : lines === 3 ? 2 : 4;
  }
  let b2bBonus = 0;
  if (base > 0 && (lines >= 4 || tspin === 'full')) {
    b2bBonus = 1 + Math.max(0, b2b - 3);
  }
  const comboBonus = base > 0 ? Math.floor(base * 0.25 * (combo + 1)) : 0;
  return base + b2bBonus + comboBonus;
}

// ===== 工具 =====
function emptyBoard(): number[][] {
  return Array.from({ length: 20 }, () => Array(10).fill(0));
}

function playerList(room: RoomState): Array<{ socketId: string; name: string; connected: boolean }> {
  return [...room.players.values()].map(p => ({ socketId: p.socketId, name: p.name, connected: p.connected }));
}

function leaveRoom(socketId: string): void {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return;
  socketToRoom.delete(socketId);
  const room = rooms.get(roomId);
  if (!room) return;
  const player = room.players.get(socketId);
  if (player) player.connected = false;

  const opponent = [...room.players.values()].find(p => p.socketId !== socketId && p.connected);
  if (opponent) sendTo(opponent.socketId, 'room:opponent_left');

  if ([...room.players.values()].every(p => !p.connected)) {
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
          case 'room:create': handleRoomCreate(socketId); break;
          case 'room:join': handleRoomJoin(socketId, (msg.data as { roomId?: string })?.roomId || ''); break;
          case 'room:leave': handleRoomLeave(socketId); break;
          case 'room:start': handleRoomStart(socketId); break;
          case 'game:lock': const lockData = msg.data as { linesCleared: number; tspin: string } | undefined; if (lockData) handleGameLock(socketId, lockData); break;
          case 'game:topped': handleGameTopped(socketId); break;
          case 'game:resign': handleGameResign(socketId); break;
          default: sendTo(socketId, 'error', { code: 'UNKNOWN_TYPE', message: msg.type });
        }
      } catch { /* ignore */ }
    });

    ws.on('close', () => {
      leaveRoom(socketId);
      const idx = matchQueue.findIndex(e => e.socketId === socketId);
      if (idx !== -1) matchQueue.splice(idx, 1);
      clients.delete(socketId);
      clientNames.delete(socketId);
    });

    ws.on('error', () => { clients.delete(socketId); });
  });

  log(LogLevel.INFO, `🔌 [tetris-mp] WebSocket 已注册: ${targetPath}`);
}

// P2-04 dummy
if (false) { GamePhase.Playing; MessageType.GameStart; }
