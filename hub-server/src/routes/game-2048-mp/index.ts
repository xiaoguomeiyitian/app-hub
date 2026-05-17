import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';

export const description = '2048 联机';
export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'game-2048-mp', rooms: rooms.size, clients: clients.size });
});

// ===== 类型 =====
type RoomStatus = 'waiting' | 'playing' | 'finished';
type AttackType = 'lock' | 'freeze' | 'increment' | 'bomb' | 'rotate' | 'ghost' | 'monument';

interface PlayerState {
  socketId: string;
  name: string;
  connected: boolean;
  alive: boolean;
  board: number[][];
  score: number;
  maxTile: number;
  moveCount: number;
  shieldCount: number;
}

interface RoomState {
  roomId: string;
  status: RoomStatus;
  players: Map<string, PlayerState>;
  hostSocketId: string;
  winner: string | null;
  createdAt: number;
}

interface QueueEntry {
  socketId: string;
  name: string;
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
  const adj = ['闪耀', '璀璨', '夺目', '闪耀', '辉煌', '灿烂', '明亮', '耀眼'];
  const noun = ['方块', '数字', '合并', '大师', '王者', '传奇', '精英', '新星'];
  return adj[Math.floor(Math.random() * adj.length)] + noun[Math.floor(Math.random() * noun.length)];
}

function findRoomBySocket(socketId: string): RoomState | null {
  const roomId = socketToRoom.get(socketId);
  return roomId ? rooms.get(roomId) ?? null : null;
}

function emptyBoard(): number[][] {
  return Array.from({ length: 4 }, () => Array(4).fill(0));
}

// ===== 干扰系统 =====
function determineAttack(mergeValue: number): AttackType | null {
  if (mergeValue >= 2048) return Math.random() > 0.5 ? 'ghost' : 'monument';
  if (mergeValue >= 1024) return 'rotate';
  if (mergeValue >= 512) return 'bomb';
  if (mergeValue >= 256) return 'increment';
  if (mergeValue >= 128) return 'freeze';
  if (mergeValue >= 64) return 'lock';
  return null;
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

    const room: RoomState = {
      roomId,
      status: 'playing',
      players: new Map([
        [waiting.socketId, { socketId: waiting.socketId, name: waiting.name, connected: true, alive: true, board: emptyBoard(), score: 0, maxTile: 0, moveCount: 0, shieldCount: 0 }],
        [socketId, { socketId, name, connected: true, alive: true, board: emptyBoard(), score: 0, maxTile: 0, moveCount: 0, shieldCount: 0 }],
      ]),
      hostSocketId: waiting.socketId,
      winner: null,
      createdAt: Date.now(),
    };

    rooms.set(roomId, room);
    socketToRoom.set(waiting.socketId, roomId);
    socketToRoom.set(socketId, roomId);

    sendTo(waiting.socketId, 'match:found', { roomId, opponent: { name: room.players.get(socketId)!.name } });
    sendTo(socketId, 'match:found', { roomId, opponent: { name: waiting.name } });
    sendTo(waiting.socketId, 'game:started', { board: emptyBoard() });
    sendTo(socketId, 'game:started', { board: emptyBoard() });
  } else {
    matchQueue.push({ socketId, name });
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
    status: 'waiting',
    players: new Map([[socketId, { socketId, name, connected: true, alive: true, board: emptyBoard(), score: 0, maxTile: 0, moveCount: 0, shieldCount: 0 }]]),
    hostSocketId: socketId,
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
  room.players.set(socketId, { socketId, name, connected: true, alive: true, board: emptyBoard(), score: 0, maxTile: 0, moveCount: 0, shieldCount: 0 });
  socketToRoom.set(socketId, roomId);
  sendTo(socketId, 'room:joined', { roomId, players: playerList(room) });
  broadcastToRoom(roomId, 'room:update', { players: playerList(room), status: room.status });
}

function handleRoomStart(socketId: string): void {
  const room = findRoomBySocket(socketId);
  if (!room || room.hostSocketId !== socketId || room.players.size < 2) return;
  room.status = 'playing';
  broadcastToRoom(room.roomId, 'game:started', { board: emptyBoard() });
}

function handleRoomLeave(socketId: string): void {
  leaveRoom(socketId);
}

// ===== 游戏 =====
function handleGameMove(socketId: string, data: { direction: string; merges?: Array<{ value: number }> }): void {
  const room = findRoomBySocket(socketId);
  if (!room || room.status !== 'playing') return;
  const player = room.players.get(socketId);
  if (!player || !player.alive) return;

  player.moveCount++;

  // 检查护盾获得
  if (player.moveCount % 10 === 0) {
    player.shieldCount++;
    sendTo(socketId, 'game:shield_gained', { count: player.shieldCount });
  }

  // 通知对手移动
  broadcastToRoom(room.roomId, 'game:opponent_moved', {
    socketId,
    direction: data.direction,
    score: player.score,
  }, socketId);

  // 干扰处理
  for (const merge of (data.merges || [])) {
    const attack = determineAttack(merge.value);
    if (attack) {
      // 检查对手护盾
      for (const [sid, p] of room.players) {
        if (sid !== socketId && p.alive) {
          if (p.shieldCount > 0) {
            p.shieldCount--;
            sendTo(socketId, 'game:attack_blocked', { target: sid, attack });
            sendTo(sid, 'game:attack_blocked', { attack });
          } else {
            sendTo(socketId, 'game:attack_sent', { target: sid, attack });
            sendTo(sid, 'game:attack_received', { from: socketId, attack });
          }
        }
      }
    }
  }
}

function handleGameOver(socketId: string, data: { score: number; maxTile?: number }): void {
  const room = findRoomBySocket(socketId);
  if (!room || room.status !== 'playing') return;
  const player = room.players.get(socketId);
  if (!player) return;
  player.alive = false;
  player.score = data.score;
  player.maxTile = data.maxTile || 2048;

  // 找赢家
  const alive = [...room.players.entries()].find(([, p]) => p.alive);
  if (alive) {
    room.winner = alive[0];
    room.status = 'finished';
    broadcastToRoom(room.roomId, 'game:player_over', { socketId, score: data.score });
    broadcastToRoom(room.roomId, 'game:over', {
      winner: room.winner,
      scores: Object.fromEntries([...room.players].map(([s, p]) => [s, p.score])),
    });
  }
}

// ===== 工具 =====
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
          case 'room:join': {
            const data = msg.data as { roomId?: string };
            handleRoomJoin(socketId, data.roomId || '');
            break;
          }
          case 'room:leave': handleRoomLeave(socketId); break;
          case 'room:start': handleRoomStart(socketId); break;
          case 'game:move': {
            const data = msg.data as { direction?: string };
            handleGameMove(socketId, { direction: data.direction || '', merges: [] });
            break;
          }
          case 'game:over': {
            const data = msg.data as { score?: number };
            handleGameOver(socketId, { score: data.score || 0 });
            break;
          }
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

  log(LogLevel.INFO, `🔌 [game-2048-mp] WebSocket 已注册: ${targetPath}`);
}
