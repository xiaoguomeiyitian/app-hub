import { log, LogLevel } from '../../logger.js';
import { nanoid } from 'nanoid';
import { WebSocket } from 'ws';
import { createInitialBoard, isLegalMove, makeMove as logicMakeMove, checkGameResult, isInCheck } from './game-logic.js';
import type { Board, Color, TimeConfig, TimeState } from './types.js';
import type { PlayerInfo, RoomState, RoomStatus } from './types.js';
import { wsClients, sendToSocket } from './ws-clients.js';
import { getTimeTierConfig, type TimeTierKey } from './time-tiers.js';
import { getBestMove, randomDifficulty, randomThinkDelay, type BotDifficulty } from './bot-ai.js';

// ===== Board 类型重导出 =====
export type { Board } from './game-logic.js';

// ===== 房间管理器 =====
const rooms = new Map<string, Room>();

// ===== Socket → Room 映射 =====
const socketRoomMap = new Map<string, string>();

// ===== 常量 =====
const ROOM_ID_LENGTH = 8;

/** 向房间内所有玩家广播（跳过机器人） */
export function broadcastToRoom(room: Room, event: string, data?: unknown): void {
  const msg = JSON.stringify({ type: event, data });
  for (const socketId of [room.red.socketId, room.black.socketId]) {
    if (room.isBotSocket(socketId)) continue;
    const ws = wsClients.get(socketId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export class Room {
  public readonly id: string;
  public red: PlayerInfo;
  public black: PlayerInfo;
  public board: Board;
  public currentTurn: Color = 'red';
  public status: RoomStatus = 'playing';
  public winner: Color | null = null;
  public winReason: string = '';
  public moveCount: number = 0;
  public readonly createdAt: number;

  // ===== 棋钟 =====
  public timerConfig: TimeConfig;
  public timer: {
    red: { remaining: number; stepStart: number | null };
    black: { remaining: number; stepStart: number | null };
  };
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // ===== 断线重连 =====
  public disconnectedAt: Map<string, number> = new Map();
  private disconnectedTimeout: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly RECONNECT_WINDOW = 60_000; // 60秒
  public readonly timeTier: TimeTierKey;
  public spectators: Set<string> = new Set();

  // ===== 机器人 =====
  public botColor: Color | null = null;
  public botDifficulty: BotDifficulty = 'hard';
  private botTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(p1: { socketId: string; nickname: string; elo: number; timeTier?: TimeTierKey }, p2: { socketId: string; nickname: string; elo: number; timeTier?: TimeTierKey }) {
    this.id = nanoid(ROOM_ID_LENGTH);
    this.red = { socketId: p1.socketId, nickname: p1.nickname, elo: p1.elo, color: 'red' };
    this.black = { socketId: p2.socketId, nickname: p2.nickname, elo: p2.elo, color: 'black' };
    this.board = createInitialBoard();
    this.createdAt = Date.now();

    this.timeTier = p1.timeTier ?? p2.timeTier ?? 'rapid';
    const tier = getTimeTierConfig(this.timeTier);
    this.timerConfig = {
      stepTime: tier.stepTime,
      totalTime: tier.totalTime,
      increment: tier.increment,
    };
    this.timer = {
      red: { remaining: tier.totalTime, stepStart: null },
      black: { remaining: tier.totalTime, stepStart: null },
    };

    // socket → room 映射
    socketRoomMap.set(p1.socketId, this.id);
    socketRoomMap.set(p2.socketId, this.id);

    rooms.set(this.id, this);

    // 开始计时（红方先走）
    this.startTimer();
  }

  /** 获取房间内所有 socket ID */
  getSocketIds(): string[] {
    return [this.red.socketId, this.black.socketId];
  }

  // ===== 计时器 =====

  /** 启动计时器 */
  startTimer(): void {
    this.stopTimer();
    const color = this.currentTurn;
    const entry = this.timer[color];
    entry.stepStart = Date.now();
    const otherColor = color === 'red' ? 'black' : 'red';
    this.timer[otherColor].stepStart = null;

    this.timerInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - (entry.stepStart ?? now);

      const stepRemaining = this.timerConfig.stepTime - elapsed;
      if (stepRemaining <= 0) {
        this.handleTimeout(color);
        return;
      }

      if (this.timer[color].remaining - elapsed <= 0) {
        this.handleTimeout(color);
        return;
      }

      this.broadcastTime();
    }, 1000);
  }

  /** 停止计时器 */
  stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /** 广播双方时间 */
  broadcastTime(): void {
    const now = Date.now();
    const build = (color: Color) => {
      const t = this.timer[color];
      const stepElapsed = t.stepStart ? now - t.stepStart : 0;
      return {
        remaining: t.remaining,
        stepRemaining: Math.max(0, this.timerConfig.stepTime - stepElapsed),
      };
    };

    const data: TimeState = { red: build('red'), black: build('black') };
    broadcastToRoom(this, 'game:time', data);
  }

  /** 走棋后更新计时，返回 true 表示已超时判负 */
  updateTimerOnMove(color: Color): boolean {
    const now = Date.now();
    const elapsed = now - (this.timer[color].stepStart ?? now);

    this.timer[color].remaining -= elapsed;
    this.timer[color].remaining += this.timerConfig.increment;

    if (this.timer[color].remaining <= 0) {
      this.handleTimeout(color);
      return true;
    }

    this.stopTimer();
    this.timer[color].stepStart = null;
    this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
    this.startTimer();
    return false;
  }

  /** 超时判负 */
  handleTimeout(color: Color): void {
    this.stopTimer();
    this.cancelBotMove();
    this.status = 'finished';
    this.winner = color === 'red' ? 'black' : 'red';
    this.winReason = '超时';

    broadcastToRoom(this, 'game:over', { winner: this.winner, reason: this.winReason });
  }

  // ===== 断线重连 =====

  /** 处理断线 */
  handleDisconnect(socketId: string): void {
    const color = this.getPlayerColor(socketId);
    if (!color || this.status !== 'playing') return;

    this.disconnectedAt.set(socketId, Date.now());

    const opponentId = this.getOpponentSocketId(socketId);
    if (opponentId) {
      sendToSocket(opponentId, 'game:opponent_disconnected');
    }

    const timeout = setTimeout(() => {
      if (this.disconnectedAt.has(socketId)) {
        this.status = 'finished';
        this.winner = color === 'red' ? 'black' : 'red';
        this.winReason = '断线超时';

        broadcastToRoom(this, 'game:over', { winner: this.winner, reason: this.winReason });

        this.disconnectedAt.delete(socketId);
        this.disconnectedTimeout.delete(socketId);
        setTimeout(() => removeRoom(this.id), 5000);
      }
    }, this.RECONNECT_WINDOW);

    this.disconnectedTimeout.set(socketId, timeout);
  }

  /** 处理重连 */
  handleReconnect(newSocketId: string, oldSocketId: string): void {
    const timeout = this.disconnectedTimeout.get(oldSocketId);
    if (timeout) clearTimeout(timeout);
    this.disconnectedTimeout.delete(oldSocketId);
    this.disconnectedAt.delete(oldSocketId);

    if (this.red.socketId === oldSocketId) {
      this.red.socketId = newSocketId;
    } else if (this.black.socketId === oldSocketId) {
      this.black.socketId = newSocketId;
    }

    socketRoomMap.delete(oldSocketId);
    socketRoomMap.set(newSocketId, this.id);

    this.sendState(newSocketId);

    const opponentId = this.getOpponentSocketId(newSocketId);
    if (opponentId) {
      sendToSocket(opponentId, 'game:opponent_reconnected');
    }

    log(LogLevel.INFO, `🔄 [xiangqi] 玩家重连: ${oldSocketId} → ${newSocketId}`);
  }

  /** 发送完整房间状态给指定 socket */
  sendState(socketId: string): void {
    const state = this.buildState();
    sendToSocket(socketId, 'game:state', state);
  }

  /** 构建房间状态 */
  private buildState(): RoomState {
    return {
      id: this.id,
      red: { ...this.red },
      black: { ...this.black },
      board: this.board,
      currentTurn: this.currentTurn,
      status: this.status,
      winner: this.winner,
      winReason: this.winReason,
      moveCount: this.moveCount,
      createdAt: this.createdAt,
      timeTier: this.timeTier,
    };
  }

  /** 处理走棋 */
  handleMove(
    socketId: string,
    from: { col: number; row: number },
    to: { col: number; row: number }
  ): { success: boolean; error?: string } {
    if (this.status !== 'playing') {
      return { success: false, error: '游戏已结束' };
    }

    if (this.disconnectedAt.size > 0) {
      return { success: false, error: '等待对手重连中' };
    }

    const playerColor = this.getPlayerColor(socketId);
    if (!playerColor) return { success: false, error: '你不在这个房间中' };
    if (playerColor !== this.currentTurn) return { success: false, error: '还没轮到你' };

    const move = { from, to };
    if (!isLegalMove(this.board, move, playerColor)) {
      return { success: false, error: '非法走法' };
    }

    const timedOut = this.updateTimerOnMove(playerColor);
    if (timedOut) return { success: true };

    this.board = logicMakeMove(this.board, move);
    this.moveCount++;

    broadcastToRoom(this, 'game:move', {
      from,
      to,
      board: this.board,
      currentTurn: this.currentTurn,
      moveCount: this.moveCount,
    });

    if (isInCheck(this.board, this.currentTurn)) {
      broadcastToRoom(this, 'game:check', { color: this.currentTurn });
    }

    const result = checkGameResult(this.board, this.currentTurn);
    if (result.over) {
      this.stopTimer();
      this.status = 'finished';
      this.winner = result.winner;
      this.winReason = result.reason;
      broadcastToRoom(this, 'game:over', { winner: result.winner, reason: result.reason });
    } else if (this.botColor === this.currentTurn) {
      // 轮到机器人，调度走棋
      this.scheduleBotMove();
    }

    return { success: true };
  }

  /** 认输 */
  handleResign(socketId: string): boolean {
    if (this.status !== 'playing') return false;
    const playerColor = this.getPlayerColor(socketId);
    if (!playerColor) return false;

    this.stopTimer();
    this.cancelBotMove();
    this.status = 'finished';
    this.winner = playerColor === 'red' ? 'black' : 'red';
    this.winReason = '认输';

    broadcastToRoom(this, 'game:over', { winner: this.winner, reason: this.winReason });
    return true;
  }

  /** 获取 socket 对应颜色 */
  getPlayerColor(socketId: string): Color | null {
    if (this.red.socketId === socketId) return 'red';
    if (this.black.socketId === socketId) return 'black';
    return null;
  }

  /** 获取对手 socket ID */
  getOpponentSocketId(socketId: string): string | null {
    if (this.red.socketId === socketId) return this.black.socketId;
    if (this.black.socketId === socketId) return this.red.socketId;
    return null;
  }

  /** 判断是否为机器人 socket */
  isBotSocket(socketId: string): boolean {
    return this.botColor !== null && this.getPlayerColor(socketId) === this.botColor;
  }

  /** 初始化机器人（在构造后调用） */
  initBot(color: Color): void {
    this.botColor = color;
    this.botDifficulty = randomDifficulty();
    const botInfo = color === 'red' ? this.red : this.black;
    botInfo.nickname = `AI象棋${this.botDifficulty === 'hard' ? '大师' : '宗师'}`;
    log(LogLevel.INFO, `🤖 [xiangqi] 机器人加入: ${botInfo.nickname} (${color}, ${this.botDifficulty})`);

    // 如果机器人执红（先手），立即调度第一步
    if (color === 'red' && this.currentTurn === 'red') {
      this.scheduleBotMove();
    }
  }

  /** 取消机器人走棋计时器 */
  cancelBotMove(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  /** 调度机器人走棋（在玩家走棋后调用） */
  scheduleBotMove(): void {
    if (this.status !== 'playing' || this.currentTurn !== this.botColor) return;
    if (this.botTimer) clearTimeout(this.botTimer);

    const delay = randomThinkDelay();
    log(LogLevel.INFO, `🤖 [xiangqi] 机器人将在 ${delay}ms 后走棋`);

    this.botTimer = setTimeout(() => {
      this.executeBotMove();
    }, delay);
  }

  /** 执行机器人走棋 */
  private executeBotMove(): void {
    if (this.status !== 'playing' || this.currentTurn !== this.botColor) return;

    const move = getBestMove(this.board, this.botColor!, this.botDifficulty);
    if (!move) {
      log(LogLevel.ERROR,`🤖 [xiangqi] 机器人无法找到合法走法`);
      return;
    }

    log(LogLevel.INFO, `🤖 [xiangqi] 机器人走棋: (${move.from.col},${move.from.row}) → (${move.to.col},${move.to.row})`);

    const timedOut = this.updateTimerOnMove(this.botColor!);
    if (timedOut) return;

    this.board = logicMakeMove(this.board, move);
    this.moveCount++;

    broadcastToRoom(this, 'game:move', {
      from: move.from,
      to: move.to,
      board: this.board,
      currentTurn: this.currentTurn,
      moveCount: this.moveCount,
    });

    if (isInCheck(this.board, this.currentTurn)) {
      broadcastToRoom(this, 'game:check', { color: this.currentTurn });
    }

    const result = checkGameResult(this.board, this.currentTurn);
    if (result.over) {
      this.stopTimer();
      this.status = 'finished';
      this.winner = result.winner;
      this.winReason = result.reason;
      broadcastToRoom(this, 'game:over', { winner: result.winner, reason: result.reason });
    }
  }

  /** 清理房间 */
  destroy(): void {
    this.stopTimer();
    if (this.botTimer) { clearTimeout(this.botTimer); this.botTimer = null; }
    for (const timeout of this.disconnectedTimeout.values()) {
      clearTimeout(timeout);
    }
    this.disconnectedTimeout.clear();
    this.disconnectedAt.clear();

    socketRoomMap.delete(this.red.socketId);
    socketRoomMap.delete(this.black.socketId);
    rooms.delete(this.id);
  }
}

// ===== 全局函数 =====

export function getRoomBySocketId(socketId: string): Room | null {
  const roomId = socketRoomMap.get(socketId);
  if (!roomId) return null;
  return rooms.get(roomId) ?? null;
}

export function getRoomByOldSocketId(oldSocketId: string): Room | null {
  for (const room of rooms.values()) {
    if (room.disconnectedAt.has(oldSocketId)) return room;
  }
  return null;
}

export function removeRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) room.destroy();
}

// ===== 好友房间 =====
interface FriendRoom {
  code: string;
  hostSocketId: string;
  hostNickname: string;
  hostElo: number;
  guestSocketId: string | null;
  guestNickname: string | null;
  guestElo: number | null;
  timeTier: TimeTierKey;
  expiresAt: number;
}

const friendRooms = new Map<string, FriendRoom>();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function cleanupExpiredFriendRooms(): void {
  const now = Date.now();
  for (const [code, room] of friendRooms) {
    if (now > room.expiresAt) friendRooms.delete(code);
  }
}

export function createFriendRoom(hostSocketId: string, nickname: string, elo: number, timeTier: TimeTierKey): FriendRoom {
  cleanupExpiredFriendRooms();
  let code = genRoomCode();
  while (friendRooms.has(code)) code = genRoomCode();
  const room: FriendRoom = {
    code,
    hostSocketId,
    hostNickname: nickname || '玩家',
    hostElo: elo,
    guestSocketId: null,
    guestNickname: null,
    guestElo: null,
    timeTier,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  friendRooms.set(code, room);
  return room;
}

export function joinFriendRoom(code: string, guestSocketId: string, nickname: string, elo: number): FriendRoom | null {
  const room = friendRooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.guestSocketId) return null;
  if (Date.now() > room.expiresAt) { friendRooms.delete(code); return null; }
  room.guestSocketId = guestSocketId;
  room.guestNickname = nickname || '玩家';
  room.guestElo = elo;
  return room;
}

export function getFriendRoomBySocket(socketId: string): FriendRoom | undefined {
  for (const room of friendRooms.values()) {
    if (room.hostSocketId === socketId || room.guestSocketId === socketId) return room;
  }
  return undefined;
}

export function removeFriendRoom(code: string): void {
  friendRooms.delete(code);
}

// ===== 观战管理 =====
const MAX_SPECTATORS = 10;

export function getRoomById(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function addSpectator(roomId: string, socketId: string): boolean {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'playing') return false;
  if (room.spectators.size >= MAX_SPECTATORS) return false;
  room.spectators.add(socketId);
  socketRoomMap.set(socketId, roomId);
  return true;
}

export function removeSpectator(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.spectators.has(socketId)) {
      room.spectators.delete(socketId);
      socketRoomMap.delete(socketId);
      return room;
    }
  }
  return undefined;
}

export function broadcastToSpectators(room: Room, type: string, data: unknown): void {
  const msg = JSON.stringify({ type, data });
  for (const sid of room.spectators) {
    const ws = wsClients.get(sid);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export function getPlayingRooms(): Room[] {
  const result: Room[] = [];
  for (const room of rooms.values()) {
    if (room.status === 'playing') result.push(room);
  }
  return result;
}
