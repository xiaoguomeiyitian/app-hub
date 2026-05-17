import type { WebSocket } from 'ws';

// ===== 棋子颜色 =====
export type Color = 'red' | 'black';

// ===== 棋子类型 =====
export type PieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'rook' | 'cannon' | 'pawn';

// ===== 棋子 =====
export interface Piece {
  type: PieceType;
  color: Color;
  col: number;
  row: number;
}

// ===== 位置 =====
export interface Position {
  col: number;
  row: number;
}

// ===== Board =====
export type Board = (Piece | null)[][];

// ===== 走棋 =====
export interface Move {
  from: Position;
  to: Position;
}

// ===== 玩家信息 =====
export interface PlayerInfo {
  socketId: string;
  nickname: string;
  elo: number;
  color: Color;
}

// ===== 棋钟配置 =====
export interface TimeConfig {
  stepTime: number;   // 步时（毫秒），默认 90000
  totalTime: number;  // 局时（毫秒），默认 1200000
  increment: number;  // 每步加秒（毫秒），默认 15000
}

// ===== 棋钟状态 =====
export interface TimeState {
  red: { remaining: number; stepRemaining: number };
  black: { remaining: number; stepRemaining: number };
}

// ===== 房间状态 =====
export type RoomStatus = 'playing' | 'finished';

export interface RoomState {
  id: string;
  red: PlayerInfo;
  black: PlayerInfo;
  board: Board;
  currentTurn: Color;
  status: RoomStatus;
  winner: Color | null;
  winReason: string;
  moveCount: number;
  createdAt: number;
  timeTier?: string;
}

// ===== 匹配队列条目 =====
export type TimeTierKey = 'bullet' | 'blitz' | 'rapid' | 'classical';

export interface QueueEntry {
  socketId: string;
  ws: WebSocket;
  nickname: string;
  elo: number;
  timeTier: TimeTierKey;
  joinedAt: number;
}

