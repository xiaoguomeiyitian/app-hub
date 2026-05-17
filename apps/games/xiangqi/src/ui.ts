// ===== UI 界面管理 =====
import { APP_VERSION } from './version.js';
export type GameMode = 'single';

export class UIManager {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  showLobby(onStart: (color: 'red' | 'black', difficulty: 'easy' | 'medium' | 'hard' | 'harder') => void, onBackToMenu?: () => void): void {
    let selectedColor: 'red' | 'black' = 'red';
    let selectedDifficulty: 'easy' | 'medium' | 'hard' | 'harder' = 'medium';

    this.container.innerHTML = `
      <div class="lobby single-lobby">
          <h1>♟ 单机对战</h1>
        <p class="lobby-note">本地人机对战 · 玩家棋子始终显示在下方</p>
        <div class="lobby-form compact-form">
          <div class="choice-section compact-section">
            <div class="side-cards" id="color-cards">
              <div class="side-card active" data-color="red">
                <span class="side-icon">🔴</span>
                <span class="side-name">红方</span>
                <span class="side-desc">先手</span>
              </div>
              <div class="side-card" data-color="black">
                <span class="side-icon">⚫</span>
                <span class="side-name">黑方</span>
                <span class="side-desc">后手</span>
              </div>
            </div>
          </div>

          <div class="difficulty-section compact-section">
            <div class="difficulty-cards" id="difficulty-cards">
              <div class="difficulty-card" data-difficulty="easy">
                <span class="diff-icon">🟢</span>
                <span class="diff-name">简单</span>
                <span class="diff-desc">depth 2</span>
              </div>
              <div class="difficulty-card active" data-difficulty="medium">
                <span class="diff-icon">🟡</span>
                <span class="diff-name">中等</span>
                <span class="diff-desc">depth 3</span>
              </div>
              <div class="difficulty-card" data-difficulty="hard">
                <span class="diff-icon">🔴</span>
                <span class="diff-name">困难</span>
                <span class="diff-desc">depth 4</span>
              </div>
              <div class="difficulty-card harder-card" data-difficulty="harder">
                <span class="diff-icon harder-icon">🔥</span>
                <span class="diff-name">炼狱</span>
                <span class="diff-desc">depth 5 · 极高强度</span>
              </div>
            </div>
          </div>

          <button id="btn-start" class="btn btn-primary-action">开始对战</button>
          <button id="btn-back-from-single" class="btn btn-secondary">返回模式选择</button>
        </div>
      </div>
    `;

    document.querySelectorAll('.side-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.side-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedColor = card.getAttribute('data-color') as 'red' | 'black';
      });
    });

    document.querySelectorAll('.difficulty-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.difficulty-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedDifficulty = card.getAttribute('data-difficulty') as 'easy' | 'medium' | 'hard' | 'harder';
      });
    });

    document.getElementById('btn-start')!.addEventListener('click', () => {
      onStart(selectedColor, selectedDifficulty);
    });

    document.getElementById('btn-back-from-single')?.addEventListener('click', () => {
      onBackToMenu?.();
    });
  }

  showGame(
    myColor: 'red' | 'black',
    difficulty: 'easy' | 'medium' | 'hard' | 'harder',
    onUndo: () => void,
    onRestart: () => void,
    onResign: () => void,
    onBack?: () => void,
    onHint?: () => void,
  ): void {
    this.container.innerHTML = `
      <div class="game">
        <div class="game-header">
          <div class="game-version-badge">${APP_VERSION}</div>
          <div class="turn-pill" id="turn-indicator">红方走棋</div>
          <div class="game-difficulty-badge">单机对战 · ${difficulty}</div>
        </div>

        <div class="game-layout">
          <div class="board-column">
            <div class="board-shell" id="canvas-wrapper">
              <canvas id="game-canvas"></canvas>
              <div id="board-input-layer" class="board-input-layer" aria-hidden="true"></div>
            </div>
          </div>

          <aside class="game-sidebar" aria-label="对局信息">
            <div class="sidebar-card">
              <div class="sidebar-title">对局信息</div>
              <div class="game-color-badge" id="my-color-label">你执：${myColor === 'red' ? '🔴 红方' : '⚫ 黑方'}</div>
              <div class="game-placement-tip">你的棋子始终显示在下方</div>
            </div>
            <div class="sidebar-card game-actions-card">
              <div class="sidebar-title">操作</div>
              <div class="control-actions control-actions-3col">
                <button id="btn-undo" class="btn btn-secondary btn-mini">悔棋</button>
                <button id="btn-restart" class="btn btn-secondary btn-mini">重开</button>
                <button id="btn-hint" class="btn btn-secondary btn-mini">💡 提示</button>
                <button id="btn-resign" class="btn btn-danger btn-mini">认输</button>
                <button id="btn-back-menu" class="btn btn-secondary btn-mini">返回菜单</button>
              </div>
            </div>
            <div class="sidebar-card game-tip-card">
              <div class="sidebar-title">提示</div>
              <div class="game-info">
                <span id="status-hint">点击棋子后查看可走位置</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;

    document.getElementById('btn-undo')!.addEventListener('click', onUndo);
    document.getElementById('btn-restart')!.addEventListener('click', onRestart);
    document.getElementById('btn-resign')!.addEventListener('click', onResign);
    document.getElementById('btn-hint')?.addEventListener('click', () => onHint?.());
    document.getElementById('btn-back-menu')?.addEventListener('click', () => {
      onBack?.();
    });
  }

  getContainer(): HTMLElement { return this.container; }
  getCanvas(): HTMLCanvasElement {
    return document.getElementById('game-canvas') as HTMLCanvasElement;
  }

  updateTurn(turn: 'red' | 'black', isMyTurn: boolean): void {
    const el = document.getElementById('turn-indicator');
    if (el) {
      el.textContent = turn === 'red' ? '红方走棋' : '黑方走棋';
      el.className = `turn-pill ${turn} ${isMyTurn ? 'my-turn' : ''}`;
    }
  }

  updateColorBadge(myColor: 'red' | 'black', perspective: 'red' | 'black'): void {
    const el = document.getElementById('my-color-label');
    if (el) {
      el.textContent = `你执：${myColor === 'red' ? '🔴 红方' : '⚫ 黑方'} · 视角：${perspective === 'red' ? '红方下方' : '黑方下方'}`;
    }
  }

  showGameOver(winner: string, reason: string, onBack: () => void, onReview?: () => void): void {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>游戏结束</h2>
        <p class="winner">${winner}</p>
        <p class="reason">${reason}</p>
        <div class="modal-actions">
          ${onReview ? '<button class="btn btn-secondary" id="btn-review">📊 复盘分析</button>' : ''}
          <button class="btn btn-primary-action" id="btn-back-lobby">返回大厅</button>
        </div>
      </div>
    `;
    this.container.appendChild(overlay);
    document.getElementById('btn-back-lobby')!.addEventListener('click', onBack);
    document.getElementById('btn-review')?.addEventListener('click', () => {
      overlay.remove();
      onReview?.();
    });
  }

  showNotification(msg: string): void {
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }
}
