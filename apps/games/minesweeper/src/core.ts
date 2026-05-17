// ===== 类型定义 =====
export type CellState = 'hidden' | 'revealed' | 'flagged' | 'question';
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface Cell {
  mine: boolean;
  state: CellState;
  adjacent: number;
}

export interface BoardConfig {
  width: number;
  height: number;
  mines: number;
}

export interface BestRecord {
  beginner: number | null;
  intermediate: number | null;
  expert: number | null;
}

// ===== 布雷算法（与后端一致） =====
export function generateMines(width: number, height: number, count: number, seed: string): Set<string> {
  const mines = new Set<string>();
  let hash = 0;
  for (const c of seed) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  while (mines.size < count) {
    const x = Math.abs((hash * (mines.size + 1)) % width);
    const y = Math.abs(((hash * 7 + mines.size * 13)) % height);
    mines.add(`${x},${y}`);
    hash = (hash * 1103515245 + 12345) | 0;
  }
  return mines;
}

/** 随机布雷（单人模式） */
export function generateRandomMines(width: number, height: number, count: number, safeX: number, safeY: number): Set<string> {
  const mines = new Set<string>();
  const safeZone = new Set<string>();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      safeZone.add(`${safeX + dx},${safeY + dy}`);
    }
  }
  while (mines.size < count) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const key = `${x},${y}`;
    if (!safeZone.has(key)) mines.add(key);
  }
  return mines;
}

/** 邻雷计数 */
export function countAdjacent(x: number, y: number, mines: Set<string>, w: number, h: number): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && mines.has(`${nx},${ny}`)) count++;
    }
  }
  return count;
}

/** 创建空棋盘 */
export function createBoard(width: number, height: number): Cell[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ mine: false, state: 'hidden' as CellState, adjacent: 0 }))
  );
}

/** 用 mine set 填充棋盘 */
export function populateBoard(board: Cell[][], mines: Set<string>): void {
  const h = board.length, w = board[0].length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      board[y][x].mine = mines.has(`${x},${y}`);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      board[y][x].adjacent = countAdjacent(x, y, mines, w, h);
    }
  }
}

/** flood-fill 展开空白格 */
export function floodReveal(x: number, y: number, board: Cell[][]): void {
  const h = board.length, w = board[0].length;
  const stack: [number, number][] = [[x, y]];
  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
    const cell = board[cy][cx];
    if (cell.state !== 'hidden') continue;
    cell.state = 'revealed';
    if (cell.adjacent === 0 && !cell.mine) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          stack.push([cx + dx, cy + dy]);
        }
      }
    }
  }
}

/** 胜负检测：所有非雷格已揭示 */
export function checkWin(board: Cell[][]): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (!cell.mine && cell.state !== 'revealed') return false;
    }
  }
  return true;
}

/** 计算剩余雷数（总雷数 - 已插旗数） */
export function remainingMines(board: Cell[][]): number {
  let flags = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.state === 'flagged') flags++;
    }
  }
  // 这里需要外部传入总雷数
  return flags;
}
