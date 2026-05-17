import { Player } from '../types/index.js';
import type { Position } from '../types/index.js';
import type { Board } from '../game/Board.js';
import { Evaluator } from './Evaluator.js';
import { Search } from './Search.js';
import { DEFAULT_SEARCH_DEPTH } from '../game/constants.js';

/**
 * AI 引擎 - 对外统一接口
 * 封装搜索和评估，提供 getBestMove 方法
 */
export class AIEngine {
  private evaluator: Evaluator;
  private search: Search;
  private depth: number;

  constructor(depth: number = DEFAULT_SEARCH_DEPTH) {
    this.evaluator = new Evaluator();
    this.search = new Search(this.evaluator);
    this.depth = depth;
  }

  /**
   * 获取 AI 最佳落子位置
   * 使用 requestAnimationFrame 包装，避免阻塞 UI
   */
  getBestMove(board: Board, player: Player): Promise<Position> {
    return new Promise((resolve) => {
      // 使用 setTimeout 让 UI 先更新"思考中"状态
      setTimeout(() => {
        const result = this.search.search(board, player, this.depth);
        resolve(result.position);
      }, 50);
    });
  }

  /** 设置搜索深度 */
  setDepth(depth: number): void {
    this.depth = depth;
  }
}
