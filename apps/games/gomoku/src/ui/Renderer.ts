import { Player } from '../types/index.js';
import type { Position, WinInfo } from '../types/index.js';
import { BOARD_SIZE } from '../game/constants.js';
import type { Board } from '../game/Board.js';

/**
 * Canvas 渲染器
 * 负责绘制棋盘网格、棋子、最后落子标记、胜利连线
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize = 0;
  private padding = 0;
  private lastMove: Position | null = null;
  private winCells: Position[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  /** 自适应尺寸 */
  resize(): void {
    const container = this.canvas.parentElement;
    if (!container) return;

    const size = Math.min(container.clientWidth, window.innerHeight - 180);
    const dpr = window.devicePixelRatio || 1;

    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;

    this.ctx.scale(dpr, dpr);
    this.padding = size * 0.05;
    this.cellSize = (size - this.padding * 2) / (BOARD_SIZE - 1);
  }

  /** 绘制完整棋盘 */
  render(board: Board, lastMove?: Position | null, winInfo?: WinInfo | null): void {
    this.lastMove = lastMove ?? null;
    this.winCells = winInfo?.cells ?? [];

    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    // 清空
    this.ctx.clearRect(0, 0, w, h);

    // 背景
    this.ctx.fillStyle = '#DEB887';
    this.ctx.fillRect(0, 0, w, h);

    this.drawGrid();
    this.drawStarPoints();
    this.drawPieces(board);

    if (this.winCells.length > 0) {
      this.drawWinHighlight();
    }

    if (this.lastMove) {
      this.drawLastMoveMarker();
    }
  }

  /** 绘制网格线 */
  private drawGrid(): void {
    const ctx = this.ctx;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    for (let i = 0; i < BOARD_SIZE; i++) {
      const pos = this.padding + i * this.cellSize;

      // 横线
      ctx.beginPath();
      ctx.moveTo(this.padding, pos);
      ctx.lineTo(this.padding + (BOARD_SIZE - 1) * this.cellSize, pos);
      ctx.stroke();

      // 竖线
      ctx.beginPath();
      ctx.moveTo(pos, this.padding);
      ctx.lineTo(pos, this.padding + (BOARD_SIZE - 1) * this.cellSize);
      ctx.stroke();
    }
  }

  /** 绘制星位标记 */
  private drawStarPoints(): void {
    const points: Position[] = [
      { row: 3, col: 3 }, { row: 3, col: 7 }, { row: 3, col: 11 },
      { row: 7, col: 3 }, { row: 7, col: 7 }, { row: 7, col: 11 },
      { row: 11, col: 3 }, { row: 11, col: 7 }, { row: 11, col: 11 },
    ];

    const ctx = this.ctx;
    const radius = this.cellSize * 0.12;
    ctx.fillStyle = '#333';

    for (const p of points) {
      const x = this.padding + p.col * this.cellSize;
      const y = this.padding + p.row * this.cellSize;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 绘制所有棋子 */
  private drawPieces(board: Board): void {
    const grid = board.getGrid();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (grid[r][c] !== Player.None) {
          this.drawPiece(r, c, grid[r][c]);
        }
      }
    }
  }

  /** 绘制单个棋子（径向渐变） */
  private drawPiece(row: number, col: number, player: Player): void {
    const ctx = this.ctx;
    const x = this.padding + col * this.cellSize;
    const y = this.padding + row * this.cellSize;
    const radius = this.cellSize * 0.42;

    ctx.save();

    // 阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // 渐变
    const gradient = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, radius * 0.1,
      x, y, radius
    );

    if (player === Player.Black) {
      gradient.addColorStop(0, '#555');
      gradient.addColorStop(1, '#111');
    } else {
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(1, '#ccc');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 绘制最后落子标记 */
  private drawLastMoveMarker(): void {
    if (!this.lastMove) return;
    const ctx = this.ctx;
    const x = this.padding + this.lastMove.col * this.cellSize;
    const y = this.padding + this.lastMove.row * this.cellSize;
    const radius = this.cellSize * 0.12;

    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /** 绘制胜利连线高亮 */
  private drawWinHighlight(): void {
    const ctx = this.ctx;
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);

    if (this.winCells.length < 2) return;

    ctx.beginPath();
    const first = this.winCells[0];
    ctx.moveTo(
      this.padding + first.col * this.cellSize,
      this.padding + first.row * this.cellSize
    );

    for (let i = 1; i < this.winCells.length; i++) {
      const cell = this.winCells[i];
      ctx.lineTo(
        this.padding + cell.col * this.cellSize,
        this.padding + cell.row * this.cellSize
      );
    }
    ctx.stroke();
  }

  /** 像素坐标转棋盘坐标 */
  pixelToBoard(clientX: number, clientY: number): Position | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const col = Math.round((x - this.padding) / this.cellSize);
    const row = Math.round((y - this.padding) / this.cellSize);

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;

    // 检查是否接近交叉点
    const exactX = this.padding + col * this.cellSize;
    const exactY = this.padding + row * this.cellSize;
    const dist = Math.sqrt((x - exactX) ** 2 + (y - exactY) ** 2);
    if (dist > this.cellSize * 0.48) return null;

    return { row, col };
  }

  /** 获取画布元素 */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
