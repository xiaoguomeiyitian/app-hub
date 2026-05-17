import type { Piece, PieceType, Board, Color } from './types';

// ===== 初始布局 =====
// 红方在下 (row 0-4), 黑方在上 (row 5-9)
// col 0-8 (左-右)
export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 10 }, () => Array(9).fill(null));

  const place = (type: Piece['type'], color: Color, col: number, row: number) => {
    board[row][col] = { type, color, col, row };
  };

  // 红方 (row 0-4, bottom)
  place('rook', 'red', 0, 0);
  place('rook', 'red', 8, 0);
  place('horse', 'red', 1, 0);
  place('horse', 'red', 7, 0);
  place('elephant', 'red', 2, 0);
  place('elephant', 'red', 6, 0);
  place('advisor', 'red', 3, 0);
  place('advisor', 'red', 5, 0);
  place('general', 'red', 4, 0);
  place('cannon', 'red', 1, 2);
  place('cannon', 'red', 7, 2);
  place('pawn', 'red', 0, 3);
  place('pawn', 'red', 2, 3);
  place('pawn', 'red', 4, 3);
  place('pawn', 'red', 6, 3);
  place('pawn', 'red', 8, 3);

  // 黑方 (row 5-9, top)
  place('rook', 'black', 0, 9);
  place('rook', 'black', 8, 9);
  place('horse', 'black', 1, 9);
  place('horse', 'black', 7, 9);
  place('elephant', 'black', 2, 9);
  place('elephant', 'black', 6, 9);
  place('advisor', 'black', 3, 9);
  place('advisor', 'black', 5, 9);
  place('general', 'black', 4, 9);
  place('cannon', 'black', 1, 7);
  place('cannon', 'black', 7, 7);
  place('pawn', 'black', 0, 6);
  place('pawn', 'black', 2, 6);
  place('pawn', 'black', 4, 6);
  place('pawn', 'black', 6, 6);
  place('pawn', 'black', 8, 6);

  return board;
}

// ===== 复制棋盘 =====
export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

// ===== 获取棋盘上某位置的棋子 =====
export function getPiece(board: Board, col: number, row: number): Piece | null {
  if (col < 0 || col > 8 || row < 0 || row > 9) return null;
  return board[row][col];
}

// ===== 从 pieces 数组创建棋盘 =====
export function createBoardFromPieces(pieces: { type: PieceType; color: Color; col: number; row: number }[]): Board {
  const board: Board = Array.from({ length: 10 }, () => Array(9).fill(null));
  for (const p of pieces) {
    board[p.row][p.col] = { type: p.type, color: p.color, col: p.col, row: p.row };
  }
  return board;
}
