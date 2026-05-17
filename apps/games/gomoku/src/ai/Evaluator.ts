import { Player } from '../types/index.js';
import { BOARD_SIZE, DIRECTIONS, SCORE_WEIGHTS, DEFENSE_FACTOR } from '../game/constants.js';
import type { Board } from '../game/Board.js';

/**
 * 棋型评估函数
 * 扫描棋盘每个位置的 4 个方向，识别连续同色棋子模式并评分
 */
export class Evaluator {
  /**
   * 评估全盘分数（从 AI 视角）
   * score = Σ(我方棋型得分) - Σ(对方棋型得分) × 防守系数
   */
  evaluate(board: Board, aiPlayer: Player): number {
    const opponent = aiPlayer === Player.Black ? Player.White : Player.Black;

    const aiScore = this.evaluatePlayer(board, aiPlayer);
    const oppScore = this.evaluatePlayer(board, opponent);

    return aiScore - oppScore * DEFENSE_FACTOR;
  }

  /** 评估单个玩家的全盘分数 */
  private evaluatePlayer(board: Board, player: Player): number {
    let total = 0;
    const grid = board.getGrid();

    // 对每个非空位置，扫描四个方向
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (grid[r][c] === Player.None) continue;
        for (const [dr, dc] of DIRECTIONS) {
          // 只从方向起始端计算，避免重复
          const pr = r - dr;
          const pc = c - dc;
          if (board.inBounds(pr, pc) && grid[pr][pc] === grid[r][c]) continue;

          const score = this.evaluateLine(board, r, c, dr, dc, player);
          total += score;
        }
      }
    }

    return total;
  }

  /** 评估从 (row, col) 开始沿 (dr, dc) 方向的棋型得分 */
  evaluateLine(
    board: Board,
    row: number,
    col: number,
    dr: number,
    dc: number,
    player: Player
  ): number {
    const grid = board.getGrid();
    if (grid[row][col] !== player) return 0;

    let count = 1;
    let openEnds = 0;

    // 正方向计数
    let blocked = false;
    for (let i = 1; i < 5; i++) {
      const nr = row + dr * i;
      const nc = col + dc * i;
      if (!board.inBounds(nr, nc)) { blocked = true; break; }
      if (grid[nr][nc] === player) { count++; }
      else if (grid[nr][nc] === Player.None) { openEnds++; break; }
      else { blocked = true; break; }
    }

    // 反方向计数
    let blocked2 = false;
    for (let i = 1; i < 5; i++) {
      const nr = row - dr * i;
      const nc = col - dc * i;
      if (!board.inBounds(nr, nc)) { blocked2 = true; break; }
      if (grid[nr][nc] === player) { count++; }
      else if (grid[nr][nc] === Player.None) { openEnds++; break; }
      else { blocked2 = true; break; }
    }

    if (count >= 5) return SCORE_WEIGHTS.five;
    if (blocked && blocked2) return 0;

    // 根据连子数和开放端评分
    if (count === 4) {
      return openEnds === 2 ? SCORE_WEIGHTS.liveFour : SCORE_WEIGHTS.deadFour;
    }
    if (count === 3) {
      return openEnds === 2 ? SCORE_WEIGHTS.liveThree : SCORE_WEIGHTS.deadThree;
    }
    if (count === 2) {
      return openEnds === 2 ? SCORE_WEIGHTS.liveTwo : SCORE_WEIGHTS.deadTwo;
    }
    return SCORE_WEIGHTS.one;
  }

  /**
   * 快速检查某位置落子后是否形成五连或活四
   * 用于必胜/必防快速判断
   */
  checkCriticalMove(board: Board, row: number, col: number, player: Player): 'five' | 'liveFour' | null {
    const grid = board.getGrid();
    if (grid[row][col] !== Player.None) return null;

    for (const [dr, dc] of DIRECTIONS) {
      let count = 1;
      let openEnds = 0;

      for (let i = 1; i < 5; i++) {
        const nr = row + dr * i;
        const nc = col + dc * i;
        if (!board.inBounds(nr, nc)) break;
        if (grid[nr][nc] === player) count++;
        else { if (grid[nr][nc] === Player.None) openEnds++; break; }
      }
      for (let i = 1; i < 5; i++) {
        const nr = row - dr * i;
        const nc = col - dc * i;
        if (!board.inBounds(nr, nc)) break;
        if (grid[nr][nc] === player) count++;
        else { if (grid[nr][nc] === Player.None) openEnds++; break; }
      }

      if (count >= 5) return 'five';
      if (count === 4 && openEnds === 2) return 'liveFour';
    }
    return null;
  }
}
