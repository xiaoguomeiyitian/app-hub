import type { PieceType, GameState, ClearResult } from '../types.js';
import { Board } from '../core/Board.js';
import { Bag } from '../core/Bag.js';
import { getShape, getKicks, nextRotation } from '../core/Piece.js';
import { calculateAttack } from '../core/LineClear.js';
import type { Piece } from '../types.js';

const PREVIEW_COUNT = 5;
const TARGET_LINES = 40;

/** 40 行竞速模式 */
export class SprintMode {
  board: Board;
  bag: Bag;
  current: Piece | null = null;
  hold: PieceType | null = null;
  canHold = true;
  next: PieceType[] = [];
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  b2b = 0;
  gameOver = false;
  paused = false;
  private lastActionWasRotation = false;

  // 计时
  private startTime = 0;
  elapsed = 0;
  private finished = false;

  // 统计
  tspinCount = 0;
  quadCount = 0;
  allClearCount = 0;
  maxCombo = 0;
  maxB2B = 0;

  constructor() {
    this.board = new Board();
    this.bag = new Bag(PREVIEW_COUNT);
    this.next = this.bag.peek(PREVIEW_COUNT);
    this.spawn();
    this.startTime = performance.now();
  }

  getState(): GameState {
    return {
      board: this.board.getGrid(),
      current: this.current,
      hold: this.hold,
      canHold: this.canHold,
      next: this.next,
      score: this.score,
      lines: this.lines,
      level: this.level,
      combo: this.combo,
      b2b: this.b2b,
      gameOver: this.gameOver,
      paused: this.paused,
    };
  }

  getGhostY(): number {
    if (!this.current) return 0;
    return this.board.ghostY(this.current);
  }

  getElapsed(): number {
    if (this.finished) return this.elapsed;
    if (this.paused) return this.elapsed;
    return performance.now() - this.startTime;
  }

  isFinished(): boolean { return this.finished; }

  handleAction(action: string): ClearResult | null {
    if (this.gameOver || this.paused || !this.current) return null;

    switch (action) {
      case 'left': this.move(-1, 0); return null;
      case 'right': this.move(1, 0); return null;
      case 'softDrop': this.move(0, 1); return null;
      case 'hardDrop': return this.hardDrop();
      case 'rotateCW': return this.rotate(1);
      case 'rotateCCW': return this.rotate(-1);
      case 'hold': this.doHold(); return null;
      case 'pause': this.paused = !this.paused;
        if (this.paused) this.elapsed = performance.now() - this.startTime;
        else this.startTime = performance.now() - this.elapsed;
        return null;
      default: return null;
    }
  }

  private move(dx: number, dy: number): boolean {
    if (!this.current) return false;
    const test = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
    if (this.board.canPlace(test)) {
      this.current = test;
      if (dy === 0) this.lastActionWasRotation = false;
      return true;
    }
    return false;
  }

  private rotate(dir: 1 | -1): ClearResult | null {
    if (!this.current) return null;
    const from = this.current.rotation;
    const to = nextRotation(from, dir);
    const kicks = getKicks(this.current.type, from, to);
    for (const [kx, ky] of kicks) {
      const test: Piece = { ...this.current, rotation: to, x: this.current.x + kx, y: this.current.y + ky };
      if (this.board.canPlace(test)) {
        this.current = test;
        this.lastActionWasRotation = true;
        return null;
      }
    }
    return null;
  }

  private hardDrop(): ClearResult | null {
    if (!this.current) return null;
    this.current.y = this.board.ghostY(this.current);
    this.lastActionWasRotation = false;
    return this.lock();
  }

  tick(): ClearResult | null {
    if (this.gameOver || this.paused || !this.current) return null;
    if (!this.move(0, 1)) return this.lock();
    return null;
  }

  private lock(): ClearResult | null {
    if (!this.current) return null;
    const tspin = this.board.detectTSpin(this.current, this.lastActionWasRotation);
    this.board.lock(this.current);
    const { cleared } = this.board.clearLines();
    const linesCleared = cleared.length;
    this.lines += linesCleared;

    let result: ClearResult | null = null;
    if (linesCleared > 0) {
      const allClear = this.board.isEmpty();
      result = calculateAttack(linesCleared, tspin, this.b2b, this.combo, allClear);
      this.score += result.linesCleared * 100;
      this.b2b = result.b2bBonus > 0 ? this.b2b + 1 : 0;
      this.combo = result.combo;

      // 统计
      if (tspin !== 'none') this.tspinCount++;
      if (linesCleared === 4) this.quadCount++;
      if (allClear) this.allClearCount++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      if (this.b2b > this.maxB2B) this.maxB2B = this.b2b;
    } else {
      this.combo = 0;
    }

    this.canHold = true;
    this.lastActionWasRotation = false;

    // 检查 40 行完成
    if (this.lines >= TARGET_LINES) {
      this.finished = true;
      this.elapsed = performance.now() - this.startTime;
      this.gameOver = true;
      return result;
    }

    this.spawn();
    return result;
  }

  private doHold(): void {
    if (!this.canHold || !this.current) return;
    this.canHold = false;
    const prev = this.hold;
    this.hold = this.current.type;
    if (prev) this.current = this.createPiece(prev);
    else this.spawn();
    this.lastActionWasRotation = false;
  }

  spawn(): void {
    const type = this.bag.next();
    this.next = this.bag.peek(PREVIEW_COUNT);
    this.current = this.createPiece(type);
    if (!this.board.canPlace(this.current)) this.gameOver = true;
  }

  private createPiece(type: PieceType): Piece {
    const shape = getShape(type, 0);
    return { type, x: Math.floor((10 - shape[0].length) / 2), y: -1, rotation: 0 };
  }

  getDropInterval(): number { return 50; }
}
