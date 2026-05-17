import type { PieceType, Piece, GameState, ClearResult } from '../types.js';
import { Board } from '../core/Board.js';
import { Bag } from '../core/Bag.js';
import { getShape, getKicks, nextRotation } from '../core/Piece.js';
import { calculateAttack } from '../core/LineClear.js';
import { GarbageManager } from '../core/Garbage.js';

const PREVIEW_COUNT = 5;

/** 无尽模式引擎 */
export class EndlessMode {
  board: Board;
  bag: Bag;
  garbage: GarbageManager;
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

  constructor() {
    this.board = new Board();
    this.bag = new Bag(PREVIEW_COUNT);
    this.garbage = new GarbageManager();
    this.next = this.bag.peek(PREVIEW_COUNT);
    this.spawn();
  }

  /** 获取游戏快照 */
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

  /** Ghost Y */
  getGhostY(): number {
    if (!this.current) return 0;
    return this.board.ghostY(this.current);
  }

  /** 处理动作 */
  handleAction(action: string): ClearResult | null {
    if (this.gameOver || this.paused || !this.current) return null;

    switch (action) {
      case 'left': return this.move(-1, 0) ? null : null;
      case 'right': return this.move(1, 0) ? null : null;
      case 'softDrop': return this.move(0, 1) ? null : null;
      case 'hardDrop': return this.hardDrop();
      case 'rotateCW': return this.rotate(1);
      case 'rotateCCW': return this.rotate(-1);
      case 'hold': this.doHold(); return null;
      case 'pause': this.paused = !this.paused; return null;
      default: return null;
    }
  }

  /** 移动 */
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

  /** 旋转 */
  private rotate(dir: 1 | -1): ClearResult | null {
    if (!this.current) return null;
    const from = this.current.rotation;
    const to = nextRotation(from, dir);
    const kicks = getKicks(this.current.type, from, to);

    for (const [kx, ky] of kicks) {
      const test: Piece = {
        ...this.current,
        rotation: to,
        x: this.current.x + kx,
        y: this.current.y + ky,
      };
      if (this.board.canPlace(test)) {
        this.current = test;
        this.lastActionWasRotation = true;
        return null;
      }
    }
    return null;
  }

  /** 硬降 */
  private hardDrop(): ClearResult | null {
    if (!this.current) return null;
    const gy = this.board.ghostY(this.current);
    this.current.y = gy;
    this.score += (gy - this.current.y) * 2; // 硬降分数
    this.lastActionWasRotation = false;
    return this.lock();
  }

  /** 自然下落一格（由外部 timer 调用） */
  tick(): ClearResult | null {
    if (this.gameOver || this.paused || !this.current) return null;

    if (!this.move(0, 1)) {
      return this.lock();
    }
    return null;
  }

  /** 锁定当前方块 */
  private lock(): ClearResult | null {
    if (!this.current) return null;

    // T-Spin 检测
    const tspin = this.board.detectTSpin(this.current, this.lastActionWasRotation);

    this.board.lock(this.current);

    // 消行
    const { cleared } = this.board.clearLines();
    const linesCleared = cleared.length;

    // 垃圾行抵消
    this.garbage.cancel(linesCleared);
    this.lines += linesCleared;

    // 攻击计算
    let result: ClearResult | null = null;
    if (linesCleared > 0) {
      const allClear = this.board.isEmpty();
      result = calculateAttack(linesCleared, tspin, this.b2b, this.combo, allClear);
      this.score += result.linesCleared * 100 * this.level;
      this.score += result.totalAttack * 50;
      this.b2b = result.b2bBonus > 0 ? this.b2b + 1 : 0;
      this.combo = result.combo;
    } else {
      this.combo = 0;
    }

    // 等级
    this.level = Math.floor(this.lines / 10) + 1;

    // 应用垃圾行
    this.board.grid = this.garbage.apply(this.board.getGrid());

    // 重置 hold
    this.canHold = true;
    this.lastActionWasRotation = false;

    // 生成下一个
    this.spawn();

    return result;
  }

  /** Hold */
  private doHold(): void {
    if (!this.canHold || !this.current) return;
    this.canHold = false;
    const prev = this.hold;
    this.hold = this.current.type;
    if (prev) {
      this.current = this.createPiece(prev);
    } else {
      this.spawn();
    }
    this.lastActionWasRotation = false;
  }

  /** 生成新方块 */
  spawn(): void {
    const type = this.bag.next();
    this.next = this.bag.peek(PREVIEW_COUNT);
    this.current = this.createPiece(type);

    // 检查 game over
    if (!this.board.canPlace(this.current)) {
      this.gameOver = true;
    }
  }

  createPiece(type: PieceType): Piece {
    const shape = getShape(type, 0);
    return {
      type,
      x: Math.floor((10 - shape[0].length) / 2),
      y: type === 'I' ? -1 : -1,
      rotation: 0,
    };
  }

  /** 获取下落速度（ms） */
  getDropInterval(): number {
    // 标准速度曲线
    const speeds = [800, 720, 630, 550, 470, 380, 300, 220, 130, 100, 80, 60, 50, 40, 30, 20, 15, 10, 8, 5];
    return speeds[Math.min(this.level - 1, speeds.length - 1)];
  }
}
