import type { Board, Position, Color, Move } from './types';
import type { Puzzle } from './puzzles';
import { createBoardFromPieces, getPiece } from './board-setup.js';
import { isLegalMove, makeMove, getLegalMoves, checkGameResult, hasNoLegalMoves } from './logic.js';
import { BoardRenderer } from './board.js';
import { ChessAI } from './ai-engine.js';
import { savePuzzleProgress } from './puzzles.js';

export class PuzzleGame {
  private puzzle: Puzzle;
  private board: Board;
  private renderer: BoardRenderer | null = null;
  private currentTurn: Color = 'red';
  private moveCount = 0;
  private selected: Position | null = null;
  private legalMoves: Position[] = [];
  private usedHint = false;
  private status: 'playing' | 'win' | 'fail' = 'playing';
  private lastMove: { from: Position; to: Position } | null = null;
  private aiEngine: ChessAI;
  private readonly onComplete: (stars: 1 | 2 | 3) => void;
  private readonly onBack: () => void;

  constructor(puzzle: Puzzle, container: HTMLElement, onComplete: (stars: 1 | 2 | 3) => void, onBack: () => void) {
    this.puzzle = puzzle;
    this.board = createBoardFromPieces(puzzle.pieces);

    // 验证对手初始有合法走法
    const opponentColor = puzzle.turn === 'red' ? 'black' : 'red';
    if (hasNoLegalMoves(this.board, opponentColor)) {
      console.error(`[PuzzleGame] 残局 ${puzzle.id} ${puzzle.name}: 对手初始无合法走法！`);
      container.innerHTML = `
        <div class="lobby single-lobby">
          <h1>⚠️ 残局数据异常</h1>
          <p class="lobby-note">此残局初始状态有误，请返回选择其他残局</p>
          <button class="btn btn-secondary" id="btn-back-err">返回列表</button>
        </div>
      `;
      document.getElementById('btn-back-err')?.addEventListener('click', () => onBack());
      this.onComplete = onComplete;
      this.onBack = onBack;
      this.aiEngine = new ChessAI('black', 'easy');
      return;
    }

    this.currentTurn = puzzle.turn;
    this.onComplete = onComplete;
    this.onBack = onBack;
    this.aiEngine = new ChessAI(puzzle.turn === 'red' ? 'black' : 'red', 'easy');
    this.renderUI(container);
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new BoardRenderer(canvas);
    this.render();
    this.bindEvents(canvas);
    requestAnimationFrame(() => { if (this.renderer) { this.renderer.resize(); this.render(); } });
  }

  private renderUI(container: HTMLElement): void {
    const turnText = this.currentTurn === 'red' ? '红方走棋' : '黑方走棋';
    container.innerHTML = `
      <div class="game">
        <div class="game-header">
          <div class="puzzle-badge">🧩 ${this.puzzle.name}</div>
          <div class="turn-pill ${this.currentTurn}" id="turn-indicator">${turnText}</div>
          <div class="puzzle-progress" id="puzzle-progress">步数: ${this.moveCount} / ${this.puzzle.maxMoves}</div>
        </div>
        <div class="game-layout">
          <div class="board-column">
            <div class="board-shell" id="canvas-wrapper">
              <canvas id="game-canvas"></canvas>
              <div id="board-input-layer" class="board-input-layer" aria-hidden="true"></div>
            </div>
          </div>
          <aside class="game-sidebar">
            <div class="sidebar-card">
              <div class="sidebar-title">残局信息</div>
              <div class="puzzle-info">
                <div>难度: ${'⭐'.repeat(this.puzzle.difficulty)}</div>
                <div>目标: 红胜（${this.puzzle.maxMoves} 步内）</div>
                <div>标签: ${this.puzzle.tags.join(' · ')}</div>
              </div>
            </div>
            <div class="sidebar-card game-actions-card">
              <div class="sidebar-title">操作</div>
              <div class="control-actions">
                <button id="btn-hint" class="btn btn-secondary btn-mini">💡 提示</button>
                <button id="btn-retry" class="btn btn-secondary btn-mini">🔄 重试</button>
                <button id="btn-back-puzzle-list" class="btn btn-secondary btn-mini">返回列表</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  private bindEvents(canvas: HTMLCanvasElement): void {
    const boardLayer = document.getElementById('board-input-layer') as HTMLDivElement | null;
    const target = boardLayer ?? canvas;

    document.getElementById('btn-hint')?.addEventListener('click', () => this.showHint());
    document.getElementById('btn-retry')?.addEventListener('click', () => this.retry());
    document.getElementById('btn-back-puzzle-list')?.addEventListener('click', () => this.onBack());

    canvas.style.touchAction = 'none';
    canvas.style.pointerEvents = 'auto';
    if (boardLayer) {
      boardLayer.style.touchAction = 'none';
      boardLayer.style.pointerEvents = 'auto';
      boardLayer.style.position = 'absolute';
      boardLayer.style.inset = '0';
      boardLayer.style.zIndex = '5';
      boardLayer.style.background = 'transparent';
    }

    const handleInput = (clientX: number, clientY: number) => {
      if (this.status !== 'playing') return;
      if (this.currentTurn !== this.puzzle.turn) return;
      const rect = canvas.getBoundingClientRect();
      const pos = this.renderer!.pixelToBoard(clientX - rect.left, clientY - rect.top);
      if (!pos) return;
      this.handleClick(pos);
    };

    if (window.PointerEvent) {
      target.addEventListener('pointerdown', (e: Event) => {
        const evt = e as PointerEvent;
        evt.preventDefault();
        handleInput(evt.clientX, evt.clientY);
      }, { capture: true });
    } else {
      target.addEventListener('touchend', (e: Event) => {
        const evt = e as TouchEvent;
        evt.preventDefault();
        const touch = evt.changedTouches[0];
        if (touch) handleInput(touch.clientX, touch.clientY);
      }, { capture: true, passive: false });
    }

    window.addEventListener('resize', () => {
      if (this.renderer) { this.renderer.resize(); this.render(); }
    });
  }

  private handleClick(pos: Position): void {
    if (this.selected) {
      if (pos.col === this.selected.col && pos.row === this.selected.row) {
        this.selected = null;
        this.legalMoves = [];
        this.render();
        return;
      }

      const move: Move = { from: this.selected, to: pos };
      if (isLegalMove(this.board, move, this.puzzle.turn)) {
        this.applyPlayerMove(move);
        return;
      }

      const piece = getPiece(this.board, pos.col, pos.row);
      if (piece && piece.color === this.puzzle.turn) {
        this.selected = pos;
        this.legalMoves = getLegalMoves(this.board, pos.col, pos.row);
        this.render();
        return;
      }
    } else {
      const piece = getPiece(this.board, pos.col, pos.row);
      if (piece && piece.color === this.puzzle.turn) {
        this.selected = pos;
        this.legalMoves = getLegalMoves(this.board, pos.col, pos.row);
        this.render();
      }
    }
  }

  private applyPlayerMove(move: Move): void {
    this.board = makeMove(this.board, move);
    this.moveCount++;
    this.selected = null;
    this.legalMoves = [];
    this.lastMove = move;

    const result = checkGameResult(this.board, this.puzzle.turn === 'red' ? 'black' : 'red');
    if (result.over && result.winner === this.puzzle.turn) {
      this.status = 'win';
      const stars: 1 | 2 | 3 = this.usedHint ? 1 : this.moveCount <= this.puzzle.maxMoves ? 3 : 2;
      this.render();
      this.showWin(stars);
      return;
    }

    this.currentTurn = this.puzzle.turn === 'red' ? 'black' : 'red';
    this.updateTurnUI();
    this.render();

    // AI 应招
    setTimeout(() => this.doAIMove(), 300);
  }

  private doAIMove(): void {
    if (this.status !== 'playing') return;
    const move = this.aiEngine.getBestMove(this.board);
    if (!move) return;

    this.board = makeMove(this.board, move);
    this.currentTurn = this.puzzle.turn;
    this.lastMove = move;

    const result = checkGameResult(this.board, this.currentTurn);
    if (result.over) {
      if (result.winner === null) {
        // 和棋（困毙等）在残局中不算失败
        this.status = 'playing';
        this.updateTurnUI();
        this.render();
        return;
      }
      this.status = 'fail';
      this.render();
      this.showFail();
      return;
    }

    this.updateTurnUI();
    this.render();
  }

  private showHint(): void {
    this.usedHint = true;
    // Bug #4: 显示解法路径中的当前步骤（而非固定第一步）
    const stepIndex = Math.min(this.moveCount, this.puzzle.solution.length - 1);
    const solution = this.puzzle.solution[stepIndex];
    if (!solution) return;

    this.selected = solution.from;
    this.legalMoves = [solution.to];
    this.render();
  }

  private retry(): void {
    this.board = createBoardFromPieces(this.puzzle.pieces);
    this.currentTurn = this.puzzle.turn;
    this.moveCount = 0;
    this.selected = null;
    this.legalMoves = [];
    this.lastMove = null;
    this.usedHint = false;
    this.status = 'playing';
    this.updateTurnUI();
    this.render();
  }

  private updateTurnUI(): void {
    const el = document.getElementById('turn-indicator');
    if (el) {
      const text = this.currentTurn === 'red' ? '红方走棋' : '黑方走棋';
      el.textContent = text;
      el.className = `turn-pill ${this.currentTurn}`;
    }
    const prog = document.getElementById('puzzle-progress');
    if (prog) {
      prog.textContent = `步数: ${this.moveCount} / ${this.puzzle.maxMoves}`;
    }
  }

  private showWin(stars: 1 | 2 | 3): void {
    savePuzzleProgress(this.puzzle.id, stars);
    const starText = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>🎉 恭喜通关！</h2>
        <div class="win-stars">${starText}</div>
        <p class="win-detail">${stars === 3 ? '完美通关！' : stars === 2 ? '通关成功' : '使用了提示'}</p>
        <p class="win-moves">用了 ${this.moveCount} 步（标准 ${this.puzzle.maxMoves} 步）</p>
        <div class="modal-actions">
          <button class="btn btn-primary-action" id="btn-next-puzzle">下一关</button>
          <button class="btn btn-secondary" id="btn-back-list-win">返回列表</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('btn-back-list-win')?.addEventListener('click', () => {
      overlay.remove();
      this.onBack();
    });
    document.getElementById('btn-next-puzzle')?.addEventListener('click', () => {
      overlay.remove();
      this.onComplete(stars);
    });
  }

  private showFail(): void {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>😢 挑战失败</h2>
        <p>超出步数限制或被将死</p>
        <div class="modal-actions">
          <button class="btn btn-primary-action" id="btn-retry-modal">🔄 重试</button>
          <button class="btn btn-secondary" id="btn-back-list-fail">返回列表</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('btn-retry-modal')?.addEventListener('click', () => {
      overlay.remove();
      this.retry();
    });
    document.getElementById('btn-back-list-fail')?.addEventListener('click', () => {
      overlay.remove();
      this.onBack();
    });
  }

  private render(): void {
    if (!this.renderer) return;
    this.renderer.drawBoard();
    this.renderer.drawPieces(this.board, this.selected, this.legalMoves, this.lastMove);
  }
}
