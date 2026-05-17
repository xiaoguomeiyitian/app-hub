// ===== 全局类型定义 =====

/** 方块类型 */
export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/** 旋转状态 0-3 */
export type Rotation = 0 | 1 | 2 | 3;

/** 方块数据 */
export interface Piece {
  type: PieceType;
  x: number;
  y: number;
  rotation: Rotation;
}

/** 游戏模式 */
export type GameMode = 'endless' | 'sprint' | 'online';

/** 消行类型 */
export type ClearType = 'single' | 'double' | 'triple' | 'quad'
  | 'tspin_mini' | 'tspin_mini_double' | 'tspin_single' | 'tspin_double' | 'tspin_triple';

/** 消行结果 */
export interface ClearResult {
  linesCleared: number;
  type: ClearType;
  attack: number;
  b2bBonus: number;
  combo: number;
  comboBonus: number;
  totalAttack: number;
  allClear: boolean;
}

/** 游戏状态 */
export interface GameState {
  board: number[][];
  current: Piece | null;
  hold: PieceType | null;
  canHold: boolean;
  next: PieceType[];
  score: number;
  lines: number;
  level: number;
  combo: number;
  b2b: number;
  gameOver: boolean;
  paused: boolean;
}

/** 7 种方块的形状定义（每个旋转状态） */
export type ShapeDef = number[][][];

/** SRS 踢墙表 */
export type KickTable = Record<string, [number, number][]>;
