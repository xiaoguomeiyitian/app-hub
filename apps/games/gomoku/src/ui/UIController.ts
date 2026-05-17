import { GameState, GameMode } from '../types/index.js';
import type { Game } from '../game/Game.js';

/**
 * UI 控件控制器
 * 管理入口大厅、游戏界面、联机大厅
 */
export class UIController {
  private container: HTMLElement;
  private statusText!: HTMLElement;
  private startBtn!: HTMLButtonElement;
  private undoBtn!: HTMLButtonElement;
  private restartBtn!: HTMLButtonElement;
  private diffSelect!: HTMLSelectElement;
  private statsEl!: HTMLElement;
  private game: Game | null = null;

  // 统计
  private gomokuStats = { wins: 0, losses: 0, draws: 0 };
  private static STATS_KEY = 'gomoku_stats';

  // 回调
  private onStartOnline: (() => void) | null = null;
  private onBackToLobby: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.loadStats();
    this.buildUI();
  }

  /** 设置联机回调 */
  setOnStartOnline(cb: () => void): void {
    this.onStartOnline = cb;
  }

  /** 设置返回大厅回调 */
  setOnBackToLobby(cb: () => void): void {
    this.onBackToLobby = cb;
  }

  private loadStats(): void {
    try {
      const raw = localStorage.getItem(UIController.STATS_KEY);
      if (raw) this.gomokuStats = { wins: 0, losses: 0, draws: 0, ...JSON.parse(raw) };
    } catch {}
  }

  private saveStats(): void {
    try { localStorage.setItem(UIController.STATS_KEY, JSON.stringify(this.gomokuStats)); } catch {}
  }

  recordResult(result: 'win' | 'lose' | 'draw'): void {
    if (result === 'win') this.gomokuStats.wins++;
    else if (result === 'lose') this.gomokuStats.losses++;
    else this.gomokuStats.draws++;
    this.saveStats();
    this.updateStats();
  }

  private updateStats(): void {
    if (!this.statsEl) return;
    const s = this.gomokuStats;
    const total = s.wins + s.losses + s.draws;
    this.statsEl.innerHTML = total > 0
      ? `<span class="stat-win">胜 ${s.wins}</span> <span class="stat-lose">负 ${s.losses}</span> <span class="stat-draw">和 ${s.draws}</span> <span class="stat-total">${total} 局</span>`
      : '';
  }

  /** 构建 DOM 结构 */
  private buildUI(): void {
    this.container.innerHTML = `
      <div class="gomoku-wrapper">
        <!-- 入口大厅 -->
        <div id="gomoku-entry" class="entry-bg">
          <div class="entry-logo">
            <span class="logo-icon">♟</span>
            <h1>五子棋</h1>
            <p class="entry-tagline">经典博弈 · 单机 / 联机 双模式</p>
          </div>
          <div class="entry-mode-grid">
            <button id="gomoku-btn-start" class="entry-mode-card primary">
              <span class="mode-icon">🎮</span>
              <span class="mode-title">单机对局</span>
              <span class="mode-desc">本地人机对战 · 可选难度</span>
            </button>
            <button id="gomoku-btn-online" class="entry-mode-card online">
              <span class="mode-icon">🌐</span>
              <span class="mode-title">联机对战</span>
              <span class="mode-desc">匹配 / 房间 · 实时对弈</span>
            </button>
          </div>
          <div class="entry-sub-row">
            <div class="diff-select-wrap">
              <label>AI 难度：</label>
              <select id="gomoku-diff" class="entry-sub-select">
                <option value="2">简单</option>
                <option value="3" selected>中等</option>
                <option value="4">困难</option>
              </select>
            </div>
          </div>
          <div id="gomoku-stats" class="gomoku-mini-stats"></div>
          <div class="entry-footer">
            <span class="footer-tip">💡 联机模式需要网络连接</span>
            <span class="footer-ver">v1.0</span>
          </div>
        </div>

        <!-- 游戏画面 -->
        <div id="gomoku-shell" class="gomoku-shell hidden">
          <div class="gomoku-shell-header">
            <button id="gomoku-back-entry" class="gomoku-back-entry-btn" type="button">
              <span class="back-icon">←</span> 返回
            </button>
            <span class="gomoku-shell-title">♟ 五子棋</span>
          </div>
          <div id="gomoku-status" class="gomoku-status">点击「开始游戏」</div>
          <div class="gomoku-shell-controls">
            <button id="gomoku-start" class="gomoku-btn primary">开始游戏</button>
            <button id="gomoku-undo" class="gomoku-btn" disabled>悔棋</button>
            <button id="gomoku-restart" class="gomoku-btn" disabled>重来</button>
          </div>
          <div class="gomoku-canvas-wrap">
            <canvas id="gomoku-canvas"></canvas>
          </div>
        </div>
      </div>
    `;

    this.statusText = document.getElementById('gomoku-status')!;
    this.startBtn = document.getElementById('gomoku-start') as HTMLButtonElement;
    this.undoBtn = document.getElementById('gomoku-undo') as HTMLButtonElement;
    this.restartBtn = document.getElementById('gomoku-restart') as HTMLButtonElement;
    this.diffSelect = document.getElementById('gomoku-diff') as HTMLSelectElement;
    this.statsEl = document.getElementById('gomoku-stats')!;

    this.updateStats();
    this.bindEntryEvents();
  }

  /** 绑定入口大厅事件 */
  private bindEntryEvents(): void {
    document.getElementById('gomoku-btn-start')?.addEventListener('click', () => {
      this.renderGameShell();
    });

    document.getElementById('gomoku-btn-online')?.addEventListener('click', () => {
      if (this.onStartOnline) this.onStartOnline();
    });

    document.getElementById('gomoku-back-entry')?.addEventListener('click', () => {
      if (this.onBackToLobby) {
        this.onBackToLobby();
      } else {
        this.renderEntryScreen();
      }
    });
  }

  /** 绑定游戏实例 */
  bindGame(game: Game): void {
    this.game = game;

    this.startBtn.addEventListener('click', () => {
      const depth = parseInt(this.diffSelect.value, 10) || 3;
      this.game!.setAIDepth(depth);
      this.game!.startGame(GameMode.PvAI);
    });

    this.undoBtn.addEventListener('click', () => {
      this.game!.undo();
    });

    this.restartBtn.addEventListener('click', () => {
      this.game!.restart();
    });
  }

  /** 获取 Canvas 元素 */
  getCanvas(): HTMLCanvasElement {
    return document.getElementById('gomoku-canvas') as HTMLCanvasElement;
  }

  /** 显示入口大厅，隐藏游戏 */
  renderEntryScreen(): void {
    const entry = document.getElementById('gomoku-entry');
    const shell = document.getElementById('gomoku-shell');
    if (entry) entry.classList.remove('hidden');
    if (shell) shell.classList.add('hidden');
    this.updateStats();
  }

  /** 显示游戏画面，隐藏入口 */
  renderGameShell(): void {
    const entry = document.getElementById('gomoku-entry');
    const shell = document.getElementById('gomoku-shell');
    if (entry) entry.classList.add('hidden');
    if (shell) shell.classList.remove('hidden');
  }

  /** 更新状态文本 */
  setStatus(state: GameState, isAITurn: boolean = false): void {
    switch (state) {
      case GameState.Idle:
        this.statusText.textContent = '点击「开始游戏」';
        this.startBtn.disabled = false;
        this.undoBtn.disabled = true;
        this.restartBtn.disabled = true;
        break;
      case GameState.Playing:
        this.statusText.textContent = isAITurn ? '🤔 AI 思考中...' : '⚫ 轮到你落子';
        this.startBtn.disabled = true;
        this.undoBtn.disabled = false;
        this.restartBtn.disabled = false;
        break;
      case GameState.Win:
        this.statusText.textContent = '🎉 你赢了！';
        this.undoBtn.disabled = true;
        this.startBtn.disabled = false;
        this.startBtn.textContent = '再来一局';
        this.restartBtn.disabled = true;
        break;
      case GameState.Lose:
        this.statusText.textContent = '💻 AI 赢了！';
        this.undoBtn.disabled = true;
        this.startBtn.disabled = false;
        this.startBtn.textContent = '再来一局';
        this.restartBtn.disabled = true;
        break;
      case GameState.Draw:
        this.statusText.textContent = '🤝 平局！';
        this.undoBtn.disabled = true;
        this.startBtn.disabled = false;
        this.startBtn.textContent = '再来一局';
        this.restartBtn.disabled = true;
        break;
    }
  }

  /** 更新状态文本（自定义） */
  setStatusText(text: string): void {
    this.statusText.textContent = text;
  }

  /** 隐藏控制按钮 */
  hideControls(): void {
    this.startBtn.style.display = 'none';
    this.undoBtn.style.display = 'none';
    this.restartBtn.style.display = 'none';
  }
}
