import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { randomUUID } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { GamePhase, MessageType } from '../../types/constants.js';
import { log, LogLevel } from '../../logger.js';

export const description = '贪吃蛇联机最小可用服务';
export const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'snake-mp', websocket: '/api/snake-mp/websocket' });
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'snake-mp' });
});

type SnakeDir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type RoomPhase = 'waiting' | 'countdown' | 'playing' | 'ended';
type PlayerRole = 'player' | 'bot';

type Player = {
  playerId: string;
  socketId: string | null;
  token: string;
  nickname: string;
  role: PlayerRole;
  ready: boolean;
  connected: boolean;
  color: 'red' | 'blue';
  direction: SnakeDir;
  score: number;
  alive: boolean;
  body: Array<{ x: number; y: number }>;
};

type Room = {
  roomId: string;
  phase: RoomPhase;
  createdAt: number;
  updatedAt: number;
  players: Player[];
  foods: Array<{ x: number; y: number }>;
  tick: number;
  countdownEndsAt: number | null;
  winner: string | null;
  endTimer: ReturnType<typeof setTimeout> | null;
  tickTimer: ReturnType<typeof setInterval> | null;
  botTimer: ReturnType<typeof setTimeout> | null;
};

type Client = {
  socketId: string;
  ws: WebSocket;
  roomId: string | null;
  playerId: string | null;
  token: string | null;
  nickname: string;
  queueing: boolean;
};

type QueueEntry = {
  socketId: string;
  nickname: string;
  roomId: string;
  joinedAt: number;
};

const clients = new Map<string, Client>();
const rooms = new Map<string, Room>();
const queue = new Map<string, QueueEntry>();
const queuedTimers = new Map<string, ReturnType<typeof setTimeout>>();
const roomByPlayerId = new Map<string, string>();
const socketToPlayerId = new Map<string, string>();
const BOT_TIMEOUT_MS = 10_000;
const AUTO_END_MS = 60_000;
const GRID_COLS = 40;
const GRID_ROWS = 25;
const TICK_MS = 120;

function id(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function snapshot(room: Room, message = '') {
  return {
    roomId: room.roomId,
    phase: room.phase,
    tick: room.tick,
    countdownEndsAt: room.countdownEndsAt,
    winnerPlayerId: room.winner,
    message,
    foods: room.foods.map((f) => ({ x: f.x, y: f.y })),
    players: room.players.map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      role: p.role,
      ready: p.ready,
      connected: p.connected,
      color: p.color,
      direction: p.direction,
      score: p.score,
      alive: p.alive,
      body: p.body.map((seg) => ({ x: seg.x, y: seg.y })),
    })),
  };
}

function getClient(socketId: string): Client | null {
  return clients.get(socketId) ?? null;
}

function getRoomBySocket(socketId: string): Room | null {
  const playerId = socketToPlayerId.get(socketId);
  if (!playerId) return null;
  const roomId = roomByPlayerId.get(playerId);
  if (!roomId) return null;
  return rooms.get(roomId) ?? null;
}

function getPlayer(room: Room, socketId: string): Player | null {
  return room.players.find((p) => p.socketId === socketId) ?? null;
}

function sendToSocket(socketId: string, type: string, data: unknown = {}): void {
  const client = clients.get(socketId);
  if (!client || client.ws.readyState !== WebSocket.OPEN) return;
  client.ws.send(JSON.stringify({ type, data }));
}

function broadcastRoom(room: Room, type: string, data: unknown): void {
  for (const player of room.players) {
    if (player.socketId) sendToSocket(player.socketId, type, data);
  }
}

function touch(room: Room): void {
  room.updatedAt = Date.now();
}

function isInsideGrid(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

function sameCell(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return a.x === b.x && a.y === b.y;
}

function dirDelta(dir: SnakeDir): { x: number; y: number } {
  switch (dir) {
    case 'UP': return { x: 0, y: -1 };
    case 'DOWN': return { x: 0, y: 1 };
    case 'LEFT': return { x: -1, y: 0 };
    case 'RIGHT': return { x: 1, y: 0 };
  }
}

function opposite(dir: SnakeDir): SnakeDir {
  switch (dir) {
    case 'UP': return 'DOWN';
    case 'DOWN': return 'UP';
    case 'LEFT': return 'RIGHT';
    case 'RIGHT': return 'LEFT';
  }
}

function occupied(room: Room, x: number, y: number): boolean {
  return room.players.some((p) => p.body.some((seg) => seg.x === x && seg.y === y));
}

function spawnFood(room: Room): void {
  const limit = GRID_COLS * GRID_ROWS * 2;
  for (let i = 0; i < limit; i++) {
    const x = Math.floor(Math.random() * GRID_COLS);
    const y = Math.floor(Math.random() * GRID_ROWS);
    if (!occupied(room, x, y) && !room.foods.some((f) => f.x === x && f.y === y)) {
      room.foods.push({ x, y });
      return;
    }
  }
  room.foods.push({ x: 1, y: 1 });
}

function clearRoomTimers(room: Room): void {
  if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
  if (room.tickTimer) { clearInterval(room.tickTimer); room.tickTimer = null; }
}

function endIfNeeded(room: Room): void {
  const alivePlayers = room.players.filter((p) => p.role === 'player' && p.alive);
  if (alivePlayers.length >= 1) return;
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  finishGame(room, sorted[0]?.playerId ?? null, 'no_alive');
}

function tickRoom(room: Room): void {
  if (room.phase !== 'playing') return;
  room.tick += 1;
  touch(room);

  const currentHeads = new Map<string, { x: number; y: number }>();
  const nextHeads = new Map<string, { x: number; y: number }>();
  const growPlayers = new Set<string>();

  for (const player of room.players) {
    if (!player.alive) continue;
    const head = player.body[0];
    if (!head) continue;
    currentHeads.set(player.playerId, head);
    const d = dirDelta(player.direction);
    const next = { x: head.x + d.x, y: head.y + d.y };
    nextHeads.set(player.playerId, next);
    if (room.foods.some((f) => sameCell(f, next))) growPlayers.add(player.playerId);
  }

  for (const player of room.players) {
    if (!player.alive) continue;
    const next = nextHeads.get(player.playerId);
    if (!next) continue;
    if (!isInsideGrid(next.x, next.y)) { player.alive = false; continue; }

    const bodyToCheck = player.body.slice(0, growPlayers.has(player.playerId) ? player.body.length : Math.max(0, player.body.length - 1));
    if (bodyToCheck.some((seg) => sameCell(seg, next))) {
      player.alive = false;
      continue;
    }
    for (const other of room.players) {
      if (!other.alive) continue;
      if (other.playerId === player.playerId) continue;
      if (other.body.some((seg) => sameCell(seg, next))) {
        player.alive = false;
        break;
      }
    }
  }

  for (const player of room.players) {
    if (!player.alive) continue;
    const next = nextHeads.get(player.playerId);
    if (!next) continue;
    player.body.unshift(next);
    if (growPlayers.has(player.playerId)) {
      player.score += 1;
      room.foods = room.foods.filter((f) => !sameCell(f, next));
    } else {
      player.body.pop();
    }
  }

  while (room.foods.length < 1) spawnFood(room);
  sendRoomState(room, '');
  endIfNeeded(room);
}

function persistClientJoin(socketId: string, room: Room, player: Player): void {
  const client = clients.get(socketId);
  if (!client) return;
  client.roomId = room.roomId;
  client.playerId = player.playerId;
  client.token = player.token;
  client.nickname = player.nickname;
  client.queueing = false;
  socketToPlayerId.set(socketId, player.playerId);
  roomByPlayerId.set(player.playerId, room.roomId);
}

function clearQueue(socketId: string): void {
  const timer = queuedTimers.get(socketId);
  if (timer) clearTimeout(timer);
  queuedTimers.delete(socketId);
  queue.delete(socketId);
  const client = clients.get(socketId);
  if (client) client.queueing = false;
}

function createRoom(ownerSocketId: string, nickname: string): Room {
  const roomId = id('room');
  const playerId = id('player');
  const token = id('tok');
  const room: Room = {
    roomId,
    phase: 'waiting',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: [{
      playerId,
      socketId: ownerSocketId,
      token,
      nickname,
      role: 'player',
      ready: false,
      connected: true,
      color: 'red',
      direction: 'RIGHT',
      score: 0,
      alive: true,
      body: [{ x: 5, y: 12 }, { x: 4, y: 12 }, { x: 3, y: 12 }],
    }],
    foods: [],
    tick: 0,
    countdownEndsAt: null,
    winner: null,
    endTimer: null,
    tickTimer: null,
    botTimer: null,
  };
  spawnFood(room);
  rooms.set(roomId, room);
  persistClientJoin(ownerSocketId, room, room.players[0]);
  return room;
}

function addSecondPlayer(room: Room, socketId: string, nickname: string): Player {
  const player: Player = {
    playerId: id('player'),
    socketId,
    token: id('tok'),
    nickname,
    role: 'player',
    ready: false,
    connected: true,
    color: 'blue',
    direction: 'LEFT',
    score: 0,
    alive: true,
    body: [{ x: 30, y: 12 }, { x: 31, y: 12 }, { x: 32, y: 12 }],
  };
  room.players.push(player);
  spawnFood(room);
  persistClientJoin(socketId, room, player);
  return player;
}

function addBot(room: Room): Player {
  const bot: Player = {
    playerId: id('bot'),
    socketId: null,
    token: id('tok'),
    nickname: '机器人',
    role: 'bot',
    ready: true,
    connected: true,
    color: 'blue',
    direction: 'LEFT',
    score: 0,
    alive: true,
    body: [{ x: 30, y: 12 }, { x: 31, y: 12 }, { x: 32, y: 12 }],
  };
  room.players.push(bot);
  spawnFood(room);
  return bot;
}

function sendRoomState(room: Room, message = ''): void {
  const data = snapshot(room, message);
  broadcastRoom(room, 'room_state', data);
  broadcastRoom(room, 'game_state', data);
}

function startGame(room: Room): void {
  if (room.phase === 'playing') return;
  room.phase = 'playing';
  room.tick = 0;
  room.countdownEndsAt = null;
  for (const player of room.players) {
    player.alive = true;
  }
  touch(room);
  if (room.endTimer) clearTimeout(room.endTimer);
  if (room.tickTimer) clearInterval(room.tickTimer);
  room.endTimer = setTimeout(() => {
    if (room.phase === 'playing') finishGame(room, null, 'timeout');
  }, AUTO_END_MS);
  room.tickTimer = setInterval(() => tickRoom(room), TICK_MS);
  const data = { room: snapshot(room, '对局开始') };
  broadcastRoom(room, 'game_start', data);
  sendRoomState(room, '对局开始');
}

function finishGame(room: Room, winner: string | null, reason: string): void {
  clearRoomTimers(room);
  room.phase = 'ended';
  room.winner = winner;
  touch(room);
  const payload = { room: snapshot(room, '对局结束'), winner, reason };
  broadcastRoom(room, 'game_over', payload);
  sendRoomState(room, '对局结束');
}

function maybeStart(room: Room): void {
  const active = room.players.filter((p) => p.role === 'player');
  if (room.phase !== 'waiting') return;
  if (active.length >= 2 && active.every((p) => p.ready)) {
    room.phase = 'countdown';
    room.countdownEndsAt = Date.now() + 1200;
    broadcastRoom(room, 'room_state', snapshot(room, '倒计时开始'));
    setTimeout(() => startGame(room), 1200);
  }
}

function queueMatch(socketId: string, nickname: string): void {
  const client = getClient(socketId);
  if (!client) return;
  client.nickname = nickname;
  client.queueing = true;
  if (queue.has(socketId)) return;

  let room: Room;
  const waiting = Array.from(queue.values());
  const partner = waiting[0];
  if (partner) {
    room = rooms.get(partner.roomId)!;
    clearQueue(partner.socketId);
    queue.delete(partner.socketId);
    const playerA = room.players[0];
    const playerB = addSecondPlayer(room, socketId, nickname);
    sendToSocket(partner.socketId, 'match_found', { room: snapshot(room, '匹配成功'), playerId: playerA.playerId, token: playerA.token, color: 'red' });
    sendToSocket(socketId, 'match_found', { room: snapshot(room, '匹配成功'), playerId: playerB.playerId, token: playerB.token, color: 'blue' });
    sendRoomState(room, '匹配成功');
    return;
  }

  room = createRoom(socketId, nickname);
  queue.set(socketId, { socketId, nickname, roomId: room.roomId, joinedAt: Date.now() });
  sendToSocket(socketId, 'match_queued', { position: 1 });
  sendRoomState(room, '等待对手');

  const timer = setTimeout(() => {
    const current = queue.get(socketId);
    const currentRoom = rooms.get(room.roomId);
    if (!current || !currentRoom || currentRoom.phase !== 'waiting') return;
    queue.delete(socketId);
    queuedTimers.delete(socketId);
    addBot(currentRoom);
    sendToSocket(socketId, 'match_bot_joined', { roomId: currentRoom.roomId, message: '机器人已加入' });
    sendToSocket(socketId, 'match_found', { room: snapshot(currentRoom, '机器人补位成功'), playerId: currentRoom.players[0].playerId, token: currentRoom.players[0].token, color: 'red' });
    sendRoomState(currentRoom, '机器人补位成功');
    maybeAutoStartWithBot(currentRoom);
  }, BOT_TIMEOUT_MS);
  queuedTimers.set(socketId, timer);
}

function maybeAutoStartWithBot(room: Room): void {
  const human = room.players.find((p) => p.role === 'player');
  if (!human) return;
  // 机器人补位后，允许前端直接点开始；也给一个自动开局的兜底
  setTimeout(() => {
    if (room.phase === 'waiting') startGame(room);
  }, 1500);
}

function handleCreateRoom(socketId: string, data?: unknown): void {
  const nickname = ((data as { nickname?: string })?.nickname || getClient(socketId)?.nickname || '玩家').trim();
  const room = createRoom(socketId, nickname);
  sendToSocket(socketId, 'room_joined', { roomId: room.roomId, playerId: room.players[0].playerId, token: room.players[0].token, room: snapshot(room, '房间已创建') });
  sendRoomState(room, '房间已创建');
}

function handleJoinRoom(socketId: string, data?: { roomId?: string; nickname?: string }): void {
  const room = data?.roomId ? rooms.get(data.roomId) : null;
  if (!room) {
    sendToSocket(socketId, 'error', { message: '房间不存在' });
    return;
  }
  const playerCount = room.players.filter((p) => p.role === 'player').length;
  if (playerCount >= 2) {
    sendToSocket(socketId, 'error', { message: '房间已满' });
    return;
  }
  const nickname = (data?.nickname || getClient(socketId)?.nickname || '玩家').trim();
  const player = addSecondPlayer(room, socketId, nickname);
  sendToSocket(socketId, 'room_joined', { roomId: room.roomId, playerId: player.playerId, token: player.token, room: snapshot(room, '已加入房间') });
  sendRoomState(room, '玩家加入房间');
}

function handleReconnect(socketId: string, data?: { roomId?: string; playerId?: string; token?: string }): void {
  if (!data?.roomId || !data?.playerId || !data?.token) return;
  const room = rooms.get(data.roomId);
  if (!room) return;
  const player = room.players.find((p) => p.playerId === data.playerId && p.token === data.token);
  if (!player) return;
  player.socketId = socketId;
  player.connected = true;
  persistClientJoin(socketId, room, player);
  sendToSocket(socketId, 'room_joined', { roomId: room.roomId, playerId: player.playerId, token: player.token, room: snapshot(room, '重连成功') });
  sendRoomState(room, '玩家重连');
}

function handleReady(socketId: string, ready: boolean): void {
  const room = getRoomBySocket(socketId);
  if (!room) return;
  const player = getPlayer(room, socketId);
  if (!player) return;
  player.ready = ready;
  sendRoomState(room, ready ? '已准备' : '取消准备');
  maybeStart(room);
}

function handleInput(socketId: string, dir?: SnakeDir): void {
  const room = getRoomBySocket(socketId);
  if (!room || room.phase !== 'playing' || !dir) return;
  const player = getPlayer(room, socketId);
  if (!player || player.role !== 'player') return;
  if (dir === opposite(player.direction)) return;
  player.direction = dir;
  sendRoomState(room, '方向已更新');
}

function handleCancelMatch(socketId: string): void {
  clearQueue(socketId);
  const client = getClient(socketId);
  if (client && client.roomId) {
    const room = rooms.get(client.roomId);
    if (room && room.phase === 'waiting' && room.players.length === 1) {
      rooms.delete(room.roomId);
    }
  }
  sendToSocket(socketId, 'match_cancelled', {});
}

function handleLeaveRoom(socketId: string): void {
  clearQueue(socketId);
  const room = getRoomBySocket(socketId);
  if (!room) return;
  const player = getPlayer(room, socketId);
  if (player) {
    player.connected = false;
    player.socketId = null;
    player.ready = false;
  }
  const activePlayers = room.players.filter((p) => p.role === 'player' && p.connected);
  if (room.phase === 'playing' && activePlayers.length <= 1) {
    finishGame(room, activePlayers[0]?.nickname ?? null, 'leave');
  }
  if (activePlayers.length === 0) rooms.delete(room.roomId);
  else sendRoomState(room, '玩家离开');
}

function handleRematch(socketId: string): void {
  const room = getRoomBySocket(socketId);
  if (!room) return;
  for (const player of room.players) {
    if (player.role === 'player') player.ready = false;
  }
  const player = getPlayer(room, socketId);
  if (player) player.ready = true;
  room.phase = 'countdown';
  broadcastRoom(room, 'rematch_start', { room: snapshot(room, '再来一局') });
  sendRoomState(room, '再来一局准备中');
  setTimeout(() => startGame(room), 1500);
}

function handleStartGame(socketId: string): void {
  const room = getRoomBySocket(socketId);
  if (!room) return;
  const humanPlayers = room.players.filter((p) => p.role === 'player');
  if (humanPlayers.length < 1) {
    sendToSocket(socketId, 'error', { message: '房间人数不足' });
    return;
  }
  if (room.phase === 'waiting' && room.players.length >= 2) {
    startGame(room);
    return;
  }
  if (room.phase === 'ended') {
    room.phase = 'waiting';
    room.winner = null;
    for (const p of room.players) p.ready = false;
    sendRoomState(room, '重新开始准备');
    startGame(room);
    return;
  }
  startGame(room);
}

function destroyRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
  if (room.tickTimer) { clearInterval(room.tickTimer); room.tickTimer = null; }
  if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }
  rooms.delete(roomId);
  const timers = queuedTimers.get(roomId);
  if (timers) { clearTimeout(timers); queuedTimers.delete(roomId); }
}

function handleMessage(ws: WebSocket, socketId: string, raw: RawData): void {
  try {
    const msg = JSON.parse(raw.toString()) as { type?: string; data?: unknown };
    const type = msg.type ?? '';
    switch (type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', data: { now: Date.now() } }));
        break;
      case 'match':
        queueMatch(socketId, String((msg.data as { nickname?: string })?.nickname || '玩家'));
        break;
      case 'cancel_match':
        handleCancelMatch(socketId);
        break;
      case 'create_room':
        const createData = msg.data as { nickname?: string } | undefined;
        handleCreateRoom(socketId, createData);
        break;
      case 'join_room':
        handleJoinRoom(socketId, msg.data as { roomId?: string; nickname?: string } | undefined);
        break;
      case 'leave_room':
        handleLeaveRoom(socketId);
        break;
      case 'ready':
        handleReady(socketId, !!(msg.data as { ready?: boolean })?.ready);
        break;
      case 'start_game':
        handleStartGame(socketId);
        break;
      case 'reconnect':
        handleReconnect(socketId, msg.data as { roomId?: string; playerId?: string; token?: string } | undefined);
        break;
      case 'rematch':
        handleRematch(socketId);
        break;
      case 'input':
        handleInput(socketId, (msg.data as { dir?: string })?.dir as SnakeDir | undefined);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', data: { message: `unknown message: ${type}` } }));
    }
  } catch {
    ws.send(JSON.stringify({ type: 'error', data: { message: 'invalid_message' } }));
  }
}

function handleConnection(ws: WebSocket): void {
  const socketId = id('sock');
  clients.set(socketId, { socketId, ws, roomId: null, playerId: null, token: null, nickname: '玩家', queueing: false });
  ws.send(JSON.stringify({ type: 'connected', data: { socketId } }));

  ws.on('message', (raw) => handleMessage(ws, socketId, raw));

  ws.on('close', () => {
    handleLeaveRoom(socketId);
    clearQueue(socketId);
    clients.delete(socketId);
    const playerId = socketToPlayerId.get(socketId);
    if (playerId) {
      const roomId = roomByPlayerId.get(playerId);
      if (roomId) {
        destroyRoom(roomId);
        const room = rooms.get(roomId);
        if (room && room.players.every(p => p.socketId === null || p.role === 'bot')) {
          rooms.delete(roomId);
        }
      }
    }
    socketToPlayerId.delete(socketId);
  });
}

export function socketSetup(httpServer: HttpServer, wsPath: string): void {
  const targetPath = wsPath.replace(/\/$/, '') + '/websocket';
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = (req.url || '').split('?')[0];
    if (url !== targetPath) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', handleConnection);
  log(LogLevel.INFO, `🔌 [snake-mp] WebSocket 已注册: ${targetPath}`);
}

// P2-04 dummy
if (false) { GamePhase.Playing; MessageType.GameStart; }
