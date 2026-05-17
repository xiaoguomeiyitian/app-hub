import { WebSocket } from 'ws';

/** 玩家信息 */
export interface Player {
  id: string;
  ws?: WebSocket | null;
  isBot?: boolean;
  score?: number;
  nick?: string;
  hand?: string[]; // 扑克牌游戏使用
  // 常用游戏属性
  side?: number;
  pos?: number;
  alive?: boolean;
  placed?: boolean;
  ships?: Array<{ name: string; size: number; x: number; y: number; horizontal: boolean }>;
  hits?: Set<string>;
  shots?: Set<string>;
  stand?: boolean;
  busted?: boolean;
  bet?: number;
  doubled?: boolean;
  x?: number;
  y?: number;
  bombs?: number;
  range?: number;
  [key: string]: unknown; // 允许游戏特定属性
}

/** 游戏房间 */
export interface Room {
  id: string;
  players: Player[];
  board?: any; // 各游戏自行定义具体类型，历史原因暂用 any（可选）
  phase: string;
  timeLeft?: number;
  current?: number;
  currentPlayer?: number; // 回合制游戏使用
  lastPlay?: any; // 扑克牌游戏使用
  passCount?: number; // 扑克牌游戏使用
  remaining?: string[]; // 扑克牌游戏使用
  timerId?: NodeJS.Timeout; // 定时器ID，用于清理
  [key: string]: unknown; // 允许游戏特定属性
}

/** 游戏消息 */
export interface GameMessage {
  type: string;
  data?: any;
}

/** 广播函数类型 */
export type BroadcastFn = (room: Room, type: string, data?: unknown) => void;
