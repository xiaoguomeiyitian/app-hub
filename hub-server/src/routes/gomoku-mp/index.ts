import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';

export const description = '五子棋联机';
export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gomoku-mp', rooms: rooms.size, clients: clients.size });
});

// ===== 类型 =====
type Color = 'black' | 'white';
type RoomType = 'match' | 'private';
type RoomStatus = 'waiting' | 'playing' | 'finished';

interface PlayerInfo {
  socketId: string;
  name: string;
  color: Color;
  connected: boolean;
}

interface RoomState {
  roomId: string;
  roomType: RoomType;
  status: RoomStatus;
  players: PlayerInfo[];
  hostSocketId: string;
  board: number[][];
  turn: Color;
  winner: Color | 'draw' | null;
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

function broadcastToRoom(roomId: string, type: string, data?: unknown): void {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const p of room.players) {
    if (p.connected) sendTo(p.socketId, type, data);
  }
}

function createEmptyBoard(): number[][] {
  return Array.from({ length: 15 }, () => Array(15).fill(0));
}

function generateRoomId(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateName(): string {
  const adj = ['快乐', '聪明', '冷静', '热血', '神秘', '温柔', '勇敢', '安静'];
  const noun = ['棋手', '棋王', '棋圣', '棋仙', '棋神', '棋魂', '棋侠', '棋魔'];
  return adj[Math.floor(Math.random() * adj.length)] + noun[Math.floor(Math.random() * noun.length)];
}

function findRoomBySocket(socketId: string): RoomState | null {
  const roomId = socketToRoom.get(socketId);
  return roomId ? rooms.get(roomId) ?? null : null;
}

function findPlayer(room: RoomState, socketId: string): PlayerInfo | undefined {
  return room.players.find(p => p.socketId === socketId);
}

// ===== 胜负检测 =====
function checkWin(board: number[][], row: number, col: number, color: number): boolean {
  const directions: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    let count = 1;
    for (let sign = -1; sign <= 1; sign += 2) {
      for (let i = 1; i < 5; i++) {
        const r = row + dr * i * sign;
        const c = col + dc * i * sign;
        if (r < 0 || r >= 15 || c < 0 || c >= 15 || board[r][c] !== color) break;
        count++;
      }
    }
    if (count >= 5) return true;
  }
  return false;
}

function isBoardFull(board: number[][]): boolean {
  return board.every(row => row.every(cell => cell !== 0));
}

// ===== 落子校验 + 处理 =====
function handlePlace(socketId: string, row: number, col: number): void {
  const room = findRoomBySocket(socketId);
  if (!room) {
    sendTo(socketId, 'error', { code: 'NO_ROOM', message: '不在房间中' });
    return;
  }

  if (room.status !== 'playing') {
    sendTo(socketId, 'error', { code: 'GAME_NOT_PLAYING', message: '游戏未开始' });
    return;
  }

  const player = findPlayer(room, socketId);
  if (!player || player.color !== room.turn) {
    sendTo(socketId, 'error', { code: 'NOT_YOUR_TURN', message: '不是你的回合' });
    return;
  }

  if (row < 0 || row >= 15 || col < 0 || col >= 15) {
    sendTo(socketId, 'error', { code: 'OUT_OF_BOUNDS', message: '超出棋盘范围' });
    return;
  }

  if (room.board[row][col] !== 0) {
    sendTo(socketId, 'error', { code: 'POSITION_OCCUPIED', message: '该位置已有棋子' });
    return;
  }

  // 落子
  const colorNum = player.color === 'black' ? 1 : 2;
  room.board[row][col] = colorNum;

  // 检查胜负
  if (checkWin(room.board, row, col, colorNum)) {
    room.status = 'finished';
    room.winner = player.color;
    broadcastToRoom(room.roomId, 'game:moved', { row, col, color: player.color });
    broadcastToRoom(room.roomId, 'game:over', { winner: player.color, reason: 'FIVE_IN_ROW' });
  } else if (isBoardFull(room.board)) {
    room.status = 'finished';
    room.winner = 'draw';
    broadcastToRoom(room.roomId, 'game:moved', { row, col, color: player.color });
    broadcastToRoom(room.roomId, 'game:over', { winner: 'draw', reason: 'BOARD_FULL' });
  } else {
    room.turn = room.turn === 'black' ? 'white' : 'black';
    broadcastToRoom(room.roomId, 'game:moved', { row, col, color: player.color });
    broadcastToRoom(room.roomId, 'game:turn', { turn: room.turn });
  }
}

// ===== 匹配 =====
function handleMatchJoin(socketId: string): void {
  // 已在队列中
  if (matchQueue.some(e => e.socketId === socketId)) {
    sendTo(socketId, 'match:queued');
    return;
  }

  // 已在房间中
  if (socketToRoom.has(socketId)) {
    sendTo(socketId, 'error', { code: 'ALREADY_IN_ROOM', message: '已在房间中' });
    return;
  }

  const name = clientNames.get(socketId) || generateName();
  clientNames.set(socketId, name);

  // 尝试匹配
  const waiting = matchQueue.find(e => e.socketId !== socketId);
  if (waiting) {
    // 匹配成功
    matchQueue.splice(matchQueue.indexOf(waiting), 1);
    const roomId = generateRoomId();
    const isBlack = Math.random() < 0.5;

    const room: RoomState = {
      roomId,
      roomType: 'match',
      status: 'playing',
      players: [
        { socketId: waiting.socketId, name: waiting.name, color: isBlack ? 'black' : 'white', connected: true },
        { socketId, name, color: isBlack ? 'white' : 'black', connected: true },
      ],
      hostSocketId: waiting.socketId,
      board: createEmptyBoard(),
      turn: 'black',
      winner: null,
      createdAt: Date.now(),
    };

    rooms.set(roomId, room);
    socketToRoom.set(waiting.socketId, roomId);
    socketToRoom.set(socketId, roomId);

    // 通知双方
    sendTo(waiting.socketId, 'match:found', {
      roomId,
      yourColor: room.players[0].color,
      opponent: { name: room.players[1].name },
    });
    sendTo(socketId, 'match:found', {
      roomId,
      yourColor: room.players[1].color,
      opponent: { name: room.players[0].name },
    });

    // 直接开始
    sendTo(waiting.socketId, 'game:started', { turn: 'black', board: room.board });
    sendTo(socketId, 'game:started', { turn: 'black', board: room.board });
  } else {
    // 加入队列
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
    sendTo(socketId, 'error', { code: 'ALREADY_IN_ROOM', message: '已在房间中' });
    return;
  }

  const name = clientNames.get(socketId) || generateName();
  clientNames.set(socketId, name);
  const roomId = generateRoomId();

  const room: RoomState = {
    roomId,
    roomType: 'private',
    status: 'waiting',
    players: [{ socketId, name, color: 'black', connected: true }],
    hostSocketId: socketId,
    board: createEmptyBoard(),
    turn: 'black',
    winner: null,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  socketToRoom.set(socketId, roomId);
  sendTo(socketId, 'room:created', { roomId });
  sendTo(socketId, 'room:update', { players: room.players, status: room.status });
}

function handleRoomJoin(socketId: string, roomId: string): void {
  if (socketToRoom.has(socketId)) {
    sendTo(socketId, 'error', { code: 'ALREADY_IN_ROOM', message: '已在房间中' });
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    sendTo(socketId, 'error', { code: 'ROOM_NOT_FOUND', message: '房间不存在' });
    return;
  }

  if (room.players.length >= 2) {
    sendTo(socketId, 'error', { code: 'ROOM_FULL', message: '房间已满' });
    return;
  }

  if (room.status !== 'waiting') {
    sendTo(socketId, 'error', { code: 'GAME_ALREADY_STARTED', message: '游戏已开始' });
    return;
  }

  const name = clientNames.get(socketId) || generateName();
  clientNames.set(socketId, name);

  room.players.push({ socketId, name, color: 'white', connected: true });
  socketToRoom.set(socketId, roomId);

  sendTo(socketId, 'room:joined', { roomId, players: room.players });
  broadcastToRoom(roomId, 'room:update', { players: room.players, status: room.status });
}

function handleRoomStart(socketId: string): void {
  const room = findRoomBySocket(socketId);
  if (!room) {
    sendTo(socketId, 'error', { code: 'NO_ROOM', message: '不在房间中' });
    return;
  }

  if (room.hostSocketId !== socketId) {
    sendTo(socketId, 'error', { code: 'NOT_HOST', message: '只有房主能开始游戏' });
    return;
  }

  if (room.players.length < 2) {
    sendTo(socketId, 'error', { code: 'NOT_ENOUGH_PLAYERS', message: '需要2个玩家' });
    return;
  }

  room.status = 'playing';
  room.board = createEmptyBoard();
  room.turn = 'black';
  room.winner = null;
  broadcastToRoom(room.roomId, 'game:started', { turn: 'black', board: room.board });
}

function handleRoomLeave(socketId: string): void {
  leaveRoom(socketId);
}

function leaveRoom(socketId: string): void {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return;

  const room = rooms.get(roomId);
  socketToRoom.delete(socketId);

  if (!room) return;

  const player = findPlayer(room, socketId);
  if (player) player.connected = false;

  // 通知对手
  const opponent = room.players.find(p => p.socketId !== socketId && p.connected);
  if (opponent) {
    sendTo(opponent.socketId, 'room:opponent_left');
  }

  // 清理房间
  if (room.players.every(p => !p.connected)) {
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
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', data: { now: Date.now() } }));
            break;
          case 'match:join':
            handleMatchJoin(socketId);
            break;
          case 'match:cancel':
            handleMatchCancel(socketId);
            break;
          case 'room:create':
            handleRoomCreate(socketId);
            break;
          case 'room:join': {
            const data = msg.data as { roomId?: string };
            handleRoomJoin(socketId, data.roomId || '');
            break;
          }
          case 'room:leave':
            handleRoomLeave(socketId);
            break;
          case 'room:start':
            handleRoomStart(socketId);
            break;
          case 'game:place': {
            const data = msg.data as { row?: number; col?: number };
            handlePlace(socketId, data.row || 0, data.col || 0);
            break;
          }
          default:
            sendTo(socketId, 'error', { code: 'UNKNOWN_TYPE', message: `未知消息: ${msg.type}` });
        }
      } catch (e) {
        log(LogLevel.ERROR,'[gomoku-mp] 消息解析错误:', e);
      }
    });

    ws.on('close', () => {
      leaveRoom(socketId);
      // 清理匹配队列
      const idx = matchQueue.findIndex(e => e.socketId === socketId);
      if (idx !== -1) matchQueue.splice(idx, 1);
      clients.delete(socketId);
      clientNames.delete(socketId);
    });

    ws.on('error', () => {
      clients.delete(socketId);
    });
  });

  log(LogLevel.INFO, `🔌 [gomoku-mp] WebSocket 已注册: ${targetPath}`);
}
