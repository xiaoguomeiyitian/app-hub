import type { PieceType, Piece, GameState } from '../types.js';
import { COLS, ROWS } from '../core/Board.js';
import { getShape, COLORS } from '../core/Piece.js';

const CELL = 28;
const GAP = 1;

/** Canvas 渲染器 */
export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private holdCanvas: HTMLCanvasElement;
  private holdCtx: CanvasRenderingContext2D;
  private nextCanvas: HTMLCanvasElement;
  private nextCtx: CanvasRenderingContext2D;
  private opponentCanvas: HTMLCanvasElement | null = null;
  private opponentCtx: CanvasRenderingContext2D | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    holdCanvas: HTMLCanvasElement,
    nextCanvas: HTMLCanvasElement,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.holdCanvas = holdCanvas;
    this.holdCtx = holdCanvas.getContext('2d')!;
    this.nextCanvas = nextCanvas;
    this.nextCtx = nextCanvas.getContext('2d')!;

    this.resize();
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    // 主棋盘
    const w = COLS * CELL;
    const h = ROWS * CELL;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);

    // Hold
    this.holdCanvas.style.width = `${4 * CELL}px`;
    this.holdCanvas.style.height = `${3 * CELL}px`;
    this.holdCanvas.width = 4 * CELL * dpr;
    this.holdCanvas.height = 3 * CELL * dpr;
    this.holdCtx.scale(dpr, dpr);

    // Next
    this.nextCanvas.style.width = `${4 * CELL}px`;
    this.nextCanvas.style.height = `${15 * CELL}px`;
    this.nextCanvas.width = 4 * CELL * dpr;
    this.nextCanvas.height = 15 * CELL * dpr;
    this.nextCtx.scale(dpr, dpr);
  }

  /** 完整渲染 */
  render(state: GameState, ghostY?: number): void {
    this.renderBoard(state.board, state.current, ghostY);
    this.renderHold(state.hold, state.canHold);
    this.renderNext(state.next);
  }

  /** 渲染主棋盘 */
  private renderBoard(board: number[][], current: Piece | null, ghostY?: number): void {
    const ctx = this.ctx;
    const w = COLS * CELL;
    const h = ROWS * CELL;

    // 背景
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // 网格
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
      }
    }

    // 已锁定方块
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== 0) {
          this.drawCell(ctx, c, r, this.colorForIndex(board[r][c]));
        }
      }
    }

    // Ghost
    if (current && ghostY !== undefined && ghostY !== current.y) {
      const shape = getShape(current.type, current.rotation);
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const br = ghostY + r;
          const bc = current.x + c;
          if (br >= 0 && br < ROWS) {
            this.drawGhostCell(ctx, bc, br, COLORS[current.type]);
          }
        }
      }
    }

    // 当前方块
    if (current) {
      const shape = getShape(current.type, current.rotation);
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const br = current.y + r;
          const bc = current.x + c;
          if (br >= 0 && br < ROWS) {
            this.drawCell(ctx, bc, br, COLORS[current.type]);
          }
        }
      }
    }
  }

  /** 渲染 Hold */
  private renderHold(hold: PieceType | null, canHold: boolean): void {
    const ctx = this.holdCtx;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 4 * CELL, 3 * CELL);
    if (hold) {
      const alpha = canHold ? 1 : 0.3;
      ctx.globalAlpha = alpha;
      this.drawPieceInBox(ctx, hold, 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  /** 渲染 Next 预览 */
  private renderNext(next: PieceType[]): void {
    const ctx = this.nextCtx;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 4 * CELL, 15 * CELL);
    for (let i = 0; i < Math.min(next.length, 5); i++) {
      this.drawPieceInBox(ctx, next[i], 0, i * 3 * CELL);
    }
  }

  /** 在小框中绘制方块 */
  private drawPieceInBox(ctx: CanvasRenderingContext2D, type: PieceType, ox: number, oy: number): void {
    const shape = getShape(type, 0);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const x = ox + c * CELL + (type === 'I' ? 0 : CELL * 0.5);
        const y = oy + r * CELL;
        ctx.fillStyle = COLORS[type];
        ctx.fillRect(x + GAP, y + GAP, CELL - GAP * 2, CELL - GAP * 2);
        // 高光
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x + GAP, y + GAP, CELL - GAP * 2, 3);
      }
    }
  }

  /** 绘制单个格子 */
  private drawCell(ctx: CanvasRenderingContext2D, col: number, row: number, color: string): void {
    const x = col * CELL;
    const y = row * CELL;
    ctx.fillStyle = color;
    ctx.fillRect(x + GAP, y + GAP, CELL - GAP * 2, CELL - GAP * 2);
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + GAP, y + GAP, CELL - GAP * 2, 3);
  }

  /** 绘制 Ghost 格子 */
  private drawGhostCell(ctx: CanvasRenderingContext2D, col: number, row: number, color: string): void {
    const x = col * CELL;
    const y = row * CELL;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + GAP + 1, y + GAP + 1, CELL - GAP * 2 - 2, CELL - GAP * 2 - 2);
  }

  /** 数值编码转颜色 */
  private colorForIndex(idx: number): string {
    const types: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    if (idx >= 1 && idx <= 7) return COLORS[types[idx - 1]];
    if (idx === 8) return '#555'; // 垃圾行
    return '#333';
  }

  /** 设置对手画布 */
  setOpponentCanvas(canvas: HTMLCanvasElement): void {
    this.opponentCanvas = canvas;
    this.opponentCtx = canvas.getContext('2d');
  }

  /** 渲染对手小窗 */
  renderOpponent(board: number[][]): void {
    if (!this.opponentCtx || !this.opponentCanvas) return;
    const ctx = this.opponentCtx;
    const scale = 0.5;
    const cw = COLS * CELL * scale;
    const ch = ROWS * CELL * scale;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, cw, ch);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== 0) {
          ctx.fillStyle = this.colorForIndex(board[r][c]);
          ctx.fillRect(c * CELL * scale, r * CELL * scale, CELL * scale - 1, CELL * scale - 1);
        }
      }
    }
  }

  getCanvas(): HTMLCanvasElement { return this.canvas; }
}
