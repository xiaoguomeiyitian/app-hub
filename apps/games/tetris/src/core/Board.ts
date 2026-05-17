import type { Piece } from '../types.js';
import { getShape, PIECE_INDEX } from './Piece.js';

export const COLS = 10;
export const ROWS = 20;

/** 10×20 棋盘 */
export class Board {
  grid: number[][];

  constructor() {
    this.grid = this.empty();
  }

  private empty(): number[][] {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  reset(): void {
    this.grid = this.empty();
  }

  /** 检查方块是否可放置 */
  canPlace(piece: Piece): boolean {
    const shape = getShape(piece.type, piece.rotation);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const br = piece.y + r;
        const bc = piece.x + c;
        if (br < 0 || br >= ROWS || bc < 0 || bc >= COLS) return false;
        if (this.grid[br][bc] !== 0) return false;
      }
    }
    return true;
  }

  /** 锁定方块到棋盘 */
  lock(piece: Piece): void {
    const shape = getShape(piece.type, piece.rotation);
    const val = PIECE_INDEX[piece.type];
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const br = piece.y + r;
        const bc = piece.x + c;
        if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) {
          this.grid[br][bc] = val;
        }
      }
    }
  }

  /** 消除已满行，返回消除的行数 */
  clearLines(): { cleared: number[]; remaining: number[][] } {
    const cleared: number[] = [];
    const remaining: number[][] = [];
    for (let r = 0; r < ROWS; r++) {
      if (this.grid[r].every(c => c !== 0)) {
        cleared.push(r);
      } else {
        remaining.push(this.grid[r]);
      }
    }
    // 补空行到顶部
    while (remaining.length < ROWS) {
      remaining.unshift(Array(COLS).fill(0));
    }
    this.grid = remaining;
    return { cleared, remaining };
  }

  /** Ghost：计算方块最终落点 Y */
  ghostY(piece: Piece): number {
    let gy = piece.y;
    while (true) {
      const test = { ...piece, y: gy + 1 };
      if (!this.canPlace(test)) break;
      gy++;
    }
    return gy;
  }

  /** 检测 T-Spin（方块旋转落子后调用） */
  detectTSpin(piece: Piece, lastActionWasRotation: boolean): 'none' | 'mini' | 'full' {
    if (piece.type !== 'T' || !lastActionWasRotation) return 'none';
    // T 块中心（在 3×3 形状中 center = (1,1)）
    const cx = piece.x + 1;
    const cy = piece.y + 1;
    const diagonals = [
      [cy - 1, cx - 1], [cy - 1, cx + 1],
      [cy + 1, cx - 1], [cy + 1, cx + 1],
    ];
    let filled = 0;
    for (const [r, c] of diagonals) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || this.grid[r]?.[c] !== 0) {
        filled++;
      }
    }
    if (filled >= 3) return 'full';
    if (filled >= 2) return 'mini';
    return 'none';
  }

  /** 检查棋盘是否为空（All Clear） */
  isEmpty(): boolean {
    return this.grid.every(row => row.every(c => c === 0));
  }

  getGrid(): number[][] {
    return this.grid;
  }
}
