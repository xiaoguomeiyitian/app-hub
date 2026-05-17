// ===== 联机协议类型定义 =====

export interface OnlineMessage {
  type: string;
  data?: unknown;
}

export interface ConnectedData {
  socketId: string;
  name: string;
}

export interface MatchFoundData {
  roomId: string;
  yourColor: 'black' | 'white';
  opponent: { name: string };
}

export interface RoomCreatedData {
  roomId: string;
}

export interface RoomJoinedData {
  roomId: string;
  players: PlayerInfo[];
}

export interface RoomUpdateData {
  players: PlayerInfo[];
  status: string;
}

export interface GameStartedData {
  turn: 'black';
  board: number[][];
}

export interface GameMovedData {
  row: number;
  col: number;
  color: 'black' | 'white';
}

export interface GameTurnData {
  turn: 'black' | 'white';
}

export interface GameOverData {
  winner: 'black' | 'white' | 'draw';
  reason: string;
}

export interface ErrorData {
  code: string;
  message?: string;
}

export interface PlayerInfo {
  socketId: string;
  name: string;
  color: 'black' | 'white';
  connected: boolean;
}

export type OnlineEventType =
  | 'connected'
  | 'match:queued'
  | 'match:found'
  | 'match:cancelled'
  | 'room:created'
  | 'room:joined'
  | 'room:update'
  | 'room:opponent_left'
  | 'game:started'
  | 'game:moved'
  | 'game:turn'
  | 'game:over'
  | 'error'
  | 'pong';
