import { Player, GameState, GameMode } from '../types/index.js';
import type { Position, WinInfo } from '../types/index.js';
import { Board } from './Board.js';
import { AIEngine } from '../ai/AIEngine.js';
import type { Renderer } from '../ui/Renderer.js';
import type { UIController } from '../ui/UIController.js';
import type { AudioManager } from '../audio/AudioManager.js';

/**
 * 游戏流程控制器
 * 管理回合切换、人机模式流程、悔棋、状态机
 */
export class Game {
  private board: Board;
  private ai: AIEngine;
  private renderer: Renderer;
  private ui: UIController;
  private audio: AudioManager;

  private state: GameState = GameState.Idle;
  private mode: GameMode = GameMode.PvAI;
  private currentPlayer: Player = Player.Black;
  private humanPlayer: Player = Player.Black;
  private lastMove: Position | null = null;
  private winInfo: WinInfo | null = null;
  private aiThinking = false;
  private inputEnabled = false;

  constructor(
    board: Board,
    ai: AIEngine,
    renderer: Renderer,
    ui: UIController,
    audio: AudioManager
  ) {
    this.board = board;
    this.ai = ai;
    this.renderer = renderer;
    this.ui = ui;
    this.audio = audio;
  }

  /** 设置 AI 搜索深度 */
  setAIDepth(depth: number): void {
    this.ai.setDepth(depth);
  }

  /** 开始游戏 */
  startGame(mode: GameMode): void {
    this.mode = mode;
    this.board.reset();
    this.currentPlayer = Player.Black;
    this.humanPlayer = Player.Black;
    this.lastMove = null;
    this.winInfo = null;
    this.aiThinking = false;
    this.state = GameState.Playing;

    this.inputEnabled = true;
    this.ui.setStatus(GameState.Playing);
    this.render();

    // 初始化音效（用户交互后）
    this.audio.init();
  }

  /** 重新开始 */
  restart(): void {
    this.startGame(this.mode);
  }

  /** 玩家落子回调 */
  onPlayerMove(pos: Position): void {
    if (this.state !== GameState.Playing) return;
    if (this.aiThinking) return;
    if (!this.inputEnabled) return;

    // PvP 模式或当前轮到玩家
    if (this.mode === GameMode.PvAI && this.currentPlayer !== this.humanPlayer) return;

    this.placePiece(pos.row, pos.col);
  }

  /** 执行落子 */
  private placePiece(row: number, col: number): void {
    if (!this.board.placePiece(row, col, this.currentPlayer)) return;

    this.lastMove = { row, col };
    this.audio.play('place');
    this.render();

    // 检查胜负
    const win = this.board.checkWin(row, col, this.currentPlayer);
    if (win) {
      this.winInfo = win;
      this.state = this.currentPlayer === this.humanPlayer ? GameState.Win : GameState.Lose;
      this.ui.setStatus(this.state);
      this.inputEnabled = false;
      this.render();
      this.audio.play(this.state === GameState.Win ? 'win' : 'lose');
      this.ui.recordResult(this.state === GameState.Win ? 'win' : 'lose');
      return;
    }

    // 检查平局
    if (this.board.isDraw()) {
      this.state = GameState.Draw;
      this.ui.setStatus(GameState.Draw);
      this.inputEnabled = false;
      this.render();
      this.ui.recordResult('draw');
      return;
    }

    // 切换回合
    this.currentPlayer = this.currentPlayer === Player.Black ? Player.White : Player.Black;

    if (this.mode === GameMode.PvAI && this.currentPlayer !== this.humanPlayer) {
      this.doAIMove();
    }
  }

  /** AI 落子 */
  private async doAIMove(): Promise<void> {
    this.aiThinking = true;
    this.ui.setStatus(GameState.Playing, true);
    this.inputEnabled = false;

    const aiPlayer = this.currentPlayer;
    const move = await this.ai.getBestMove(this.board, aiPlayer);

    this.aiThinking = false;
    this.inputEnabled = true;

    // 落子
    if (this.board.placePiece(move.row, move.col, aiPlayer)) {
      this.lastMove = move;
      this.audio.play('place');
      this.render();

      // 检查胜负
      const win = this.board.checkWin(move.row, move.col, aiPlayer);
      if (win) {
        this.winInfo = win;
        this.state = GameState.Lose;
        this.ui.setStatus(GameState.Lose);
        this.inputEnabled = false;
        this.render();
        this.audio.play('lose');
        this.ui.recordResult('lose');
        return;
      }

      // 检查平局
      if (this.board.isDraw()) {
        this.state = GameState.Draw;
        this.ui.setStatus(GameState.Draw);
        this.inputEnabled = false;
        this.render();
        this.ui.recordResult('draw');
        return;
      }

      // 切换回玩家
      this.currentPlayer = this.currentPlayer === Player.Black ? Player.White : Player.Black;
      this.ui.setStatus(GameState.Playing);
    }
  }

  /** 悔棋 */
  undo(): void {
    if (this.state !== GameState.Playing) return;
    if (this.aiThinking) return;

    if (this.mode === GameMode.PvAI) {
      // 撤销 AI 和玩家各一步
      const aiMove = this.board.undo();
      const playerMove = this.board.undo();
      if (!aiMove || !playerMove) return;
    } else {
      // PvP 只撤销一步
      if (!this.board.undo()) return;
      this.currentPlayer = this.currentPlayer === Player.Black ? Player.White : Player.Black;
    }

    // 更新最后落子标记
    const occupied = this.board.getOccupiedCells();
    if (occupied.length > 0) {
      this.lastMove = occupied[occupied.length - 1];
    } else {
      this.lastMove = null;
    }

    this.render();
  }

  /** 渲染 */
  private render(): void {
    this.renderer.render(this.board, this.lastMove, this.winInfo);
  }

  /** 获取游戏状态 */
  getState(): GameState {
    return this.state;
  }

  /** 是否允许输入 */
  isInputEnabled(): boolean {
    return this.inputEnabled;
  }

  /** 获取最后落子位置 */
  getLastMove(): Position | null {
    return this.lastMove;
  }
}
