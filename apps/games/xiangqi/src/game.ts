import type { Board, Position, Color, Move, Piece } from './types';
import { PIECE_NAMES } from './types.js';
import { createInitialBoard, getPiece } from './board-setup.js';
import { isLegalMove, makeMove, getLegalMoves, isInCheck, checkGameResult } from './logic.js';
import { BoardRenderer } from './board.js';
import { UIManager } from './ui.js';
import { ChessAI } from './ai-engine.js';
import { ReviewManager } from './review.js';
import { saveRecord } from './history.js';

export class Game {
  private board: Board;
  private myColor: Color = 'red';
  private currentTurn: Color = 'red';
  private status: 'lobby' | 'playing' | 'gameover' = 'lobby';
  private selected: Position | null = null;
  private legalMoves: Position[] = [];
  private renderer: BoardRenderer | null = null;
  private ui: UIManager;
  private difficulty: 'easy' | 'medium' | 'hard' | 'harder' = 'medium';
  private aiEngine: ChessAI | null = null;
  private pendingAIMoveTimer: ReturnType<typeof setTimeout> | null = null;
  private moveHistory: Move[] = [];
  private boardHistory: Board[] = [];
  private perspective: Color = 'red';
  private lastMove: Move | null = null;
  private didBindResize = false;
  private hintsUsed = 0;
  private gameStartTime = Date.now();
  private readonly MAX_HINTS = 3;
  private readonly onBackToMenu: () => void;


  constructor(uiContainer: HTMLElement, onBackToMenu: () => void) {
    this.ui = new UIManager(uiContainer);
    this.board = createInitialBoard();
    this.onBackToMenu = onBackToMenu;
    this.showLobby();
  }

  private showLobby(): void {
    this.status = 'lobby';
    if (this.pendingAIMoveTimer) {
      clearTimeout(this.pendingAIMoveTimer);
      this.pendingAIMoveTimer = null;
    }
    this.ui.showLobby((color, difficulty) => {
      this.startSinglePlayer(color, difficulty);
    }, () => {
      this.status = 'lobby';
      this.selected = null;
      this.legalMoves = [];
      this.moveHistory = [];
      this.boardHistory = [];
      this.lastMove = null;
      if (this.pendingAIMoveTimer) {
        clearTimeout(this.pendingAIMoveTimer);
        this.pendingAIMoveTimer = null;
      }
      this.onBackToMenu();
    });
  }

  private startSinglePlayer(color: Color, difficulty: 'easy' | 'medium' | 'hard' | 'harder'): void {
    this.myColor = color;
    this.perspective = color;
    this.difficulty = difficulty;
    this.aiEngine = new ChessAI(color === 'red' ? 'black' : 'red', difficulty);
    this.board = createInitialBoard();
    this.currentTurn = 'red';
    this.status = 'playing';
    this.selected = null;
    this.legalMoves = [];
    this.moveHistory = [];
    this.boardHistory = [];
    this.lastMove = null;
    this.hintsUsed = 0;
    this.startGameView();

    if (this.myColor === 'black') {
      this.scheduleAIMove();
    }
  }

  private startGameView(): void {
    this.gameStartTime = Date.now();
    this.ui.showGame(
      this.myColor,
      this.difficulty,
      () => this.handleUndo(),
      () => this.handleRestart(),
      () => this.handleResign(),
      () => this.showLobby(),
      () => this.handleHint(),
    );

    const canvas = this.ui.getCanvas();
    this.renderer = new BoardRenderer(canvas);
    this.renderer.setPerspective(this.perspective);
    this.render();
    this.updateTurnUI();
    this.bindCanvasEvents(canvas);
    this.installResizeHandler();
    requestAnimationFrame(() => { if (this.renderer) { this.renderer.resize(); this.render(); } });
  }

  private installResizeHandler(): void {
    if (this.didBindResize) return;
    this.didBindResize = true;
    window.addEventListener('resize', () => {
      if (this.renderer) {
        this.renderer.resize();
        this.render();
      }
    });
  }

  private bindCanvasEvents(canvas: HTMLCanvasElement): void {
    const boardLayer = document.getElementById('board-input-layer') as HTMLDivElement | null;
    const handleBoardInput = (clientX: number, clientY: number, boardRectOverride?: DOMRect): void => {
      if (this.status !== 'playing') return;
      if (this.currentTurn !== this.myColor) return;
      const boardRect = boardRectOverride ?? canvas.getBoundingClientRect();
      const point = {
        x: clientX - boardRect.left,
        y: clientY - boardRect.top,
      };
      const pos = this.renderer!.pixelToBoard(point.x, point.y);
      if (!pos) return;

      if (this.selected) {
        if (pos.col === this.selected.col && pos.row === this.selected.row) {
          this.selected = null;
          this.legalMoves = [];
          this.render();
          return;
        }

        const move: Move = { from: this.selected, to: pos };
        if (isLegalMove(this.board, move, this.myColor)) {
          this.applyMove(move, true);
          if (this.status === 'playing') this.scheduleAIMove();
          return;
        }

        const piece = getPiece(this.board, pos.col, pos.row);
        if (piece && piece.color === this.myColor) {
          this.selected = pos;
          this.legalMoves = getLegalMoves(this.board, pos.col, pos.row);
          this.render();
          return;
        }
      } else {
        const piece = getPiece(this.board, pos.col, pos.row);
        if (piece && piece.color === this.myColor) {
          this.selected = pos;
          this.legalMoves = getLegalMoves(this.board, pos.col, pos.row);
          this.render();
        }
      }
    };

    const mobileInput = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
    const target = boardLayer ?? canvas;

    canvas.style.touchAction = 'none';
    canvas.style.setProperty('-webkit-touch-callout', 'none');
    canvas.style.setProperty('-webkit-user-select', 'none');
    canvas.style.userSelect = 'none';
    canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');
    canvas.style.pointerEvents = 'auto';
    if (boardLayer) {
      boardLayer.style.touchAction = 'none';
      boardLayer.style.pointerEvents = 'auto';
      boardLayer.style.position = 'absolute';
      boardLayer.style.inset = '0';
      boardLayer.style.zIndex = '5';
      boardLayer.style.background = 'transparent';
    }

    const getBoardRect = () => canvas.getBoundingClientRect();
    const handleClientPoint = (clientX: number, clientY: number) => {
      const rect = getBoardRect();
      handleBoardInput(clientX, clientY, rect);
    };

    const onPointerDown = (evt: Event) => {
      const e = evt as PointerEvent;
      if (e.pointerType === 'mouse' && mobileInput) return;
      e.preventDefault();
      handleClientPoint(e.clientX, e.clientY);
    };

    if (window.PointerEvent) {
      target.addEventListener('pointerdown', onPointerDown, { capture: true });
    } else if (mobileInput) {
      let lastHandledKey = '';
      let lastHandledAt = 0;
      const handleTouch = (clientX: number, clientY: number) => {
        const key = Math.round(clientX) + ':' + Math.round(clientY);
        const now = Date.now();
        if (key === lastHandledKey && now - lastHandledAt < 300) return;
        lastHandledKey = key;
        lastHandledAt = now;
        handleClientPoint(clientX, clientY);
      };

      const onTouchEnd = (evt: Event) => {
        const e = evt as TouchEvent;
        e.preventDefault();
        const touch = e.changedTouches[0] ?? e.touches[0];
        if (!touch) return;
        handleTouch(touch.clientX, touch.clientY);
      };

      target.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
    } else {
      canvas.addEventListener('click', (e) => {
        handleClientPoint(e.clientX, e.clientY);
      });
    }
  }
  private scheduleAIMove(): void {
    if (!this.aiEngine || this.status !== 'playing') return;
    if (this.currentTurn === this.myColor) return;
    if (this.pendingAIMoveTimer) clearTimeout(this.pendingAIMoveTimer);
    this.ui.showNotification('AI 思考中...');
    this.pendingAIMoveTimer = setTimeout(() => {
      this.pendingAIMoveTimer = null;
      this.doAIMove();
    }, this.difficulty === 'easy' ? 220 : this.difficulty === 'medium' ? 360 : this.difficulty === 'hard' ? 520 : 700);
  }

  private doAIMove(): void {
    if (!this.aiEngine || this.status !== 'playing') return;
    if (this.currentTurn === this.myColor) return;
    const move = this.aiEngine.getBestMove(this.board);
    if (!move) {
      const result = checkGameResult(this.board, this.currentTurn);
      this.handleGameOver(result);
      return;
    }
    this.applyMove(move, false);
  }

  private applyMove(move: Move, recordHuman: boolean): void {
    // Bug #3: 保存棋盘快照用于高效悔棋
    this.boardHistory.push(this.board.map(row => [...row]));
    this.board = makeMove(this.board, move);
    this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
    this.selected = null;
    this.legalMoves = [];
    this.lastMove = move;
    if (recordHuman || this.moveHistory.length === 0 || this.moveHistory[this.moveHistory.length - 1] !== move) {
      this.moveHistory.push(move);
    }
    this.render();
    this.updateTurnUI();

    const result = checkGameResult(this.board, this.currentTurn);
    if (result.over) {
      this.handleGameOver(result);
      return;
    }

    if (this.currentTurn !== this.myColor) {
      this.scheduleAIMove();
    }
  }

  private handleUndo(): void {
    if (this.status !== 'playing') return;
    if (this.pendingAIMoveTimer) {
      clearTimeout(this.pendingAIMoveTimer);
      this.pendingAIMoveTimer = null;
    }

    const steps = this.moveHistory.length > 0 && this.currentTurn !== this.myColor ? 2 : 1;
    if (this.moveHistory.length < steps) {
      this.ui.showNotification('暂无可悔棋步数');
      return;
    }

    // Bug #3: 从快照恢复而非重新播放
    for (let i = 0; i < steps; i++) {
      if (this.boardHistory.length > 0) {
        this.board = this.boardHistory.pop()!;
        this.moveHistory.pop();
        this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
      }
    }
    this.selected = null;
    this.legalMoves = [];
    this.lastMove = this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null;
    this.render();
    this.updateTurnUI();
    if (this.currentTurn !== this.myColor) this.scheduleAIMove();
  }

  private handleRestart(): void {
    if (this.pendingAIMoveTimer) {
      clearTimeout(this.pendingAIMoveTimer);
      this.pendingAIMoveTimer = null;
    }
    this.startSinglePlayer(this.myColor, this.difficulty);
  }

  private handleResign(): void {
    this.status = 'gameover';
    const duration = Math.round((Date.now() - this.gameStartTime) / 1000);
    saveRecord({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      timestamp: Date.now(),
      mode: 'single',
      myColor: this.myColor,
      opponent: `AI-${this.difficulty}`,
      result: 'lose',
      moveCount: this.moveHistory.length,
      duration,
      moves: [...this.moveHistory],
    });
    this.ui.showGameOver(
      this.myColor === 'red' ? '黑方胜' : '红方胜',
      '认输',
      () => this.onBackToMenu(),
      () => this.handleReview(),
    );
  }

  private handleGameOver(result: { over: boolean; winner: Color | null; reason: string }): void {
    this.status = 'gameover';
    const duration = Math.round((Date.now() - this.gameStartTime) / 1000);
    const myResult: 'win' | 'lose' | 'draw' = result.winner === null ? 'draw' : result.winner === this.myColor ? 'win' : 'lose';
    saveRecord({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      timestamp: Date.now(),
      mode: 'single',
      myColor: this.myColor,
      opponent: `AI-${this.difficulty}`,
      result: myResult,
      moveCount: this.moveHistory.length,
      duration,
      moves: [...this.moveHistory],
    });
    this.ui.showGameOver(
      result.winner === null ? '和棋' : (result.winner === 'red' ? '红方胜' : '黑方胜'),
      result.reason,
      () => this.onBackToMenu(),
      () => this.handleReview(),
    );
  }

  private handleReview(): void {
    if (this.moveHistory.length === 0) return;
    const review = new ReviewManager(this.moveHistory);
    review.renderUI(this.ui.getContainer(), () => {
      if (this.renderer) this.renderer.resize();
      this.onBackToMenu();
    });
  }

  private handleHint(): void {
    if (this.status !== 'playing') return;
    if (this.currentTurn !== this.myColor) {
      this.ui.showNotification('请等待你的回合');
      return;
    }
    if (this.hintsUsed >= this.MAX_HINTS) {
      this.ui.showNotification('本局提示次数已用完');
      return;
    }
    this.hintsUsed++;
    this.ui.showNotification('AI 正在分析...');

    setTimeout(() => {
      const hintEngine = new ChessAI(this.myColor, 'harder');
      const move = hintEngine.getBestMove(this.board);
      if (!move) { this.ui.showNotification('无法计算提示'); return; }

      this.selected = move.from;
      this.legalMoves = [move.to];
      this.render();

      const piece = getPiece(this.board, move.from.col, move.from.row);
      if (piece) {
        const notation = this.toChineseNotation(move, piece);
        this.ui.showNotification(`💡 推荐：${notation}（剩余 ${this.MAX_HINTS - this.hintsUsed} 次）`);
      }
    }, 100);
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

  private render(): void {
    if (!this.renderer) return;
    this.renderer.drawBoard();
    this.renderer.drawPieces(this.board, this.selected, this.legalMoves, this.lastMove);
  }

  private updateTurnUI(): void {
    const isMyTurn = this.currentTurn === this.myColor;
    this.ui.updateTurn(this.currentTurn, isMyTurn);
    this.ui.updateColorBadge(this.myColor, this.perspective);
    if (isInCheck(this.board, this.currentTurn)) {
      this.ui.showNotification(`${this.currentTurn === 'red' ? '红方' : '黑方'}被将军！`);
    }
  }
}
