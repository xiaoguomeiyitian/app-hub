// ===== 俄罗斯方块联机协议类型 =====

export interface OnlineMessage {
  type: string;
  data?: unknown;
}

export interface MatchFoundData {
  roomId: string;
  opponent: { name: string };
}

export interface GameStartedData {
  bag: number[]; // 初始方块序列（0-6 对应 I,O,T,S,Z,J,L）
}

export interface GameNextBagData {
  bag: number[];
}

export interface GameGarbageSentData {
  lines: number;
  from: string;
}

export interface GameGarbageReceivedData {
  lines: number;
  from: string;
}

export interface GameOpponentPlacedData {
  socketId: string;
  linesCleared: number;
}

export interface GameOpponentToppedData {
  socketId: string;
}

export interface GameOverData {
  winner: string;
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

export interface ErrorData {
  code: string;
  message?: string;
}

export interface PlayerInfo {
  socketId: string;
  name: string;
  connected: boolean;
}

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/** 数字编码转 PieceType */
export function indexToPieceType(idx: number): PieceType {
  const types: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  return types[idx] ?? 'I';
}
