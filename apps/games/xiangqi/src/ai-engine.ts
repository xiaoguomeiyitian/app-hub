import type { Board, Move, Color, PieceType } from './types';
import { makeMove, checkGameResult, getLegalMoves } from './logic.js';

const PIECE_VALUES: Record<PieceType, number> = {
  general: 10000,
  rook: 900,
  horse: 450,
  cannon: 450,
  elephant: 200,
  advisor: 200,
  pawn: 100,
};

const PAWN_CROSSED_BONUS = 50;

const POSITION_BONUS: Record<PieceType, number[][]> = {
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
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 10, 0, 0, 0, 10, 0, 0],
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

const DEPTH_MAP: Record<string, number> = { easy: 2, medium: 3, hard: 4, harder: 5 };

export class ChessAI {
  private color: Color;
  private maxDepth: number;

  constructor(color: Color, difficulty: 'easy' | 'medium' | 'hard' | 'harder' = 'medium') {
    this.color = color;
    this.maxDepth = DEPTH_MAP[difficulty];
  }

  getBestMove(board: Board): Move | null {
    const moves = this.getAllMoves(board, this.color);
    if (moves.length === 0) return null;

    let bestMove: Move = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      const newBoard = makeMove(board, move);
      const score = this.minimax(newBoard, this.maxDepth - 1, -Infinity, Infinity, false);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  private minimax(board: Board, depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
    if (depth === 0) return this.evaluate(board);

    const result = checkGameResult(board, isMaximizing ? this.color : (this.color === 'red' ? 'black' : 'red'));
    if (result.over) {
      if (result.winner === this.color) return 100000 + (this.maxDepth - depth);
      if (result.winner === null) return 0;
      return -100000 - (this.maxDepth - depth);
    }

    const currentColor = isMaximizing ? this.color : (this.color === 'red' ? 'black' : 'red');
    const moves = this.getAllMoves(board, currentColor);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const evalScore = this.minimax(makeMove(board, move), depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    }

    let minEval = Infinity;
    for (const move of moves) {
      const evalScore = this.minimax(makeMove(board, move), depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }

  private evaluate(board: Board): number {
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
        score += piece.color === this.color ? value : -value;
      }
    }
    return score;
  }

  /** 公开评估接口：从指定颜色视角评估局面分数 */
  public evaluatePosition(board: Board, perspective: Color): number {
    const origColor = this.color;
    this.color = perspective;
    const score = this.evaluate(board);
    this.color = origColor;
    return score;
  }

  private getAllMoves(board: Board, color: Color): Move[] {
    const moves: Move[] = [];
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
    moves.sort((a, b) => {
      const captureA = board[a.to.row][a.to.col] ? PIECE_VALUES[board[a.to.row][a.to.col]!.type] : 0;
      const captureB = board[b.to.row][b.to.col] ? PIECE_VALUES[board[b.to.row][b.to.col]!.type] : 0;
      return captureB - captureA;
    });
    return moves;
  }
}
