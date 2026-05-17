import type { Piece, Color } from './types.js';

// ===== Board 类型 =====
export type Board = (Piece | null)[][];

// ===== 初始棋盘 =====
export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 10 }, () => Array(9).fill(null));

  const place = (type: Piece['type'], color: Color, col: number, row: number) => {
    board[row][col] = { type, color, col, row };
  };

  // 红方 (row 0-3)
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

  // 黑方 (row 6-9)
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
function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

// ===== 获取棋子 =====
function getPiece(board: Board, col: number, row: number): Piece | null {
  if (col < 0 || col > 8 || row < 0 || row > 9) return null;
  return board[row][col];
}

// ===== 对手颜色 =====
function opponent(color: Color): Color {
  return color === 'red' ? 'black' : 'red';
}

// ===== 辅助函数 =====
function inBounds(col: number, row: number): boolean {
  return col >= 0 && col <= 8 && row >= 0 && row <= 9;
}

function countBetween(board: Board, from: { col: number; row: number }, to: { col: number; row: number }): number {
  let count = 0;
  if (from.col === to.col) {
    const minR = Math.min(from.row, to.row) + 1;
    const maxR = Math.max(from.row, to.row);
    for (let r = minR; r < maxR; r++) {
      if (board[r][from.col]) count++;
    }
  } else if (from.row === to.row) {
    const minC = Math.min(from.col, to.col) + 1;
    const maxC = Math.max(from.col, to.col);
    for (let c = minC; c < maxC; c++) {
      if (board[from.row][c]) count++;
    }
  }
  return count;
}

// ===== 各棋子走法验证 =====
function isValidRookMove(board: Board, from: { col: number; row: number }, to: { col: number; row: number }): boolean {
  if (from.col !== to.col && from.row !== to.row) return false;
  return countBetween(board, from, to) === 0;
}

function isValidHorseMove(board: Board, from: { col: number; row: number }, to: { col: number; row: number }): boolean {
  const dc = Math.abs(to.col - from.col);
  const dr = Math.abs(to.row - from.row);
  if (!((dc === 1 && dr === 2) || (dc === 2 && dr === 1))) return false;
  if (dc === 1) {
    const midRow = from.row + (to.row > from.row ? 1 : -1);
    if (board[midRow][from.col]) return false;
  } else {
    const midCol = from.col + (to.col > from.col ? 1 : -1);
    if (board[from.row][midCol]) return false;
  }
  return true;
}

function isValidCannonMove(board: Board, from: { col: number; row: number }, to: { col: number; row: number }, target: Piece | null): boolean {
  if (from.col !== to.col && from.row !== to.row) return false;
  const between = countBetween(board, from, to);
  return target ? between === 1 : between === 0;
}

function isValidElephantMove(board: Board, from: { col: number; row: number }, to: { col: number; row: number }, color: Color): boolean {
  const dc = Math.abs(to.col - from.col);
  const dr = Math.abs(to.row - from.row);
  if (dc !== 2 || dr !== 2) return false;
  if (color === 'red' && to.row > 4) return false;
  if (color === 'black' && to.row < 5) return false;
  const midCol = (from.col + to.col) / 2;
  const midRow = (from.row + to.row) / 2;
  if (board[midRow][midCol]) return false;
  return true;
}

function isValidAdvisorMove(from: { col: number; row: number }, to: { col: number; row: number }, color: Color): boolean {
  const dc = Math.abs(to.col - from.col);
  const dr = Math.abs(to.row - from.row);
  if (dc !== 1 || dr !== 1) return false;
  if (to.col < 3 || to.col > 5) return false;
  if (color === 'red') {
    if (to.row < 0 || to.row > 2) return false;
  } else {
    if (to.row < 7 || to.row > 9) return false;
  }
  return true;
}

function isValidGeneralMove(from: { col: number; row: number }, to: { col: number; row: number }, color: Color): boolean {
  const dc = Math.abs(to.col - from.col);
  const dr = Math.abs(to.row - from.row);
  if (!((dc === 1 && dr === 0) || (dc === 0 && dr === 1))) return false;
  if (to.col < 3 || to.col > 5) return false;
  if (color === 'red') {
    if (to.row < 0 || to.row > 2) return false;
  } else {
    if (to.row < 7 || to.row > 9) return false;
  }
  return true;
}

function isValidPawnMove(from: { col: number; row: number }, to: { col: number; row: number }, color: Color): boolean {
  const dc = Math.abs(to.col - from.col);
  const dr = to.row - from.row;
  if (dc + Math.abs(dr) !== 1) return false;
  if (dc > 1) return false;

  const forward = color === 'red' ? 1 : -1;

  if (color === 'red') {
    if (from.row <= 4) {
      return dc === 0 && dr === 1;
    } else {
      return dr === forward || (dr === 0 && dc === 1);
    }
  } else {
    if (from.row >= 5) {
      return dc === 0 && dr === -1;
    } else {
      return dr === forward || (dr === 0 && dc === 1);
    }
  }
}

// ===== 主验证函数 =====
export function isValidMove(board: Board, move: { from: { col: number; row: number }; to: { col: number; row: number } }, color: Color): boolean {
  const { from, to } = move;
  if (!inBounds(from.col, from.row) || !inBounds(to.col, to.row)) return false;
  if (from.col === to.col && from.row === to.row) return false;

  const piece = getPiece(board, from.col, from.row);
  if (!piece || piece.color !== color) return false;

  const target = getPiece(board, to.col, to.row);
  if (target && target.color === color) return false;

  switch (piece.type) {
    case 'rook': return isValidRookMove(board, from, to);
    case 'horse': return isValidHorseMove(board, from, to);
    case 'cannon': return isValidCannonMove(board, from, to, target);
    case 'elephant': return isValidElephantMove(board, from, to, color);
    case 'advisor': return isValidAdvisorMove(from, to, color);
    case 'general': return isValidGeneralMove(from, to, color);
    case 'pawn': return isValidPawnMove(from, to, color);
  }
  return false;
}

// ===== 将帅面对面 =====
function isGeneralFacing(board: Board): boolean {
  let redCol = -1, redRow = -1, blackCol = -1, blackRow = -1;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p?.type === 'general') {
        if (p.color === 'red') { redCol = c; redRow = r; }
        else { blackCol = c; blackRow = r; }
      }
    }
  }
  if (redCol !== blackCol || redCol === -1) return false;
  const minR = Math.min(redRow, blackRow) + 1;
  const maxR = Math.max(redRow, blackRow);
  for (let r = minR; r < maxR; r++) {
    if (board[r][redCol]) return false;
  }
  return true;
}

// ===== 将军检测 =====
export function isInCheck(board: Board, color: Color): boolean {
  let genCol = -1, genRow = -1;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p?.type === 'general' && p.color === color) {
        genCol = c; genRow = r;
      }
    }
  }
  if (genCol === -1) return true;

  const opp = opponent(color);
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.color === opp) {
        if (isValidMove(board, { from: { col: c, row: r }, to: { col: genCol, row: genRow } }, opp)) {
          return true;
        }
      }
    }
  }
  if (isGeneralFacing(board)) return true;
  return false;
}

// ===== 执行走棋 =====
export function makeMove(board: Board, move: { from: { col: number; row: number }; to: { col: number; row: number } }): Board {
  const newBoard = cloneBoard(board);
  const piece = newBoard[move.from.row][move.from.col];
  if (!piece) return newBoard;
  newBoard[move.from.row][move.from.col] = null;
  newBoard[move.to.row][move.to.col] = { ...piece, col: move.to.col, row: move.to.row };
  return newBoard;
}

// ===== 是否让自己被将军 =====
function wouldBeInCheck(board: Board, move: { from: { col: number; row: number }; to: { col: number; row: number } }, color: Color): boolean {
  const newBoard = makeMove(board, move);
  return isInCheck(newBoard, color);
}

// ===== 综合走棋验证 =====
export function isLegalMove(board: Board, move: { from: { col: number; row: number }; to: { col: number; row: number } }, color: Color): boolean {
  if (!isValidMove(board, move, color)) return false;
  if (wouldBeInCheck(board, move, color)) return false;
  return true;
}

// ===== 获取合法走法 =====
export function getLegalMoves(board: Board, col: number, row: number): { col: number; row: number }[] {
  const piece = getPiece(board, col, row);
  if (!piece) return [];

  const moves: { col: number; row: number }[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      if (c === col && r === row) continue;
      const move = { from: { col, row }, to: { col: c, row: r } };
      if (isLegalMove(board, move, piece.color)) {
        moves.push({ col: c, row: r });
      }
    }
  }
  return moves;
}

// ===== 是否无棋可走 =====
function hasNoLegalMoves(board: Board, color: Color): boolean {
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.color === color) {
        const moves = getLegalMoves(board, c, r);
        if (moves.length > 0) return false;
      }
    }
  }
  return true;
}

// ===== 胜负判定 =====
export function checkGameResult(board: Board, currentTurn: Color): { over: boolean; winner: Color | null; reason: string } {
  let redGen = false, blackGen = false;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p?.type === 'general') {
        if (p.color === 'red') redGen = true;
        else blackGen = true;
      }
    }
  }
  if (!redGen) return { over: true, winner: 'black', reason: '帅被吃掉' };
  if (!blackGen) return { over: true, winner: 'red', reason: '将被吃掉' };

  if (hasNoLegalMoves(board, currentTurn)) {
    return { over: true, winner: opponent(currentTurn), reason: '困毙' };
  }

  return { over: false, winner: null, reason: '' };
}
