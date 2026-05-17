import { COLS, ROWS } from './Board.js';

/** 垃圾行管理器 */
export class GarbageManager {
  private pending = 0;

  /** 收到攻击 */
  receive(lines: number): void {
    this.pending += lines;
  }

  /** 消行抵消，返回剩余可抵消行数 */
  cancel(lines: number): number {
    const cancelled = Math.min(this.pending, lines);
    this.pending -= cancelled;
    return lines - cancelled;
  }

  /** 应用垃圾行到棋盘（返回新棋盘） */
  apply(grid: number[][]): number[][] {
    if (this.pending <= 0) return grid;
    const newGrid = grid.slice(this.pending);
    for (let i = 0; i < this.pending; i++) {
      const hole = Math.floor(Math.random() * COLS);
      const row = Array(COLS).fill(8); // 8 = 垃圾行标记
      row[hole] = 0;
      newGrid.push(row);
    }
    // 补空行到顶部
    while (newGrid.length < ROWS) {
      newGrid.unshift(Array(COLS).fill(0));
    }
    this.pending = 0;
    return newGrid;
  }

  getPending(): number {
    return this.pending;
  }

  reset(): void {
    this.pending = 0;
  }
}
