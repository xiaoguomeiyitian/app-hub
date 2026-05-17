export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface Point {
  x: number;
  y: number;
}

export type GameState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'GAME_OVER' | 'WIN';
export type GameMode = 'classic' | 'maze' | 'trail' | 'dual' | 'online' | 'timelimit' | 'survival' | 'royale';

export type FoodType = 'normal' | 'gold' | 'frozen' | 'lightning' | 'diamond' | 'bomb';
export type EffectType = 'frozen' | 'lightning';

export interface FoodItem {
  type: FoodType;
  position: Point;
  spawnTime: number;
  lifetime: number;
}

export interface ActiveEffect {
  type: EffectType;
  expiresAt: number;
}

export type SkillType = 'wallPass' | 'ghost' | 'magnet' | 'timeStop' | 'mirrorFlip' | 'doubleScore';

export interface SkillCard {
  type: SkillType;
  obtainedAt: number;
}

export interface ActiveSkill {
  type: SkillType;
  expiresAt: number;
}

export interface SnakeOptions {
  startX?: number;
  startY?: number;
  direction?: Direction;
  id?: string;
}

export type OnlineRoomPhase = 'waiting' | 'countdown' | 'playing' | 'ended';

export interface OnlinePlayerState {
  playerId: string;
  socketId: string;
  nickname: string;
  seat: number;
  color: 'green' | 'red' | 'blue' | 'yellow';
  ready: boolean;
  alive: boolean;
  score: number;
  direction: Direction;
  body: Point[];
  disconnected: boolean;
}

export interface OnlineRoomSnapshot {
  roomId: string;
  hostPlayerId: string;
  phase: OnlineRoomPhase;
  tick: number;
  countdownEndsAt: number | null;
  winnerPlayerId: string | null;
  message: string;
  foods: Point[];
  players: OnlinePlayerState[];
}

export interface OnlineConnectionState {
  socketId: string | null;
  roomId: string | null;
  playerId: string | null;
  token: string | null;
  connected: boolean;
  phase: OnlineRoomPhase;
  error: string | null;
}

export interface GameStats {
  score: number;
  duration: number; // seconds
  foodsEaten: number;
  maxSpeed: number;
  skillsUsed: number;
  isNewRecord: boolean;
}
