import type { Board, Position, Color } from './types';
import { PIECE_NAMES } from './types.js';

export class BoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize = 56;
  private boardWidth = 0;
  private boardHeight = 0;
  private offsetX = 0;
  private offsetY = 0;
  private dpr = 1;
  private perspective: Color = 'red';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;
    this.resize();
  }

  setPerspective(color: Color): void {
    this.perspective = color;
  }

  resize(): void {
    const container = this.canvas.parentElement;
    if (!container) return;

    this.dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const boardPadding = 8;
    const availableWidth = Math.max(280, Math.floor(rect.width - boardPadding));
    const isMobile = window.innerWidth <= 920;
    // 用父容器实际高度而非 window.innerHeight
    const parentH = container.closest('.board-column')?.getBoundingClientRect().height || (isMobile ? 480 : 640);
    const availableHeight = Math.max(280, Math.floor(parentH - boardPadding));

    const widthBased = Math.floor(availableWidth / 9.7);
    const heightBased = Math.floor(availableHeight / 10.7);
    const desired = Math.min(widthBased, heightBased);
    const minCell = isMobile ? 36 : 56;
    const maxCell = isMobile ? 74 : 96;
    this.cellSize = Math.max(minCell, Math.min(desired, maxCell));

    this.boardWidth = this.cellSize * 8;
    this.boardHeight = this.cellSize * 9;
    const innerWidth = this.boardWidth + this.cellSize * 2;
    const innerHeight = this.boardHeight + this.cellSize * 2;

    this.canvas.width = Math.round(innerWidth * this.dpr);
    this.canvas.height = Math.round(innerHeight * this.dpr);
    this.canvas.style.width = `${innerWidth}px`;
    this.canvas.style.height = `${innerHeight}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.offsetX = this.cellSize;
    this.offsetY = this.cellSize;
  }

  get cellW(): number {
    return this.cellSize;
  }

  private mapPos(col: number, row: number): Position {
    if (this.perspective === 'red') {
      return { col: 8 - col, row: 9 - row };
    }
    return { col, row };
  }

  private unmapPos(col: number, row: number): Position {
    if (this.perspective === 'red') {
      return { col: 8 - col, row: 9 - row };
    }
    return { col, row };
  }

  pixelToBoard(px: number, py: number): Position | null {
    // Bug #10: 扩大触屏点击判定范围（从 ±0.5 改为 ±0.6 cellSize）
    const rawCol = (px - this.offsetX) / this.cellSize;
    const rawRow = (py - this.offsetY) / this.cellSize;
    const col = Math.round(rawCol);
    const row = Math.round(rawRow);
    // 检查点击是否在最近交叉点的 0.6 cellSize 范围内
    if (Math.abs(rawCol - col) > 0.6 || Math.abs(rawRow - row) > 0.6) return null;
    if (col < 0 || col > 8 || row < 0 || row > 9) return null;
    return this.unmapPos(col, row);
  }

  boardToPixel(col: number, row: number): { x: number; y: number } {
    const mapped = this.mapPos(col, row);
    return {
      x: this.offsetX + mapped.col * this.cellSize,
      y: this.offsetY + mapped.row * this.cellSize,
    };
  }

  drawBoard(): void {
    const { ctx, cellSize: cs, offsetX: ox, offsetY: oy } = this;
    const w = cs * 8;
    const h = cs * 9;
    const totalW = this.canvas.width / this.dpr;
    const totalH = this.canvas.height / this.dpr;

    // 1. 木纹底色渐变
    const grad = ctx.createLinearGradient(0, 0, totalW, totalH);
    grad.addColorStop(0, '#D4A754');
    grad.addColorStop(0.3, '#C89B4A');
    grad.addColorStop(0.5, '#D4A754');
    grad.addColorStop(0.7, '#BF9040');
    grad.addColorStop(1, '#D4A754');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, totalW, totalH);

    // 2. 木纹线条
    ctx.strokeStyle = 'rgba(139, 90, 43, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const y = (i / 60) * totalH + Math.sin(i * 0.3) * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < totalW; x += 20) {
        ctx.lineTo(x, y + Math.sin(x * 0.01 + i * 0.5) * 2);
      }
      ctx.stroke();
    }

    // 3. 棋盘外框（双线装饰）
    const pad = cs * 0.5;
    ctx.strokeStyle = '#6B4226';
    ctx.lineWidth = Math.max(2, cs * 0.04);
    ctx.strokeRect(ox - pad, oy - pad, w + pad * 2, h + pad * 2);
    ctx.strokeStyle = '#8B5E3C';
    ctx.lineWidth = Math.max(1, cs * 0.02);
    ctx.strokeRect(ox - pad + 3, oy - pad + 3, w + pad * 2 - 6, h + pad * 2 - 6);

    // 4. 楚河漢界背景条
    ctx.fillStyle = 'rgba(139, 90, 43, 0.06)';
    ctx.fillRect(ox, oy + 4 * cs, w, cs);

    // 5. 网格线
    ctx.strokeStyle = '#5B3719';
    ctx.lineWidth = Math.max(1.25, cs * 0.025);

    for (let r = 0; r <= 9; r++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * cs);
      ctx.lineTo(ox + w, oy + r * cs);
      ctx.stroke();
    }

    for (let c = 0; c <= 8; c++) {
      if (c === 0 || c === 8) {
        ctx.beginPath();
        ctx.moveTo(ox + c * cs, oy);
        ctx.lineTo(ox + c * cs, oy + h);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(ox + c * cs, oy);
        ctx.lineTo(ox + c * cs, oy + 4 * cs);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox + c * cs, oy + 5 * cs);
        ctx.lineTo(ox + c * cs, oy + h);
        ctx.stroke();
      }
    }

    // 九宫格斜线
    ctx.beginPath();
    ctx.moveTo(ox + 3 * cs, oy);
    ctx.lineTo(ox + 5 * cs, oy + 2 * cs);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox + 5 * cs, oy);
    ctx.lineTo(ox + 3 * cs, oy + 2 * cs);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox + 3 * cs, oy + 7 * cs);
    ctx.lineTo(ox + 5 * cs, oy + 9 * cs);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox + 5 * cs, oy + 7 * cs);
    ctx.lineTo(ox + 3 * cs, oy + 9 * cs);
    ctx.stroke();

    this.drawCrossMark(1, 2); this.drawCrossMark(7, 2);
    this.drawCrossMark(1, 7); this.drawCrossMark(7, 7);
    for (const c of [0, 2, 4, 6, 8]) {
      this.drawCrossMark(c, 3);
      this.drawCrossMark(c, 6);
    }

    // 6. 楚河漢界书法体
    ctx.fillStyle = '#5B3719';
    ctx.font = `bold ${Math.floor(cs * 0.48)}px "KaiTi", "STKaiti", "DFKai-SB", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('楚 河', ox + 2 * cs, oy + 4.5 * cs);
    ctx.fillText('漢 界', ox + 6 * cs, oy + 4.5 * cs);
  }

  private drawCrossMark(col: number, row: number): void {
    const { ctx, cellSize: cs, offsetX: ox, offsetY: oy } = this;
    const mapped = this.mapPos(col, row);
    const x = ox + mapped.col * cs;
    const y = oy + mapped.row * cs;
    const len = cs * 0.15;
    const gap = cs * 0.08;
    ctx.lineWidth = Math.max(1, cs * 0.018);

    const drawL = (dx: number, dy: number) => {
      ctx.beginPath();
      ctx.moveTo(x + dx * gap, y + dy * (gap + len));
      ctx.lineTo(x + dx * gap, y + dy * gap);
      ctx.lineTo(x + dx * (gap + len), y + dy * gap);
      ctx.stroke();
    };

    if (col > 0) { drawL(-1, -1); drawL(-1, 1); }
    if (col < 8) { drawL(1, -1); drawL(1, 1); }
  }

  drawPieces(board: Board, selected: Position | null, legalMoves: Position[], lastMove: { from: Position; to: Position } | null): void {
    const { ctx, cellSize: cs } = this;
    const radius = cs * 0.42;
    const moveSet = new Set(legalMoves.map(m => `${m.col},${m.row}`));
    const lastSet = lastMove ? new Set([`${lastMove.from.col},${lastMove.from.row}`, `${lastMove.to.col},${lastMove.to.row}`]) : null;

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        const { x, y } = this.boardToPixel(c, r);
        const isSelected = selected?.col === c && selected?.row === r;
        const isLast = !!lastSet?.has(`${c},${r}`);

        if (isLast) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.95)';
          ctx.lineWidth = 3.2;
          ctx.stroke();
          ctx.restore();
        }

        // 1. 底部阴影
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x + 2, y + 3, radius, radius * 0.85, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.fill();
        ctx.restore();

        // 2. 棋子主体（径向渐变）
        const pieceGrad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
        if (piece.color === 'red') {
          if (isSelected) {
            pieceGrad.addColorStop(0, '#FFF8EC');
            pieceGrad.addColorStop(0.7, '#FFE8C8');
            pieceGrad.addColorStop(1, '#E8C890');
          } else {
            pieceGrad.addColorStop(0, '#FFF5E6');
            pieceGrad.addColorStop(0.7, '#F0DCC0');
            pieceGrad.addColorStop(1, '#D8C4A0');
          }
        } else {
          if (isSelected) {
            pieceGrad.addColorStop(0, '#F8F2E8');
            pieceGrad.addColorStop(0.7, '#E8DDD0');
            pieceGrad.addColorStop(1, '#D0C4B0');
          } else {
            pieceGrad.addColorStop(0, '#F2ECE0');
            pieceGrad.addColorStop(0.7, '#E0D8C8');
            pieceGrad.addColorStop(1, '#C8BCA8');
          }
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = pieceGrad;
        ctx.fill();

        // 3. 外圈
        ctx.strokeStyle = isSelected ? '#B8860B' : piece.color === 'red' ? '#8B4513' : '#3A3A3A';
        ctx.lineWidth = isSelected ? Math.max(2.5, radius * 0.1) : Math.max(1.5, radius * 0.07);
        ctx.stroke();

        // 4. 内圈
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.85, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? 'rgba(184, 134, 11, 0.4)' : piece.color === 'red' ? 'rgba(139, 69, 19, 0.35)' : 'rgba(58, 58, 58, 0.35)';
        ctx.lineWidth = Math.max(0.8, radius * 0.04);
        ctx.stroke();

        // 5. 棋子文字（带描边凸刻效果）
        const name = PIECE_NAMES[piece.type][piece.color === 'red' ? 0 : 1];
        ctx.font = 'bold ' + Math.floor(radius * 1.0) + 'px "KaiTi", "STKaiti", "DFKai-SB", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = piece.color === 'red' ? 'rgba(178, 34, 34, 0.2)' : 'rgba(26, 26, 26, 0.2)';
        ctx.lineWidth = 2;
        ctx.strokeText(name, x, y + 1);
        ctx.fillStyle = piece.color === 'red' ? '#A02020' : '#111111';
        ctx.fillText(name, x, y + 1);
      }
    }

    // 合法走位提示
    for (const pos of legalMoves) {
      const { x, y } = this.boardToPixel(pos.col, pos.row);
      const target = board[pos.row][pos.col];
      const key = pos.col + ',' + pos.row;
      if (target) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = moveSet.has(key) ? '#F59E0B' : '#E53935';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // 半透明底色大圆
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.fill();
        // 实心小圆
        ctx.beginPath();
        ctx.arc(x, y, cs * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
        ctx.fill();
      }
    }
  }

}
