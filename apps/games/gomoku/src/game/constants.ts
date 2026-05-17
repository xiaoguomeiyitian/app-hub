import type { Direction } from '../types/index.js';

/** 棋盘大小 */
export const BOARD_SIZE = 15;

/** 四个扫描方向：水平、垂直、左斜、右斜 */
export const DIRECTIONS: Direction[] = [
  [0, 1],  // 水平 →
  [1, 0],  // 垂直 ↓
  [1, 1],  // 右斜 ↘
  [1, -1], // 左斜 ↙
];

/** AI 搜索默认深度 */
export const DEFAULT_SEARCH_DEPTH = 3;

/** 候选点邻域半径 */
export const CANDIDATE_RADIUS = 2;

/** 防守系数：对方威胁权重放大 */
export const DEFENSE_FACTOR = 1.2;

/** 棋型评分权重（用于对数化避免 BigInt，但这里直接用 number） */
export const SCORE_WEIGHTS = {
  five: 100_000_000,
  liveFour: 10_000_000,
  deadFour: 1_000_000,
  liveThree: 100_000,
  deadThree: 10_000,
  liveTwo: 1_000,
  deadTwo: 100,
  one: 10,
} as const;

/** 最大搜索候选点数量（防止性能问题） */
export const MAX_CANDIDATES = 50;
