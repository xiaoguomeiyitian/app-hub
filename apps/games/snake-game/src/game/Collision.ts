import type { Point } from '../types';
import { GRID_COLS, GRID_ROWS } from '../config/constants';
import { Snake } from './Snake';

export class Collision {
  static wall(head: Point): boolean {
    return head.x < 0 || head.x >= GRID_COLS || head.y < 0 || head.y >= GRID_ROWS;
  }

  static self(snake: Snake): boolean {
    const head = snake.head;
    for (let i = 1; i < snake.body.length; i++) {
      if (snake.body[i].x === head.x && snake.body[i].y === head.y) return true;
    }
    return false;
  }

  static obstacle(head: Point, obstacles: Point[]): boolean {
    return obstacles.some(p => p.x === head.x && p.y === head.y);
  }

  /** 蛇A撞蛇B（跳过B的头部，避免同时移动时的歧义） */
  static snakeVsSnake(snakeA: Snake, snakeB: Snake): boolean {
    const head = snakeA.head;
    for (let i = 1; i < snakeB.body.length; i++) {
      if (snakeB.body[i].x === head.x && snakeB.body[i].y === head.y) return true;
    }
    return false;
  }

  static any(snake: Snake): boolean {
    return Collision.wall(snake.head) || Collision.self(snake);
  }

  static anyWithObstacles(snake: Snake, obstacles: Point[]): boolean {
    return Collision.wall(snake.head) || Collision.self(snake) || Collision.obstacle(snake.head, obstacles);
  }
}
