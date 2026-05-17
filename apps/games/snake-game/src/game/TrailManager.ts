import type { Point } from '../types';
import { GRID_COLS, GRID_ROWS } from '../config/constants';

export class TrailManager {
  walls: Set<string>; // "x,y" strings for O(1) lookup

  constructor() {
    this.walls = new Set();
  }

  reset(): void {
    this.walls = new Set();
  }

  /** 记录蛇尾离开的位置为墙壁 */
  recordTail(tail: Point, snakeBodies: Set<string>): void {
    const key = `${tail.x},${tail.y}`;
    // 不在蛇身上的位置才变墙
    if (!snakeBodies.has(key)) {
      this.walls.add(key);
    }
  }

  isWall(x: number, y: number): boolean {
    return this.walls.has(`${x},${y}`);
  }

  /** 转为Point数组供碰撞检测使用 */
  toArray(): Point[] {
    const result: Point[] = [];
    for (const key of this.walls) {
      const [x, y] = key.split(',').map(Number);
      result.push({ x, y });
    }
    return result;
  }
}
