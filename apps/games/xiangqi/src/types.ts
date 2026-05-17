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

// ===== 走棋 =====
export interface Move {
  from: Position;
  to: Position;
}

export type GameStatus = 'waiting' | 'playing' | 'checkmate' | 'resigned' | 'draw' | 'timeout';

// ===== 房间 =====
export interface RoomInfo {
  id: string;
  players: { id: string; name: string; color: Color | null }[];
  status: GameStatus;
  currentTurn: Color;
}

// ===== 棋盘（二维数组） =====
export type Board = (Piece | null)[][];

// ===== 棋子中文名 =====
export const PIECE_NAMES: Record<PieceType, [string, string]> = {
  general: ['帅', '将'],
  advisor: ['仕', '士'],
  elephant: ['相', '象'],
  horse: ['馬', '馬'],
  rook: ['車', '車'],
  cannon: ['炮', '砲'],
  pawn: ['兵', '卒'],
};

// ===== 对方向的辅助 =====
export function opponent(color: Color): Color {
  return color === 'red' ? 'black' : 'red';
}
