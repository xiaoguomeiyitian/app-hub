import { Engine, type Direction, type MoveResult } from '../core/Engine.js';

const SIZE = 4;
const CELL = 80;
const GAP = 8;
const BOARD_SIZE = SIZE * CELL + (SIZE + 1) * GAP;

const TILE_COLORS: Record<number, string> = {
  0: '#cdc1b4',
  2: '#eee4da',
  4: '#ede0c8',
  8: '#f2b179',
  16: '#f59563',
  32: '#f67c5f',
  64: '#f65e3b',
  128: '#edcf72',
  256: '#edcc61',
  512: '#edc850',
  1024: '#edc53f',
  2048: '#edc22e',
};

const TEXT_COLORS: Record<number, string> = {
  0: '#cdc1b4',
  2: '#776e65',
  4: '#776e65',
  8: '#f9f6f2',
  16: '#f9f6f2',
  32: '#f9f6f2',
  64: '#f9f6f2',
  128: '#f9f6f2',
  256: '#f9f6f2',
  512: '#f9f6f2',
  1024: '#f9f6f2',
  2048: '#f9f6f2',
};

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize: number;
  private gap: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.cellSize = CELL;
    this.gap = GAP;
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${BOARD_SIZE}px`;
    this.canvas.style.height = `${BOARD_SIZE}px`;
    this.canvas.width = BOARD_SIZE * dpr;
    this.canvas.height = BOARD_SIZE * dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  render(board: number[][]): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#bbada0';
    ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = board[r][c];
        const x = this.gap + c * (this.cellSize + this.gap);
        const y = this.gap + r * (this.cellSize + this.gap);

        ctx.fillStyle = TILE_COLORS[val] || '#3c3a32';
        this.roundRect(ctx, x, y, this.cellSize, this.cellSize, 6);
        ctx.fill();

        if (val !== 0) {
          ctx.fillStyle = TEXT_COLORS[val] || '#f9f6f2';
          const fontSize = val >= 1024 ? 24 : val >= 128 ? 32 : 40;
          ctx.font = `bold ${fontSize}px -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(val), x + this.cellSize / 2, y + this.cellSize / 2 + 2);
        }
      }
    }
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  getCanvas(): HTMLCanvasElement { return this.canvas; }
}

const STORAGE_KEY = 'game2048_best';

export class Game2048 {
  engine: Engine;
  renderer: Renderer;
  scoreEl: HTMLElement;
  bestEl: HTMLElement;
  statusEl: HTMLElement;
  score = 0;
  best = 0;
  moves = 0;
  gameOver = false;
  won = false;
  private onMove: ((dir: Direction, result: MoveResult, gameOver: boolean) => void) | null = null;

  // Undo
  private prevBoard: number[][] | null = null;
  private prevScore = 0;
  private prevMoves = 0;

  constructor(canvas: HTMLCanvasElement, scoreEl: HTMLElement, bestEl: HTMLElement, statusEl: HTMLElement) {
    this.engine = new Engine();
    this.renderer = new Renderer(canvas);
    this.scoreEl = scoreEl;
    this.bestEl = bestEl;
    this.statusEl = statusEl;
    this.best = this.loadBest();
    this.bindInput();
    this.start();
  }

  private loadBest(): number {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v ? parseInt(v, 10) || 0 : 0;
    } catch { return 0; }
  }

  private saveBest(): void {
    try { localStorage.setItem(STORAGE_KEY, String(this.best)); } catch {}
  }

  setMoveCallback(cb: ((dir: Direction, result: MoveResult, gameOver: boolean) => void) | null): void {
    this.onMove = cb;
  }

  start(): void {
    this.engine.reset();
    this.score = 0;
    this.moves = 0;
    this.gameOver = false;
    this.won = false;
    this.prevBoard = null;
    this.updateUI();
    this.render();
  }

  getScore(): number { return this.score; }
  getEngine(): Engine { return this.engine; }
  getMoves(): number { return this.moves; }
  canUndo(): boolean { return this.prevBoard !== null; }

  /** 撤销上一步 */
  undo(): boolean {
    if (!this.prevBoard || this.gameOver) return false;
    this.engine.board = this.prevBoard.map(r => [...r]);
    this.score = this.prevScore;
    this.moves = this.prevMoves;
    this.prevBoard = null;
    this.gameOver = false;
    this.updateUI();
    this.render();
    return true;
  }

  private handleDir(dir: Direction): void {
    if (this.gameOver) return;

    // 保存撤销状态
    this.prevBoard = this.engine.board.map(r => [...r]);
    this.prevScore = this.score;
    this.prevMoves = this.moves;

    const result = this.engine.move(dir);
    if (!result.moved) {
      this.prevBoard = null; // 没移动，不消耗 undo
      return;
    }

    this.score += result.score;
    this.moves++;
    if (this.score > this.best) {
      this.best = this.score;
      this.saveBest();
    }

    // 胜利检测
    if (!this.won && this.engine.maxTile() >= 2048) {
      this.won = true;
    }

    this.updateUI();
    this.render();

    if (!this.engine.canMove()) {
      this.gameOver = true;
      this.updateUI();
    }

    this.onMove?.(dir, result, this.gameOver);
  }

  private updateUI(): void {
    this.scoreEl.textContent = String(this.score);
    this.bestEl.textContent = String(this.best);
    if (this.gameOver) {
      this.statusEl.textContent = `游戏结束！分数: ${this.score} | ${this.moves} 步`;
    } else if (this.won) {
      this.statusEl.textContent = '🎉 达成 2048！继续挑战更高数字';
    } else {
      this.statusEl.textContent = `滑动合并数字 | ${this.moves} 步`;
    }
  }

  private render(): void {
    this.renderer.render(this.engine.board);
  }

  private bindInput(): void {
    const canvas = this.renderer.getCanvas();

    // 触摸/鼠标滑动
    let startX = 0;
    let startY = 0;
    let pointerDown = false;

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerDown = true;
      startX = e.clientX;
      startY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    });

    canvas.addEventListener('pointerup', (e) => {
      if (!pointerDown) return;
      pointerDown = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (Math.max(absDx, absDy) < 20) return;
      if (absDx > absDy) {
        this.handleDir(dx > 0 ? 'right' : 'left');
      } else {
        this.handleDir(dy > 0 ? 'down' : 'up');
      }
    });

    canvas.addEventListener('pointercancel', () => { pointerDown = false; });
  }
}
