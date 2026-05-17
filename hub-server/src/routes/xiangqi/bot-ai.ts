import type { Piece, Color } from './types.js';
import type { Board } from './game-logic.js';
import { makeMove, checkGameResult, getLegalMoves } from './game-logic.js';

// ===== 棋子价值 =====
const PIECE_VALUES: Record<Piece['type'], number> = {
  general: 10000,
  rook: 900,
  horse: 450,
  cannon: 450,
  elephant: 200,
  advisor: 200,
  pawn: 100,
};

const PAWN_CROSSED_BONUS = 50;

// ===== 位置加成 =====
const POSITION_BONUS: Record<Piece['type'], number[][]> = {
  general: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 2, 2, 2, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
  ],
  rook: Array.from({ length: 10 }, () => Array(9).fill(0)),
  horse: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 5, 0, 0, 0, 5, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  cannon: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 5, 0, 0, 0, 0, 0, 5, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 5, 0, 0, 0, 0, 0, 5, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  elephant: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 10, 0, 0, 0, 10, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 10, 0, 0, 0, 10, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  advisor: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 5, 0, 5, 0, 0, 0],
    [0, 0, 0, 0, 10, 0, 0, 0, 0],
    [0, 0, 0, 5, 0, 5, 0, 0, 0],
  ],
  pawn: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 20, 0, 20, 0, 20, 0, 0],
    [0, 0, 30, 0, 30, 0, 30, 0, 0],
    [40, 0, 50, 0, 50, 0, 50, 0, 40],
    [50, 0, 60, 0, 60, 0, 60, 0, 50],
    [50, 0, 60, 0, 60, 0, 60, 0, 50],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
};

// ===== 难度 → 搜索深度 =====
const DEPTH_MAP: Record<string, number> = { hard: 3, harder: 4 };

// ===== 导出 =====
export type BotDifficulty = 'hard' | 'harder';

/** 随机选择困难或大师难度 */
export function randomDifficulty(): BotDifficulty {
  return Math.random() < 0.5 ? 'hard' : 'harder';
}

/** 随机思考延迟（毫秒）：1500~5000ms */
export function randomThinkDelay(): number {
  return 1500 + Math.floor(Math.random() * 3500);
}

interface BotMove {
  from: { col: number; row: number };
  to: { col: number; row: number };
}

/** 机器人 AI 计算最佳走法 */
export function getBestMove(board: Board, color: Color, difficulty: BotDifficulty): BotMove | null {
  const maxDepth = DEPTH_MAP[difficulty];
  const moves = getAllMoves(board, color);
  if (moves.length === 0) return null;

  let bestMove: BotMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const newBoard = makeMove(board, move);
    const score = minimax(newBoard, maxDepth - 1, -Infinity, Infinity, false, color, maxDepth);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

// ===== 内部函数 =====

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiColor: Color,
  maxDepth: number,
): number {
  if (depth === 0) return evaluate(board, aiColor);

  const currentColor = isMaximizing ? aiColor : (aiColor === 'red' ? 'black' : 'red');
  const result = checkGameResult(board, currentColor);
  if (result.over) {
    if (result.winner === aiColor) return 100000 + (maxDepth - depth);
    if (result.winner === null) return 0;
    return -100000 - (maxDepth - depth);
  }

  const moves = getAllMoves(board, currentColor);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const evalScore = minimax(makeMove(board, move), depth - 1, alpha, beta, false, aiColor, maxDepth);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (const move of moves) {
    const evalScore = minimax(makeMove(board, move), depth - 1, alpha, beta, true, aiColor, maxDepth);
    minEval = Math.min(minEval, evalScore);
    beta = Math.min(beta, evalScore);
    if (beta <= alpha) break;
  }
  return minEval;
}

function evaluate(board: Board, aiColor: Color): number {
  let score = 0;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      let value = PIECE_VALUES[piece.type];
      if (piece.type === 'pawn') {
        const crossed = piece.color === 'red' ? row >= 5 : row <= 4;
        if (crossed) value += PAWN_CROSSED_BONUS;
      }
      const posRow = piece.color === 'red' ? row : 9 - row;
      value += POSITION_BONUS[piece.type][posRow]?.[col] ?? 0;
      score += piece.color === aiColor ? value : -value;
    }
  }
  return score;
}

function getAllMoves(board: Board, color: Color): BotMove[] {
  const moves: BotMove[] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        for (const target of getLegalMoves(board, col, row)) {
          moves.push({ from: { col, row }, to: target });
        }
      }
    }
  }
  // 吃子优先排序（提升 alpha-beta 剪枝效率）
  moves.sort((a, b) => {
    const captureA = board[a.to.row][a.to.col] ? PIECE_VALUES[board[a.to.row][a.to.col]!.type] : 0;
    const captureB = board[b.to.row][b.to.col] ? PIECE_VALUES[board[b.to.row][b.to.col]!.type] : 0;
    return captureB - captureA;
  });
  return moves;
}
