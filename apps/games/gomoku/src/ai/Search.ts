import { Player } from '../types/index.js';
import type { Position, SearchResult } from '../types/index.js';
import { BOARD_SIZE, CANDIDATE_RADIUS, MAX_CANDIDATES, DEFAULT_SEARCH_DEPTH } from '../game/constants.js';
import type { Board } from '../game/Board.js';
import { Evaluator } from './Evaluator.js';

/**
 * Negamax + Alpha-Beta 剪枝搜索
 */
export class Search {
  private evaluator: Evaluator;
  private aiPlayer: Player = Player.White;

  constructor(evaluator: Evaluator) {
    this.evaluator = evaluator;
  }

  /**
   * 搜索最佳落子位置
   */
  search(board: Board, player: Player, depth?: number): SearchResult {
    this.aiPlayer = player;
    const searchDepth = depth ?? DEFAULT_SEARCH_DEPTH;

    // 先检查是否有必胜/必防走法
    const critical = this.findCriticalMove(board, player);
    if (critical) return { position: critical, score: Infinity };

    // 检查防守对方的必胜
    const opponent = player === Player.Black ? Player.White : Player.Black;
    const defense = this.findCriticalMove(board, opponent);
    if (defense) return { position: defense, score: -Infinity + 1 };

    const candidates = this.getCandidates(board, player);
    if (candidates.length === 0) {
      // 开局：下天元
      const mid = Math.floor(BOARD_SIZE / 2);
      return { position: { row: mid, col: mid }, score: 0 };
    }

    let bestMove = candidates[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    for (const pos of candidates) {
      board.setCell(pos.row, pos.col, player);
      const score = -this.negamax(board, searchDepth - 1, -beta, -alpha, opponent);
      board.setCell(pos.row, pos.col, Player.None);

      if (score > bestScore) {
        bestScore = score;
        bestMove = pos;
      }
      if (score > alpha) {
        alpha = score;
      }
    }

    return { position: bestMove, score: bestScore };
  }

  /** Negamax + Alpha-Beta 剪枝 */
  private negamax(board: Board, depth: number, alpha: number, beta: number, player: Player): number {
    if (depth === 0) {
      return this.evaluator.evaluate(board, this.aiPlayer) *
        (player === this.aiPlayer ? 1 : -1);
    }

    const candidates = this.getCandidates(board, player);
    if (candidates.length === 0) {
      return this.evaluator.evaluate(board, this.aiPlayer) *
        (player === this.aiPlayer ? 1 : -1);
    }

    let maxScore = -Infinity;
    const opponent = player === Player.Black ? Player.White : Player.Black;

    for (const pos of candidates) {
      // 检查是否形成五连（即时胜利）
      const result = this.evaluator.checkCriticalMove(board, pos.row, pos.col, player);
      board.setCell(pos.row, pos.col, player);

      let score: number;
      if (result === 'five') {
        // 当前玩家胜利，返回高分
        score = 100_000_000 + depth;
      } else {
        score = -this.negamax(board, depth - 1, -beta, -alpha, opponent);
      }

      board.setCell(pos.row, pos.col, Player.None);

      if (score > maxScore) maxScore = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break; // Alpha-Beta 剪枝
    }

    return maxScore;
  }

  /** 找必胜/必防走法 */
  private findCriticalMove(board: Board, player: Player): Position | null {
    const candidates = this.getCandidates(board, player);
    for (const pos of candidates) {
      const result = this.evaluator.checkCriticalMove(board, pos.row, pos.col, player);
      if (result === 'five' || result === 'liveFour') {
        return pos;
      }
    }
    return null;
  }

  /** 生成候选点（以已有棋子为中心的邻域） */
  getCandidates(board: Board, _player: Player): Position[] {
    const occupied = board.getOccupiedCells();
    if (occupied.length === 0) {
      const mid = Math.floor(BOARD_SIZE / 2);
      return [{ row: mid, col: mid }];
    }

    const candidateSet = new Map<string, Position>();

    for (const pos of occupied) {
      for (let dr = -CANDIDATE_RADIUS; dr <= CANDIDATE_RADIUS; dr++) {
        for (let dc = -CANDIDATE_RADIUS; dc <= CANDIDATE_RADIUS; dc++) {
          const nr = pos.row + dr;
          const nc = pos.col + dc;
          const key = `${nr},${nc}`;
          if (board.inBounds(nr, nc) && board.isEmpty(nr, nc) && !candidateSet.has(key)) {
            candidateSet.set(key, { row: nr, col: nc });
          }
        }
      }
    }

    let result = Array.from(candidateSet.values());

    // 预评估排序：优先搜索高分点
    result.sort((a, b) => {
      const scoreA = this.quickScore(board, a);
      const scoreB = this.quickScore(board, b);
      return scoreB - scoreA;
    });

    return result.slice(0, MAX_CANDIDATES);
  }

  /** 快速评分（用于候选点排序） */
  private quickScore(board: Board, pos: Position): number {
    let score = 0;
    // 只看周围是否有棋子，有则加分
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = pos.row + dr;
        const nc = pos.col + dc;
        if (board.inBounds(nr, nc) && !board.isEmpty(nr, nc)) {
          score += 10;
        }
      }
    }
    // 接近中心加分
    const mid = Math.floor(BOARD_SIZE / 2);
    score += Math.max(0, 7 - Math.abs(pos.row - mid) - Math.abs(pos.col - mid));
    return score;
  }
}
