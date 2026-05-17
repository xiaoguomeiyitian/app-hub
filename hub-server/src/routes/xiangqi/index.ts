import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';

import { wsClients, sendToSocket } from './ws-clients.js';
import { Room, getRoomBySocketId, getRoomByOldSocketId, broadcastToRoom, createFriendRoom, joinFriendRoom, getFriendRoomBySocket, removeFriendRoom, getRoomById, addSpectator, removeSpectator, broadcastToSpectators, getPlayingRooms } from './room.js';
import { addToQueue, removeFromQueue, isInQueue, getQueueSize } from './match-queue.js';
import type { QueueEntry } from './types.js';
import { DEFAULT_TIME_TIER, isTimeTierKey, type TimeTierKey } from './time-tiers.js';
import { nanoid as nanoidFunc } from 'nanoid';

export const description = '中国象棋在线匹配+原生 WebSocket 对战';

export const router = Router();

// ===== 健康检查 =====
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'xiangqi-online', queue: getQueueSize() });
});

// ===== WebSocket 服务 =====
let wss: WebSocketServer | null = null;

export function socketSetup(httpServer: HttpServer, wsPath: string): void {
  const targetPath = wsPath.replace(/\/$/, '') + '/websocket';

  // 使用 noServer 模式，手动处理 upgrade 事件
  wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = (req.url || '').split('?')[0]; // 去掉 query string
    if (url !== targetPath) return;

    wss!.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      wss!.emit('connection', ws, req);
    });
  });

  wss.on('error', (err) => {
    log(LogLevel.ERROR,`[xiangqi] WebSocketServer error:`, err);
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const socketId = nanoid(12);
    wsClients.set(socketId, ws);
    log(LogLevel.INFO, `🎮 [xiangqi] 玩家连接: ${socketId} (${req.url})`);

    // 发送连接确认（包含 socket ID）
    ws.send(JSON.stringify({ type: 'connected', data: { socketId } }));

    ws.on('message', (raw: RawData) => {
      try {
        const text = raw.toString();
        const msg = JSON.parse(text) as { type: string; data?: unknown };
        handleMessage(socketId, ws, msg.type, msg.data);
      } catch (e) {
        log(LogLevel.ERROR,'[xiangqi] 消息解析错误:', e);
      }
    });

    ws.on('close', () => {
      log(LogLevel.INFO, `🎮 [xiangqi] 玩家断开: ${socketId}`);
      handleDisconnect(socketId);
      wsClients.delete(socketId);
    });

    ws.on('error', (error: Error) => {
      log(LogLevel.ERROR,`[xiangqi] 客户端错误: ${socketId}`, error);
    });
  });

  log(LogLevel.INFO, `🔌 [xiangqi] 原生 WebSocket 已注册: ${targetPath}`);
}

// ===== 消息路由 =====
function handleMessage(socketId: string, ws: WebSocket, type: string, data: unknown): void {
  switch (type) {
    case 'match:join':
      handleMatchJoin(socketId, ws, data as { nickname?: string; elo?: number; timeTier?: TimeTierKey } | undefined);
      break;
    case 'match:cancel':
      handleMatchCancel(socketId);
      break;
    case 'game:move':
      handleGameMove(socketId, data as { from: { col: number; row: number }; to: { col: number; row: number } });
      break;
    case 'game:resign':
      handleGameResign(socketId);
      break;
    case 'game:reconnect':
      handleGameReconnect(socketId, data as { oldSocketId: string });
      break;
    case 'game:draw_offer':
      handleDrawOffer(socketId);
      break;
    case 'game:draw_response':
      handleDrawResponse(socketId, data as { accept: boolean });
      break;
    case 'room:leave':
      handlePlayerLeave(socketId);
      break;
    case 'room:create':
      handleRoomCreate(socketId, ws, data as { nickname?: string; timeTier?: TimeTierKey } | undefined);
      break;
    case 'room:join':
      handleRoomJoin(socketId, ws, data as { code: string; nickname?: string } | undefined);
      break;
    case 'room:cancel':
      handleRoomCancel(socketId);
      break;
    case 'spectate:join':
      handleSpectateJoin(socketId, data as { roomId?: string } | undefined);
      break;
    case 'spectate:leave':
      handleSpectateLeave(socketId);
      break;
    case 'spectate:list':
      handleSpectateList(socketId);
      break;
    case 'chat:send':
      handleChatSend(socketId, data as { text?: string; clientMessageId?: string } | undefined);
      break;
    case 'ping':
      sendToSocket(socketId, 'pong');
      break;
    default:
      log(LogLevel.INFO, `[xiangqi] 未知事件: ${type}`);
  }
}

// ===== 匹配 =====
function handleMatchJoin(socketId: string, ws: WebSocket, data?: { nickname?: string; elo?: number; timeTier?: TimeTierKey }): void {
  const nickname = data?.nickname || `玩家${socketId.slice(0, 4)}`;
  const elo = typeof data?.elo === 'number' ? data.elo : 1200;
  const timeTier = isTimeTierKey(data?.timeTier) ? data.timeTier : DEFAULT_TIME_TIER;

  const existingRoom = getRoomBySocketId(socketId);
  if (existingRoom) handlePlayerLeave(socketId);

  if (isInQueue(socketId)) removeFromQueue(socketId);

  log(LogLevel.INFO, `🔍 [xiangqi] ${nickname} (${elo}) 加入匹配队列，档位=${timeTier}`);

  addToQueue(
    socketId,
    ws,
    nickname,
    elo,
    timeTier,
    (p1: QueueEntry, p2: QueueEntry) => handleMatchFound(p1, p2),
    (entry: QueueEntry) => handleBotMatch(entry),
  );

  if (isInQueue(socketId)) {
    sendToSocket(socketId, 'match:waiting', { timeTier });
  }
}

function handleMatchCancel(socketId: string): void {
  if (isInQueue(socketId)) {
    removeFromQueue(socketId);
    sendToSocket(socketId, 'match:cancelled');
  }
}

function handleMatchFound(p1: QueueEntry, p2: QueueEntry): void {
  const room = new Room(p1, p2);
  log(LogLevel.INFO, `🎯 [xiangqi] 对局开始: ${room.id} (${p1.nickname} vs ${p2.nickname})`);

  sendToSocket(p1.socketId, 'match:found', { roomId: room.id, color: 'red', opponent: p2.nickname, timeTier: room.timeTier });
  sendToSocket(p2.socketId, 'match:found', { roomId: room.id, color: 'black', opponent: p1.nickname, timeTier: room.timeTier });

  room.sendState(p1.socketId);
  room.sendState(p2.socketId);
  room.startTimer();
}

// ===== 机器人匹配 =====
function handleBotMatch(entry: QueueEntry): void {
  // 生成虚拟机器人 socketId
  const botSocketId = `bot:${nanoidFunc(12)}`;

  // 随机分配红黑（真人有 50% 概率执红先手）
  const humanIsRed = Math.random() < 0.5;

  const botEntry = {
    socketId: botSocketId,
    ws: null as never,
    nickname: 'AI',
    elo: entry.elo,
    timeTier: entry.timeTier,
    joinedAt: Date.now(),
  };

  let room: Room;
  if (humanIsRed) {
    room = new Room(entry, botEntry);
  } else {
    room = new Room(botEntry, entry);
  }

  // 初始化机器人
  const botColor = humanIsRed ? 'black' : 'red';
  room.initBot(botColor);

  const humanColor = humanIsRed ? 'red' : 'black';
  const botName = botColor === 'red' ? room.red.nickname : room.black.nickname;

  log(LogLevel.INFO, `🤖 [xiangqi] 机器人对局开始: ${room.id} (${entry.nickname} vs ${botName})`);

  // 通知真人玩家匹配成功
  sendToSocket(entry.socketId, 'match:found', {
    roomId: room.id,
    color: humanColor,
    opponent: botName,
    timeTier: room.timeTier,
    isBot: true,
  });

  room.sendState(entry.socketId);
  room.startTimer();
}

// ===== 聊天 =====
function handleChatSend(socketId: string, data?: { text?: string; clientMessageId?: string }): void {
  const room = getRoomBySocketId(socketId);
  if (!room || room.status !== 'playing') return;
  if (room.disconnectedAt.size > 0) return;

  const playerColor = room.getPlayerColor(socketId);
  if (!playerColor) return;

  const nickname = playerColor === 'red' ? room.red.nickname : room.black.nickname;
  const text = String(data?.text ?? '').trim();
  if (!text) return;
  if (text.length > 120) {
    sendToSocket(socketId, 'error', { message: '聊天内容不能超过120个字符' });
    return;
  }

  broadcastToRoom(room, 'chat:message', {
    socketId,
    nickname,
    color: playerColor,
    text,
    time: Date.now(),
    clientMessageId: data?.clientMessageId,
  });
}

// ===== 走棋 =====
function handleGameMove(socketId: string, data: { from: { col: number; row: number }; to: { col: number; row: number } }): void {
  const room = getRoomBySocketId(socketId);
  if (!room) { sendToSocket(socketId, 'error', { message: '不在任何房间中' }); return; }
  if (!data?.from || !data?.to) { sendToSocket(socketId, 'error', { message: '无效的走棋数据' }); return; }

  const result = room.handleMove(socketId, data.from, data.to);
  if (!result.success) {
    sendToSocket(socketId, 'error', { message: result.error || '走棋失败' });
    return;
  }
  // 广播给观战者
  broadcastToSpectators(room, 'game:move', {
    from: data.from, to: data.to,
    board: room.board, currentTurn: room.currentTurn, moveCount: room.moveCount,
  });
  if (room.status === 'finished') {
    broadcastToSpectators(room, 'game:over', { winner: room.winner, reason: room.winReason });
  }
}

// ===== 认输 =====
function handleGameResign(socketId: string): void {
  const room = getRoomBySocketId(socketId);
  if (!room || room.status !== 'playing') return;
  room.handleResign(socketId);
  broadcastToSpectators(room, 'game:over', { winner: room.winner, reason: room.winReason });
}

// ===== 断线重连 =====
function handleGameReconnect(socketId: string, data: { oldSocketId: string }): void {
  const oldSocketId = data.oldSocketId;
  const room = getRoomByOldSocketId(oldSocketId);

  if (!room) { sendToSocket(socketId, 'error', { message: '没有找到可重连的对局' }); return; }
  if (room.status !== 'playing') { sendToSocket(socketId, 'error', { message: '对局已结束' }); return; }
  if (!room.disconnectedAt.has(oldSocketId)) { sendToSocket(socketId, 'error', { message: '该连接未断线' }); return; }

  room.handleReconnect(socketId, oldSocketId);
}

// ===== 和棋 =====
function handleDrawOffer(socketId: string): void {
  const room = getRoomBySocketId(socketId);
  if (!room || room.status !== 'playing') return;

  const opponentId = room.getOpponentSocketId(socketId);
  if (!opponentId) return;

  // 机器人自动拒绝和棋
  if (room.isBotSocket(opponentId)) {
    sendToSocket(socketId, 'game:draw_declined');
    return;
  }

  sendToSocket(opponentId, 'game:draw_offered');
}

function handleDrawResponse(socketId: string, data: { accept: boolean }): void {
  const room = getRoomBySocketId(socketId);
  if (!room || room.status !== 'playing') return;

  const opponentId = room.getOpponentSocketId(socketId);

  if (data.accept) {
    room.stopTimer();
    room.status = 'finished';
    room.winner = null;
    room.winReason = '和棋';

    const ns = room.getSocketIds();
    for (const id of ns) {
      sendToSocket(id, 'game:draw_accepted');
      sendToSocket(id, 'game:over', { winner: null, reason: '和棋' });
    }
  } else {
    if (opponentId) sendToSocket(opponentId, 'game:draw_declined');
  }
}

// ===== 离开房间 =====
function handlePlayerLeave(socketId: string): void {
  const room = getRoomBySocketId(socketId);
  if (!room) return;

  const opponentId = room.getOpponentSocketId(socketId);
  if (opponentId) sendToSocket(opponentId, 'game:opponent_disconnected');

  room.handleDisconnect(socketId);
}

// ===== 好友房间 =====
function handleRoomCreate(socketId: string, _ws: WebSocket, data?: { nickname?: string; timeTier?: TimeTierKey }): void {
  const nickname = data?.nickname || `玩家${socketId.slice(0, 4)}`;
  const timeTier = isTimeTierKey(data?.timeTier) ? data.timeTier : DEFAULT_TIME_TIER;
  const elo = 1200;
  const room = createFriendRoom(socketId, nickname, elo, timeTier);
  sendToSocket(socketId, 'room:created', { code: room.code });
  log(LogLevel.INFO, `🏠 [xiangqi] 好友房间创建: ${room.code} by ${nickname}`);
}

function handleRoomJoin(socketId: string, _ws: WebSocket, data?: { code: string; nickname?: string }): void {
  if (!data?.code) {
    sendToSocket(socketId, 'room:error', { message: '请输入房间码' });
    return;
  }
  const nickname = data?.nickname || `玩家${socketId.slice(0, 4)}`;
  const elo = 1200;
  const room = joinFriendRoom(data.code, socketId, nickname, elo);
  if (!room) {
    sendToSocket(socketId, 'room:error', { message: '房间不存在或已满' });
    return;
  }

  // 创建正式游戏房间
  const hostWs = wsClients.get(room.hostSocketId);
  if (!hostWs || hostWs.readyState !== WebSocket.OPEN) {
    sendToSocket(socketId, 'room:error', { message: '房主已离开' });
    removeFriendRoom(room.code);
    return;
  }

  const gameRoom = new Room(
    { socketId: room.hostSocketId, nickname: room.hostNickname, elo: room.hostElo, timeTier: room.timeTier },
    { socketId, nickname, elo, timeTier: room.timeTier },
  );
  removeFriendRoom(room.code);

  log(LogLevel.INFO, `🎯 [xiangqi] 好友对局开始: ${gameRoom.id} (${room.hostNickname} vs ${nickname})`);

  sendToSocket(room.hostSocketId, 'match:found', { roomId: gameRoom.id, color: 'red', opponent: nickname, timeTier: gameRoom.timeTier });
  sendToSocket(socketId, 'match:found', { roomId: gameRoom.id, color: 'black', opponent: room.hostNickname, timeTier: gameRoom.timeTier });

  gameRoom.sendState(room.hostSocketId);
  gameRoom.sendState(socketId);
  gameRoom.startTimer();
}

function handleRoomCancel(socketId: string): void {
  const room = getFriendRoomBySocket(socketId);
  if (room) {
    removeFriendRoom(room.code);
    sendToSocket(socketId, 'room:cancelled');
    log(LogLevel.INFO, `🚫 [xiangqi] 好友房间取消: ${room.code}`);
  }
}

// ===== 观战 =====
function handleSpectateJoin(socketId: string, data?: { roomId?: string }): void {
  let roomId = data?.roomId;
  if (!roomId) {
    const playingRooms = getPlayingRooms();
    if (playingRooms.length === 0) {
      sendToSocket(socketId, 'spectate:no_games', {});
      return;
    }
    roomId = playingRooms[Math.floor(Math.random() * playingRooms.length)].id;
  }
  const ok = addSpectator(roomId, socketId);
  if (!ok) {
    sendToSocket(socketId, 'spectate:full', {});
    return;
  }
  const room = getRoomById(roomId);
  if (room) {
    sendToSocket(socketId, 'spectate:joined', {
      roomId: room.id,
      red: room.red.nickname,
      black: room.black.nickname,
      board: room.board,
      currentTurn: room.currentTurn,
      moveCount: room.moveCount,
      spectatorCount: room.spectators.size,
    });
    broadcastToSpectators(room, 'spectate:count_update', { count: room.spectators.size });
    log(LogLevel.INFO, `👁 [xiangqi] 观战加入: ${socketId.slice(0,6)} → ${roomId} (${room.spectators.size}人)`);
  }
}

function handleSpectateLeave(socketId: string): void {
  const room = removeSpectator(socketId);
  if (room) {
    broadcastToSpectators(room, 'spectate:count_update', { count: room.spectators.size });
  }
}

function handleSpectateList(socketId: string): void {
  const count = getPlayingRooms().length;
  sendToSocket(socketId, 'spectate:count', { count });
}

// ===== 断线处理 =====
function handleDisconnect(socketId: string): void {
  const room = getRoomBySocketId(socketId);
  if (room) {
    room.handleDisconnect(socketId);
  } else if (isInQueue(socketId)) {
    removeFromQueue(socketId);
  }
  // 清理观战者
  removeSpectator(socketId);
}
