/** 2048 核心引擎 - 滑动合并 + 随机生成 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface MoveResult {
  moved: boolean;
  board: number[][];
  merges: Array<{ value: number; row: number; col: number }>;
  score: number;
}

export class Engine {
  size = 4;
  board: number[][];

  constructor() {
    this.board = this.empty();
  }

  private empty(): number[][] {
    return Array.from({ length: this.size }, () => Array(this.size).fill(0));
  }

  reset(): void {
    this.board = this.empty();
    this.spawn();
    this.spawn();
  }

  /** 滑动合并 */
  move(dir: Direction): MoveResult {
    const b = this.board.map(r => [...r]);
    let moved = false;
    let score = 0;
    const merges: MoveResult['merges'] = [];

    const rotate = (times: number): void => {
      for (let t = 0; t < times; t++) {
        const n = this.size;
        const r: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            r[j][n - 1 - i] = b[i][j];
          }
        }
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            b[i][j] = r[i][j];
          }
        }
      }
    };

    // 旋转使方向统一为 left
    const rotations: Record<Direction, number> = { left: 0, up: 3, right: 2, down: 1 };
    rotate(rotations[dir]);

    // 向左合并
    for (let r = 0; r < this.size; r++) {
      const row = b[r].filter(c => c !== 0);
      const merged: number[] = [];
      let i = 0;
      while (i < row.length) {
        if (i + 1 < row.length && row[i] === row[i + 1]) {
          const val = row[i] * 2;
          merged.push(val);
          score += val;
          merges.push({ value: val, row: r, col: merged.length - 1 });
          i += 2;
        } else {
          merged.push(row[i]);
          i++;
        }
      }
      while (merged.length < this.size) merged.push(0);

      for (let c = 0; c < this.size; c++) {
        if (b[r][c] !== merged[c]) moved = true;
        b[r][c] = merged[c];
      }
    }

    // 旋转回来
    rotate((4 - rotations[dir]) % 4);

    if (moved) {
      this.board = b;
      this.spawn();
    }

    return { moved, board: this.board, merges, score };
  }

  /** 在空位随机生成 2 或 4 */
  spawn(): { value: number; row: number; col: number } | null {
    const empty: [number, number][] = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 0) empty.push([r, c]);
      }
    }
    if (empty.length === 0) return null;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() > 0.9 ? 4 : 2;
    this.board[r][c] = value;
    return { value, row: r, col: c };
  }

  /** 是否可移动 */
  canMove(): boolean {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 0) return true;
        if (c < this.size - 1 && this.board[r][c] === this.board[r][c + 1]) return true;
        if (r < this.size - 1 && this.board[r][c] === this.board[r + 1][c]) return true;
      }
    }
    return false;
  }

  /** 最大数字 */
  maxTile(): number {
    return Math.max(...this.board.flat());
  }

  /** 总分 */
  totalScore(): number {
    // 近似：所有数字之和减去初始
    return this.board.flat().reduce((s, v) => s + v, 0) - 4; // 减去初始的 2+2
  }
}
