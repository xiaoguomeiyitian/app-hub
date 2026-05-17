/** 游戏消息数据接口 */
export interface JoinData {
  nick?: string;
  roomId?: string;
  difficulty?: number;
  text?: string;
  [key: string]: unknown;
}

export interface MoveData {
  x?: number;
  y?: number;
  direction?: string;
  [key: string]: unknown;
}

export interface GameActionData {
  score?: number;
  pos?: number;
  alive?: boolean;
  x?: number;
  y?: number;
  [key: string]: unknown;
}

export interface FireData {
  x: number;
  y: number;
  [key: string]: unknown;
}

export interface PlaceData {
  ships?: Array<{ name: string; size: number; x: number; y: number; horizontal: boolean }>;
  [key: string]: unknown;
}

/** 投票数据 */
export interface VoteData {
  target?: string;
  [key: string]: unknown;
}
