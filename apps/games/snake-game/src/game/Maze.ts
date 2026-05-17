import type { Point } from '../types';
import { GRID_COLS, GRID_ROWS, MAZE_OBSTACLE_COUNT, MAZE_SAFE_DISTANCE } from '../config/constants';

export class Maze {
  obstacles: Point[];

  constructor() {
    this.obstacles = [];
  }

  /** 生成迷宫障碍物（远离蛇头 SAFE_DISTANCE 格以上） */
  generate(headPos: Point, occupyFn: (x: number, y: number) => boolean): void {
    this.obstacles = [];
    const candidates: Point[] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      for (let y = 0; y < GRID_ROWS; y++) {
        // 远离蛇头
        if (Math.abs(x - headPos.x) + Math.abs(y - headPos.y) < MAZE_SAFE_DISTANCE) continue;
        // 不与蛇身重叠
        if (occupyFn(x, y)) continue;
        candidates.push({ x, y });
      }
    }
    // 随机选取
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    this.obstacles = shuffled.slice(0, MAZE_OBSTACLE_COUNT);
  }

  /** 检查某位置是否是障碍物 */
  isObstacle(x: number, y: number): boolean {
    return this.obstacles.some(p => p.x === x && p.y === y);
  }
}
