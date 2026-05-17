import type { Piece, Board, Position, Color, Move } from './types';
import { opponent } from './types.js';
import { getPiece, cloneBoard } from './board-setup.js';

// ===== 走棋规则引擎 =====

// 检查位置是否在棋盘内
function inBounds(col: number, row: number): boolean {
  return col >= 0 && col <= 8 && row >= 0 && row <= 9;
}

// 两位置之间棋子数量（不含起点终点）
function countBetween(board: Board, from: Position, to: Position): number {
  let count = 0;
  if (from.col === to.col) {
    // 竖线
    const minR = Math.min(from.row, to.row) + 1;
    const maxR = Math.max(from.row, to.row);
    for (let r = minR; r < maxR; r++) {
      if (board[r][from.col]) count++;
    }
  } else if (from.row === to.row) {
    // 横线
    const minC = Math.min(from.col, to.col) + 1;
    const maxC = Math.max(from.col, to.col);
    for (let c = minC; c < maxC; c++) {
      if (board[from.row][c]) count++;
    }
  }
  return count;
}

// ===== 各棋子走法验证 =====

// 车：横竖不限距离，不能越子
function isValidRookMove(board: Board, from: Position, to: Position): boolean {
  if (from.col !== to.col && from.row !== to.row) return false;
  return countBetween(board, from, to) === 0;
}

// 马：走"日"字，蹩马腿
function isValidHorseMove(board: Board, from: Position, to: Position): boolean {
  const dc = Math.abs(to.col - from.col);
  const dr = Math.abs(to.row - from.row);
  if (!((dc === 1 && dr === 2) || (dc === 2 && dr === 1))) return false;

  // 蹩马腿
  if (dc === 1) {
    // 竖向移动2步，检查中间
    const midRow = from.row + (to.row > from.row ? 1 : -1);
    if (board[midRow][from.col]) return false;
  } else {
    // 横向移动2步，检查中间
    const midCol = from.col + (to.col > from.col ? 1 : -1);
    if (board[from.row][midCol]) return false;
  }
  return true;
}

// 炮：横竖移动，吃子需隔一子
function isValidCannonMove(board: Board, from: Position, to: Position, target: Piece | null): boolean {
  if (from.col !== to.col && from.row !== to.row) return false;
  const between = countBetween(board, from, to);
  if (target) {
    return between === 1; // 吃子：隔一个
  } else {
    return between === 0; // 移动：不隔子
  }
}

// 象：走"田"字，不过河，塞象眼
function isValidElephantMove(board: Board, from: Position, to: Position, color: Color): boolean {
  const dc = Math.abs(to.col - from.col);
  const dr = Math.abs(to.row - from.row);
  if (dc !== 2 || dr !== 2) return false;

  // 不过河
  if (color === 'red' && to.row > 4) return false;
  if (color === 'black' && to.row < 5) return false;

  // 塞象眼
  const midCol = (from.col + to.col) / 2;
  const midRow = (from.row + to.row) / 2;
  if (board[midRow][midCol]) return false;

  return true;
}

// 士：九宫内斜走一步
function isValidAdvisorMove(from: Position, to: Position, color: Color): boolean {
  const dc = Math.abs(to.col - from.col);
  const dr = Math.abs(to.row - from.row);
  if (dc !== 1 || dr !== 1) return false;

  // 九宫限制
  if (to.col < 3 || to.col > 5) return false;
  if (color === 'red') {
    if (to.row < 0 || to.row > 2) return false;
  } else {
    if (to.row < 7 || to.row > 9) return false;
  }
  return true;
}

// 将/帅：九宫内横竖一步
function isValidGeneralMove(from: Position, to: Position, color: Color): boolean {
  const dc = Math.abs(to.col - from.col);
  const dr = Math.abs(to.row - from.row);
  if (!((dc === 1 && dr === 0) || (dc === 0 && dr === 1))) return false;

  // 九宫限制
  if (to.col < 3 || to.col > 5) return false;
  if (color === 'red') {
    if (to.row < 0 || to.row > 2) return false;
  } else {
    if (to.row < 7 || to.row > 9) return false;
  }
  return true;
}

// 兵/卒：过河前只能前进，过河后可左右
function isValidPawnMove(from: Position, to: Position, color: Color): boolean {
  const dc = Math.abs(to.col - from.col);
  const dr = to.row - from.row;

  if (dc + dr !== 1 && dc - dr !== -1 && dc !== 0) return false;
  if (dc > 1) return false;

  const forward = color === 'red' ? 1 : -1;

  if (color === 'red') {
    if (from.row <= 4) {
      // 未过河，只能前进
      return dc === 0 && dr === 1;
    } else {
      // 已过河
      return dr === forward || (dr === 0 && dc === 1);
    }
  } else {
    if (from.row >= 5) {
      // 未过河，只能前进
      return dc === 0 && dr === -1;
    } else {
      // 已过河
      return dr === forward || (dr === 0 && dc === 1);
    }
  }
}

// ===== 主验证函数 =====
export function isValidMove(board: Board, move: Move, color: Color): boolean {
  const { from, to } = move;

  // 基本检查
  if (!inBounds(from.col, from.row) || !inBounds(to.col, to.row)) return false;
  if (from.col === to.col && from.row === to.row) return false;

  const piece = getPiece(board, from.col, from.row);
  if (!piece || piece.color !== color) return false;

  const target = getPiece(board, to.col, to.row);
  if (target && target.color === color) return false; // 不能吃己方

  switch (piece.type) {
    case 'rook':    return isValidRookMove(board, from, to);
    case 'horse':   return isValidHorseMove(board, from, to);
    case 'cannon':  return isValidCannonMove(board, from, to, target);
    case 'elephant':return isValidElephantMove(board, from, to, color);
    case 'advisor': return isValidAdvisorMove(from, to, color);
    case 'general': return isValidGeneralMove(from, to, color);
    case 'pawn':    return isValidPawnMove(from, to, color);
  }
  return false;
}

// ===== 将军检测 =====
export function isGeneralFacing(board: Board): boolean {
  // 将帅面对面
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
  // 检查中间是否有棋子
  const minR = Math.min(redRow, blackRow) + 1;
  const maxR = Math.max(redRow, blackRow);
  for (let r = minR; r < maxR; r++) {
    if (board[r][redCol]) return false;
  }
  return true;
}

// 检查某方是否被将军
export function isInCheck(board: Board, color: Color): boolean {
  // 找将/帅位置
  let genCol = -1, genRow = -1;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p?.type === 'general' && p.color === color) {
        genCol = c; genRow = r;
      }
    }
  }
  if (genCol === -1) return true; // 将被吃了

  const opp = opponent(color);
  // 检查对方是否有棋子可以吃将
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

  // 将帅面对面也算将军
  if (isGeneralFacing(board)) return true;

  return false;
}

// ===== 执行走棋 =====
export function makeMove(board: Board, move: Move): Board {
  const newBoard = cloneBoard(board);
  const piece = newBoard[move.from.row][move.from.col];
  if (!piece) return newBoard;

  newBoard[move.from.row][move.from.col] = null;
  newBoard[move.to.row][move.to.col] = { ...piece, col: move.to.col, row: move.to.row };
  return newBoard;
}

// ===== 检查走棋后是否让自己被将军 =====
export function wouldBeInCheck(board: Board, move: Move, color: Color): boolean {
  const newBoard = makeMove(board, move);
  return isInCheck(newBoard, color);
}

// ===== 综合走棋验证（含将军检查） =====
export function isLegalMove(board: Board, move: Move, color: Color): boolean {
  if (!isValidMove(board, move, color)) return false;
  // 走完不能让自己被将军
  if (wouldBeInCheck(board, move, color)) return false;
  return true;
}

// ===== 获取某棋子所有合法走法 =====
export function getLegalMoves(board: Board, col: number, row: number): Position[] {
  const piece = getPiece(board, col, row);
  if (!piece) return [];

  const moves: Position[] = [];
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

// ===== 检查是否无棋可走（困毙） =====
export function hasNoLegalMoves(board: Board, color: Color): boolean {
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
  // 检查将是否存在
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

  // 困毙与和棋区分：
  // - 被困毙且正在被将军：判负
  // - 无子可走但未被将军：和棋
  if (hasNoLegalMoves(board, currentTurn)) {
    if (isInCheck(board, currentTurn)) {
      return { over: true, winner: opponent(currentTurn), reason: '困毙' };
    }
    return { over: true, winner: null, reason: '和棋' };
  }

  return { over: false, winner: null, reason: '' };
}
