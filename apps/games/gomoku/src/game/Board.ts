import { Player } from '../types/index.js';
import type { Position, Move, WinInfo } from '../types/index.js';
import { BOARD_SIZE, DIRECTIONS } from './constants.js';

/**
 * 棋盘状态管理
 * 负责 15×15 棋盘数组、落子、撤子、胜负判定
 */
export class Board {
  private grid: Player[][];
  private moveHistory: Move[] = [];
  private moveCount = 0;

  constructor() {
    this.grid = this.createEmptyGrid();
  }

  /** 创建空棋盘 */
  private createEmptyGrid(): Player[][] {
    return Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => Player.None)
    );
  }

  /** 获取格子值 */
  getCell(row: number, col: number): Player {
    return this.grid[row][col];
  }

  /** 设置格子值 */
  setCell(row: number, col: number, player: Player): void {
    this.grid[row][col] = player;
  }

  /** 检查是否空位 */
  isEmpty(row: number, col: number): boolean {
    return this.grid[row][col] === Player.None;
  }

  /** 检查坐标是否在棋盘范围内 */
  inBounds(row: number, col: number): boolean {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  /** 落子 */
  placePiece(row: number, col: number, player: Player): boolean {
    if (!this.inBounds(row, col) || !this.isEmpty(row, col)) {
      return false;
    }
    this.grid[row][col] = player;
    this.moveHistory.push({ row, col, player });
    this.moveCount++;
    return true;
  }

  /** 撤销最后一步 */
  undo(): Move | null {
    const move = this.moveHistory.pop();
    if (!move) return null;
    this.grid[move.row][move.col] = Player.None;
    this.moveCount--;
    return move;
  }

  /** 检查落子后是否胜利，返回胜利信息 */
  checkWin(row: number, col: number, player: Player): WinInfo | null {
    for (const [dr, dc] of DIRECTIONS) {
      const cells: Position[] = [{ row, col }];

      // 正方向延伸
      for (let i = 1; i < 5; i++) {
        const nr = row + dr * i;
        const nc = col + dc * i;
        if (!this.inBounds(nr, nc) || this.grid[nr][nc] !== player) break;
        cells.push({ row: nr, col: nc });
      }

      // 反方向延伸
      for (let i = 1; i < 5; i++) {
        const nr = row - dr * i;
        const nc = col - dc * i;
        if (!this.inBounds(nr, nc) || this.grid[nr][nc] !== player) break;
        cells.push({ row: nr, col: nc });
      }

      if (cells.length >= 5) {
        // 按方向排序
        cells.sort((a, b) => a.row - b.row || a.col - b.col);
        return { winner: player, cells: cells.slice(0, 5) };
      }
    }
    return null;
  }

  /** 检查是否平局（棋盘满） */
  isDraw(): boolean {
    return this.moveCount >= BOARD_SIZE * BOARD_SIZE;
  }

  /** 获取所有已落子位置 */
  getOccupiedCells(): Position[] {
    const result: Position[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.grid[r][c] !== Player.None) {
          result.push({ row: r, col: c });
        }
      }
    }
    return result;
  }

  /** 获取棋盘快照（用于 AI 搜索） */
  getGrid(): ReadonlyArray<ReadonlyArray<Player>> {
    return this.grid;
  }

  /** 克隆棋盘（AI 搜索用） */
  clone(): Board {
    const board = new Board();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        board.grid[r][c] = this.grid[r][c];
      }
    }
    board.moveHistory = [...this.moveHistory];
    board.moveCount = this.moveCount;
    return board;
  }

  /** 重置棋盘 */
  reset(): void {
    this.grid = this.createEmptyGrid();
    this.moveHistory = [];
    this.moveCount = 0;
  }

  /** 落子数量 */
  get moveTotal(): number {
    return this.moveCount;
  }
}
