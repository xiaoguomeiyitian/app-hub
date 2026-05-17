import type { Board, Move, Piece, Color } from './types';
import { PIECE_NAMES } from './types.js';
import { createInitialBoard, getPiece } from './board-setup.js';
import { makeMove } from './logic.js';
import { ChessAI } from './ai-engine.js';
import { BoardRenderer } from './board.js';

export interface AnalyzedMove {
  move: Move;
  notation: string;
  evalBefore: number;
  evalAfter: number;
  evalDelta: number;
  tag: 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  comment: string;
}

export class ReviewManager {
  private moves: Move[] = [];
  private analysis: AnalyzedMove[] = [];
  private boards: Board[] = [];
  private currentStep = -1;
  private cancelAnalysis = false;
  private renderer: BoardRenderer | null = null;

  constructor(moves: Move[]) {
    this.moves = moves;
    this.rebuildBoards();
  }

  private rebuildBoards(): void {
    this.boards = [createInitialBoard()];
    let board = createInitialBoard();
    for (const move of this.moves) {
      board = makeMove(board, move);
      this.boards.push(JSON.parse(JSON.stringify(board)));
    }
  }

  // Bug #8: 取消分析
  cancel(): void {
    this.cancelAnalysis = true;
  }

  async analyze(progressCb: (pct: number) => void): Promise<AnalyzedMove[]> {
    this.analysis = [];
    this.cancelAnalysis = false;
    const ai = new ChessAI('red', 'medium');

    for (let i = 0; i < this.moves.length; i++) {
      // Bug #8: 检查取消标志
      if (this.cancelAnalysis) {
        progressCb(100);
        return this.analysis;
      }
      const boardBefore = this.boards[i];
      const boardAfter = this.boards[i + 1];
      const turn: Color = i % 2 === 0 ? 'red' : 'black';

      const evalBefore = ai.evaluatePosition(boardBefore, turn);
      const evalAfter = ai.evaluatePosition(boardAfter, turn === 'red' ? 'black' : 'red');
      const evalDelta = turn === 'red' ? evalAfter - evalBefore : evalBefore - evalAfter;

      let tag: AnalyzedMove['tag'];
      let comment: string;
      if (evalDelta > 200) { tag = 'brilliant'; comment = '妙手！'; }
      else if (evalDelta > 50) { tag = 'good'; comment = '好棋'; }
      else if (evalDelta > -50) { tag = 'good'; comment = ''; }
      else if (evalDelta > -200) { tag = 'inaccuracy'; comment = '略有瑕疵'; }
      else { tag = 'mistake'; comment = '失误！局面恶化'; }

      const piece = getPiece(boardBefore, this.moves[i].from.col, this.moves[i].from.row);
      const notation = piece ? this.toChineseNotation(this.moves[i], piece) : '';

      this.analysis.push({ move: this.moves[i], notation, evalBefore, evalAfter, evalDelta, tag, comment });

      progressCb(Math.round((i + 1) / this.moves.length * 100));
      if (i % 3 === 2) await new Promise(r => setTimeout(r, 0));
    }

    return this.analysis;
  }

  goToStep(step: number): void {
    this.currentStep = Math.max(-1, Math.min(step, this.moves.length - 1));
    this.renderCurrent();
    this.highlightMoveRow();
  }

  next(): void { this.goToStep(this.currentStep + 1); }
  prev(): void { this.goToStep(this.currentStep - 1); }
  first(): void { this.goToStep(-1); }
  last(): void { this.goToStep(this.moves.length - 1); }

  private renderCurrent(): void {
    if (!this.renderer) return;
    const board = this.boards[this.currentStep + 1];
    this.renderer.drawBoard();
    const lastMove = this.currentStep >= 0 ? this.moves[this.currentStep] : null;
    this.renderer.drawPieces(board, null, [], lastMove);
  }

  private highlightMoveRow(): void {
    document.querySelectorAll('.move-row-review').forEach(row => {
      const step = parseInt(row.getAttribute('data-step') || '-1');
      row.classList.toggle('active', step === this.currentStep);
    });
    // 滚动到当前步
    const active = document.querySelector('.move-row-review.active');
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    this.updateEvalDetail();
  }

  private updateEvalDetail(): void {
    const card = document.getElementById('eval-detail-card');
    const detail = document.getElementById('eval-detail');
    if (!card || !detail) return;
    if (this.currentStep < 0 || this.currentStep >= this.analysis.length) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';
    const a = this.analysis[this.currentStep];
    const tagLabel = { brilliant: '🌟 妙手', good: '👍 好棋', inaccuracy: '⚠️ 略有瑕疵', mistake: '❌ 失误', blunder: '💀 重大失误' }[a.tag];
    const tagColor = { brilliant: '#22c55e', good: '#86efac', inaccuracy: '#facc15', mistake: '#ef4444', blunder: '#dc2626' }[a.tag];
    detail.innerHTML = `
      <div style="color:${tagColor};font-weight:700;margin-bottom:6px">${tagLabel}</div>
      <div>走法: ${a.notation}</div>
      <div>局面变化: ${a.evalDelta > 0 ? '+' : ''}${a.evalDelta}</div>
      ${a.comment ? `<div style="color:${tagColor}">${a.comment}</div>` : ''}
    `;
  }

  renderUI(container: HTMLElement, onBack: () => void): void {
    const stepLabels: string[] = [];
    for (let i = 0; i < this.moves.length; i++) {
      const stepNum = Math.floor(i / 2) + 1;
      const isRed = i % 2 === 0;
      stepLabels.push(isRed ? `${stepNum}. ` : `${stepNum}... `);
    }

    container.innerHTML = `
      <div class="game">
        <div class="game-header">
          <button id="btn-review-back" class="btn btn-secondary btn-mini">返回</button>
          <div class="turn-pill">📊 复盘分析</div>
          <div class="review-progress" id="review-progress">分析中... 0%</div>
        </div>
        <div class="game-layout">
          <div class="board-column">
            <div class="board-shell" id="canvas-wrapper">
              <canvas id="game-canvas"></canvas>
            </div>
          </div>
          <aside class="game-sidebar">
            <div class="sidebar-card">
              <div class="sidebar-title">棋谱分析（${this.moves.length} 步）</div>
              <div class="move-history-list" id="move-history-list">
                <div class="review-placeholder">分析完成后显示棋谱...</div>
              </div>
            </div>
            <div class="sidebar-card">
              <div class="sidebar-title">导航</div>
              <div class="control-actions control-actions-3col">
                <button id="btn-first" class="btn btn-secondary btn-mini">⏮ 首步</button>
                <button id="btn-prev" class="btn btn-secondary btn-mini">◀ 上步</button>
                <button id="btn-next" class="btn btn-secondary btn-mini">下步 ▶</button>
                <button id="btn-last" class="btn btn-secondary btn-mini">末步 ⏭</button>
              </div>
            </div>
            <div class="sidebar-card" id="eval-detail-card" style="display:none">
              <div class="sidebar-title">评估详情</div>
              <div id="eval-detail" class="eval-detail-content"></div>
            </div>
          </aside>
        </div>
      </div>
    `;

    this.renderer = new BoardRenderer(document.getElementById('game-canvas') as HTMLCanvasElement);
    this.renderer.resize();
    this.renderCurrent();

    document.getElementById('btn-first')?.addEventListener('click', () => this.first());
    document.getElementById('btn-prev')?.addEventListener('click', () => this.prev());
    document.getElementById('btn-next')?.addEventListener('click', () => this.next());
    document.getElementById('btn-last')?.addEventListener('click', () => this.last());
    document.getElementById('btn-review-back')?.addEventListener('click', onBack);

    this.analyze((pct) => {
      const el = document.getElementById('review-progress');
      if (el) el.textContent = pct < 100 ? `分析中... ${pct}%` : '✅ 分析完成';
    }).then(() => {
      this.updateMoveList();
    });

    window.addEventListener('resize', () => {
      if (this.renderer) { this.renderer.resize(); this.renderCurrent(); }
    });
  }

  private updateMoveList(): void {
    const list = document.getElementById('move-history-list');
    if (!list) return;
    list.innerHTML = this.analysis.map((a, i) => {
      const tagColor = { brilliant: '#22c55e', good: '#86efac', inaccuracy: '#facc15', mistake: '#ef4444', blunder: '#dc2626' }[a.tag];
      const stepNum = Math.floor(i / 2) + 1;
      const isRed = i % 2 === 0;
      const prefix = isRed ? `${stepNum}. ` : `${stepNum}... `;
      return `<div class="move-row-review ${i === this.currentStep ? 'active' : ''}" data-step="${i}">
        <span class="move-notation" style="color:${tagColor}">${prefix}${a.notation}</span>
        ${a.comment ? `<span class="move-comment">${a.comment}</span>` : ''}
      </div>`;
    }).join('');

    list.querySelectorAll('.move-row-review').forEach(row => {
      row.addEventListener('click', () => {
        const step = parseInt(row.getAttribute('data-step') || '0');
        this.goToStep(step);
      });
    });
  }

  private toChineseNotation(move: Move, piece: Piece): string {
    const name = PIECE_NAMES[piece.type][piece.color === 'red' ? 0 : 1];
    const colNames = piece.color === 'red'
      ? ['九', '八', '七', '六', '五', '四', '三', '二', '一']
      : ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const startCol = colNames[move.from.col];
    const targetCol = colNames[move.to.col];
    const direction = move.to.row < move.from.row ? '进' : move.to.row > move.from.row ? '退' : '平';

    if (['horse', 'elephant', 'advisor'].includes(piece.type)) {
      return `${name}${startCol}${direction}${targetCol}`;
    }
    if (move.from.col === move.to.col) {
      const steps = Math.abs(move.to.row - move.from.row);
      const stepNames = piece.color === 'red'
        ? ['一', '二', '三', '四', '五', '六', '七', '八', '九']
        : ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      return `${name}${startCol}${direction}${stepNames[steps - 1]}`;
    }
    return `${name}${startCol}${direction}${targetCol}`;
  }
}
