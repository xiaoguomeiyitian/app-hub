import type { Direction, Point, SnakeOptions } from '../types';
import { GRID_COLS, GRID_ROWS } from '../config/constants';

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

export class Snake {
  body: Point[];
  direction: Direction;
  private nextDirection: Direction;
  private growing: boolean;
  readonly id: string;
  wrapMode = false; // Phase 24: 穿墙模式

  constructor(options?: SnakeOptions) {
    const startX = options?.startX ?? Math.floor(GRID_COLS / 2);
    const startY = options?.startY ?? Math.floor(GRID_ROWS / 2);
    const dir = options?.direction ?? 'RIGHT';
    this.id = options?.id ?? 'snake1';

    // 根据方向决定身体延伸方向
    const dx = dir === 'RIGHT' ? -1 : dir === 'LEFT' ? 1 : 0;
    const dy = dir === 'DOWN' ? -1 : dir === 'UP' ? 1 : 0;
    this.body = [
      { x: startX, y: startY },
      { x: startX + dx, y: startY + dy },
      { x: startX + dx * 2, y: startY + dy * 2 },
    ];
    this.direction = dir;
    this.nextDirection = dir;
    this.growing = false;
  }

  get head(): Point {
    return this.body[0];
  }

  setDirection(dir: Direction): void {
    if (dir !== OPPOSITE[this.direction]) {
      this.nextDirection = dir;
    }
  }

  move(): void {
    this.direction = this.nextDirection;
    const head = { ...this.head };
    switch (this.direction) {
      case 'UP': head.y -= 1; break;
      case 'DOWN': head.y += 1; break;
      case 'LEFT': head.x -= 1; break;
      case 'RIGHT': head.x += 1; break;
    }
    // Phase 24: 穿墙模式 - 坐标环形
    if (this.wrapMode) {
      if (head.x < 0) head.x = GRID_COLS - 1;
      if (head.x >= GRID_COLS) head.x = 0;
      if (head.y < 0) head.y = GRID_ROWS - 1;
      if (head.y >= GRID_ROWS) head.y = 0;
    }
    this.body.unshift(head);
    if (this.growing) {
      this.growing = false;
    } else {
      this.body.pop();
    }
  }

  grow(): void {
    this.growing = true;
  }

  shrink(count: number): void {
    for (let i = 0; i < count && this.body.length > 1; i++) {
      this.body.pop();
    }
  }

  occupy(x: number, y: number): boolean {
    return this.body.some(p => p.x === x && p.y === y);
  }
}
