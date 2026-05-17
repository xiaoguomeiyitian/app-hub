import { OnlineClient } from './OnlineClient.js';
import { RoomStore } from './RoomStore.js';
import type { Renderer } from '../ui/Renderer.js';
import type { UIController } from '../ui/UIController.js';
import { Board } from '../game/Board.js';
import { Player } from '../types/index.js';

/**
 * 联机对局流程控制器
 * 替代单机 Game 在联机模式下的角色
 */
export class OnlineGameController {
  private client: OnlineClient;
  private store: RoomStore;
  private renderer: Renderer;
  private ui: UIController;
  private board: Board;
  private lastMove: { row: number; col: number } | null = null;
  private _active = false;

  constructor(
    client: OnlineClient,
    store: RoomStore,
    renderer: Renderer,
    ui: UIController,
    board: Board,
  ) {
    this.client = client;
    this.store = store;
    this.renderer = renderer;
    this.ui = ui;
    this.board = board;

    this.bindEvents();
  }

  get active(): boolean { return this._active; }

  activate(): void {
    this._active = true;
    this.board.reset();
    this.lastMove = null;
    this.store.reset();
    this.renderBoard();
  }

  deactivate(): void {
    this._active = false;
  }

  /** 棋盘点击 → 发送落子请求 */
  handleClick(row: number, col: number): void {
    if (!this._active) return;
    if (!this.store.isMyTurn()) return;
    if (this.store.status !== 'playing') return;

    // 不在本地落子，等服务端确认
    this.client.send('game:place', { row, col });
  }

  /** 是否允许输入 */
  isInputEnabled(): boolean {
    return this._active && this.store.isMyTurn() && this.store.status === 'playing';
  }

  /** 获取最后落子 */
  getLastMove(): { row: number; col: number } | null {
    return this.lastMove;
  }

  private bindEvents(): void {
    this.client.on('game:started', (data) => {
      if (!this._active) return;
      const d = data as { turn: 'black'; board: number[][] };
      this.store.setGameStarted(d.turn, d.board);
      this.board.reset();
      // 同步棋盘
      this.syncBoard(d.board);
      this.lastMove = null;
      this.updateStatus();
      this.renderBoard();
    });

    this.client.on('game:moved', (data) => {
      if (!this._active) return;
      const d = data as { row: number; col: number; color: 'black' | 'white' };
      const colorNum = d.color === 'black' ? Player.Black : Player.White;
      this.board.placePiece(d.row, d.col, colorNum);
      this.lastMove = { row: d.row, col: d.col };
      this.renderBoard();
    });

    this.client.on('game:turn', (data) => {
      if (!this._active) return;
      const d = data as { turn: 'black' | 'white' };
      this.store.setTurn(d.turn);
      this.updateStatus();
    });

    this.client.on('game:over', (data) => {
      if (!this._active) return;
      const d = data as { winner: 'black' | 'white' | 'draw'; reason: string };
      this.store.setWinner(d.winner);
      this.updateStatus();
    });

    this.client.on('room:opponent_left', () => {
      if (!this._active) return;
      this.ui.setStatusText('⚠️ 对手已离开');
    });

    this.client.on('error', (data) => {
      if (!this._active) return;
      const d = data as { code: string; message?: string };
      // 忽略 NOT_YOUR_TURN（因为前端应该已经做了限制）
      if (d.code !== 'NOT_YOUR_TURN') {
        this.ui.setStatusText(`❌ ${d.message || d.code}`);
      }
    });
  }

  private syncBoard(board: number[][]): void {
    this.board.reset();
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (board[r][c] !== 0) {
          this.board.placePiece(r, c, board[r][c] === 1 ? Player.Black : Player.White);
        }
      }
    }
  }

  private updateStatus(): void {
    if (this.store.winner) {
      const w = this.store.winner;
      if (w === 'draw') {
        this.ui.setStatusText('🤝 平局！');
      } else if (w === this.store.myColor) {
        this.ui.setStatusText('🎉 你赢了！');
      } else {
        this.ui.setStatusText('😢 你输了');
      }
      return;
    }

    if (this.store.isMyTurn()) {
      this.ui.setStatusText('⚫ 轮到你落子');
    } else {
      this.ui.setStatusText('⏳ 等待对手落子...');
    }
  }

  private renderBoard(): void {
    this.renderer.render(this.board, this.lastMove);
  }
}
