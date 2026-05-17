// ===== 全局类型定义 =====

/** 玩家/棋子类型 */
export const enum Player {
  None = 0,
  Black = 1, // 先手（玩家默认）
  White = 2, // 后手（AI 默认）
}

/** 棋盘格子类型（同 Player） */
export type Cell = Player;

/** 坐标位置 */
export interface Position {
  row: number;
  col: number;
}

/** 落子记录 */
export interface Move {
  row: number;
  col: number;
  player: Player;
}

/** 游戏状态 */
export const enum GameState {
  Idle = 'idle',
  Playing = 'playing',
  Win = 'win',
  Lose = 'lose',
  Draw = 'draw',
}

/** 游戏模式 */
export const enum GameMode {
  PvP = 'pvp',
  PvAI = 'pvai',
  Online = 'online',
}

/** AI 难度 */
export const enum AIDifficulty {
  Easy = 1,
  Medium = 3,
  Hard = 5,
}

/** AI 搜索结果 */
export interface SearchResult {
  position: Position;
  score: number;
}

/** 棋型评分类型 */
export const enum PatternScore {
  Five = 100_000_000,
  LiveFour = 10_000_000,
  DeadFour = 1_000_000,
  LiveThree = 100_000,
  DeadThree = 10_000,
  LiveTwo = 1_000,
  DeadTwo = 100,
  One = 10,
  None = 0,
}

/** 方向向量 */
export type Direction = [number, number];

/** 胜利信息 */
export interface WinInfo {
  winner: Player;
  cells: Position[]; // 连珠的 5 个位置
}
