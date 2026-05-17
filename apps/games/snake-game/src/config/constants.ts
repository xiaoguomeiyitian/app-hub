/** 游戏常量 */
import type { FoodType, SkillType } from '../types';

export const GRID_COLS = 40;
export const GRID_ROWS = 25;
export const CELL_SIZE = 24; // px
export const CANVAS_WIDTH = GRID_COLS * CELL_SIZE;
export const CANVAS_HEIGHT = GRID_ROWS * CELL_SIZE;

export const INITIAL_SPEED = 200; // ms per frame
export const SPEED_INCREMENT = 20; // ms faster every N foods
export const FOODS_PER_SPEED_UP = 5;
export const MIN_SPEED = 50; // fastest ms per frame

export const MAX_FOODS = 3;
export const FOOD_SPAWN_INTERVAL = 4000; // ms between auto-spawn checks

export const ONLINE_WS_PATH = '/openclaw/20008/api/snake-mp/websocket';
export const ONLINE_HTTP_PATH = '/openclaw/20008/api/snake-mp';
export const ONLINE_TICK_MS = 120;
export const ONLINE_COUNTDOWN_MS = 3000;
export const ONLINE_MAX_PLAYERS = 2;
export const ONLINE_JOIN_CODE_KEY = 'snake_online_join_code';

// === 新模式配置 (Phase 20) ===
export const TIMELIMIT_DURATION = 60; // seconds
export const TIMELIMIT_COUNTDOWN_WARN = 10; // seconds, turn red

export const SURVIVAL_BASE_INTERVAL = 200; // ms
export const SURVIVAL_SPEED_INCREASE = 8; // ms faster per food
export const SURVIVAL_MIN_INTERVAL = 40; // fastest ms

export const ROYALE_SHRINK_INTERVAL = 8000; // ms between border shrinks
export const ROYALE_SHRINK_AMOUNT = 1; // cells per shrink
export const ROYALE_INITIAL_BORDER = 0; // no border initially

export const COLORS = {
  background: '#16213e',
  grid: '#1a1a2e',
  snakeHead: '#00d4aa',
  snakeBody: '#00b894',
  // 第二条蛇颜色
  snakeHead2: '#ff6b6b',
  snakeBody2: '#e55050',
  food: '#ff6b6b',
  foodGlow: 'rgba(255, 107, 107, 0.35)',
  obstacle: '#4a4a6a',
  obstacleBorder: '#5e5e8e',
  trailWall: '#6c5ce7',
  trailWallBorder: '#8b7cf7',
} as const;

export interface FoodConfig {
  emoji: string;
  score: number;
  weight: number;
  color: string;
  glowColor: string;
  lifetime: number;
}

export const FOOD_CONFIG: Record<FoodType, FoodConfig> = {
  normal:    { emoji: '🍎', score: 1,  weight: 50, color: '#ff6b6b', glowColor: 'rgba(255,107,107,0.35)', lifetime: 0 },
  gold:      { emoji: '⭐', score: 5,  weight: 20, color: '#ffd93d', glowColor: 'rgba(255,217,61,0.4)',  lifetime: 3000 },
  frozen:    { emoji: '❄️', score: 1,  weight: 10, color: '#74b9ff', glowColor: 'rgba(116,185,255,0.4)', lifetime: 5000 },
  lightning: { emoji: '⚡', score: 1,  weight: 10, color: '#fdcb6e', glowColor: 'rgba(253,203,110,0.4)', lifetime: 5000 },
  diamond:   { emoji: '💎', score: 10, weight: 5,  color: '#a29bfe', glowColor: 'rgba(162,155,254,0.4)', lifetime: 0 },
  bomb:      { emoji: '💣', score: -3, weight: 5,  color: '#d63031', glowColor: 'rgba(214,48,49,0.4)',  lifetime: 0 },
};

export const MAZE_OBSTACLE_COUNT = 30;
export const MAZE_SAFE_DISTANCE = 3;

// === 技能卡系统 ===
export const MAX_SKILL_CARDS = 3;
export const FOODS_PER_SKILL = 5; // 每吃5个食物获得技能卡

export interface SkillConfig {
  emoji: string;
  name: string;
  duration: number; // ms, 0 = instant
  description: string;
}

export const SKILL_CONFIG: Record<SkillType, SkillConfig> = {
  wallPass:    { emoji: '🌀', name: '穿墙术',   duration: 5000,  description: '5秒内穿越墙壁' },
  ghost:       { emoji: '👻', name: '幽灵化',   duration: 3000,  description: '3秒内穿过自身' },
  magnet:      { emoji: '🧲', name: '磁铁',     duration: 5000,  description: '5秒内吸引附近食物' },
  timeStop:    { emoji: '⏳', name: '时间暂停', duration: 2000,  description: '2秒内暂停食物计时' },
  mirrorFlip:  { emoji: '🪞', name: '镜像翻转', duration: 0,     description: '瞬间翻转当前方向' },
  doubleScore: { emoji: '✖️', name: '分数翻倍', duration: 10000, description: '10秒内得分翻倍' },
};
