import { CanvasRenderer } from './render/CanvasRenderer.js';
import { KeyHandler } from './input/KeyHandler.js';
import { EndlessMode } from './modes/EndlessMode.js';
import { SprintMode } from './modes/SprintMode.js';
import { StatsManager } from './core/StatsManager.js';
import { OnlineClient } from './online/OnlineClient.js';
import { OnlineGameController } from './online/OnlineGameController.js';
import { OnlineLobby } from './ui/OnlineLobby.js';
import type { ClearResult } from './types.js';
import './style.css';

const statsManager = new StatsManager();

// ===== 格式化时间 =====
function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  const mmm = String(Math.floor(ms % 1000)).padStart(3, '0').slice(0, 2);
  return m > 0 ? `${m}:${ss}.${mmm}` : `${ss}.${mmm}`;
}

// ===== DOM =====
const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="tetris-wrapper">
    <!-- 入口大厅 -->
    <div id="tetris-entry" class="entry-bg">
      <div class="entry-logo">
        <span class="logo-icon">🟦</span>
        <h1>俄罗斯方块</h1>
        <p class="entry-tagline">经典消除 · 单机 / 联机 双入口</p>
      </div>
      <div class="entry-actions">
        <button id="tetris-btn-start" class="entry-btn primary">
          <span class="btn-icon">🎮</span>
          <span class="btn-text-wrap">
            <span class="btn-text">单机对局</span>
            <span class="btn-desc">本地畅玩 · 经典玩法</span>
          </span>
        </button>
        <button id="tetris-btn-online" class="entry-btn">
          <span class="btn-icon">🌐</span>
          <span class="btn-text-wrap">
            <span class="btn-text">联机对战</span>
            <span class="btn-desc">匹配 · 房间 · 实时竞技</span>
          </span>
        </button>
      </div>
      <div class="entry-sub-row">
        <button id="tetris-mode-sprint" class="entry-sub-btn">🏁 40 行竞速</button>
        <button id="tetris-mode-zen" class="entry-sub-btn">🧘 禅模式</button>
      </div>
      <div class="entry-footer">v1.0 · 经典俄罗斯方块 · 单机 / 联机 双入口</div>
    </div>

    <!-- 游戏画面 -->
    <div id="tetris-shell" class="tetris-shell hidden">
      <div class="tetris-shell-header">
        <button id="tetris-back-entry" class="tetris-back-btn" type="button">🏠 返回入口</button>
        <span class="tetris-shell-title">🟦 俄罗斯方块</span>
      </div>
      <div id="tetris-status" class="tetris-status">选择模式并开始</div>
      <div class="tetris-game-area">
        <div class="tetris-side">
          <div class="tetris-panel">
            <div class="tetris-panel-label">HOLD</div>
            <canvas id="tetris-hold"></canvas>
          </div>
          <div class="tetris-stats">
            <div><span class="stat-label">分数</span><span id="stat-score">0</span></div>
            <div><span class="stat-label">行数</span><span id="stat-lines">0</span></div>
            <div><span class="stat-label">等级</span><span id="stat-level">1</span></div>
            <div><span class="stat-label">Combo</span><span id="stat-combo">0</span></div>
            <div><span class="stat-label">B2B</span><span id="stat-b2b">0</span></div>
            <div id="stat-timer-row" style="display:none"><span class="stat-label">⏱ 计时</span><span id="stat-timer">0:00.00</span></div>
          </div>
          <div class="tetris-best" id="tetris-best"></div>
        </div>
        <div class="tetris-main">
          <canvas id="tetris-canvas"></canvas>
          <!-- 游戏结算遮罩 -->
          <div id="tetris-gameover-overlay" class="tetris-gameover-overlay hidden">
            <div class="tetris-gameover-card">
              <h2 id="go-title">游戏结束</h2>
              <div class="go-stats" id="go-stats"></div>
              <div class="go-bests" id="go-bests"></div>
              <div class="go-actions">
                <button id="go-retry" class="tetris-btn primary">再来一局</button>
                <button id="go-close" class="tetris-btn">🏠 返回入口</button>
              </div>
            </div>
          </div>
        </div>
        <div class="tetris-side">
          <div id="tetris-opponent-wrap" style="display:none">
            <div class="tetris-opponent-panel">
              <div class="tetris-opponent-label">对手</div>
              <canvas id="tetris-opponent-canvas"></canvas>
              <div id="tetris-opponent-info" class="tetris-opponent-info"></div>
            </div>
          </div>
          <div class="tetris-panel">
            <div class="tetris-panel-label">NEXT</div>
            <canvas id="tetris-next"></canvas>
          </div>
        </div>
      </div>
      <div class="tetris-hints">
        ← → 移动 | ↓ 软降 | Space 硬降 | ↑/X 顺时针 | Z 逆时针 | C Hold | P 暂停
      </div>
      <!-- 移动端触控 -->
      <div id="tetris-touch" class="tetris-touch">
        <div class="touch-row">
          <button class="touch-btn" data-action="rotateCCW" aria-label="逆时针旋转">↶</button>
          <button class="touch-btn wide" data-action="hardDrop" aria-label="硬降">⬇⬇</button>
          <button class="touch-btn" data-action="rotateCW" aria-label="顺时针旋转">↷</button>
        </div>
        <div class="touch-row">
          <button class="touch-btn" data-action="left" aria-label="左移">◀</button>
          <button class="touch-btn" data-action="softDrop" aria-label="软降">▽</button>
          <button class="touch-btn" data-action="right" aria-label="右移">▶</button>
        </div>
        <div class="touch-row">
          <button class="touch-btn" data-action="hold" aria-label="Hold">H</button>
          <button class="touch-btn" data-action="pause" aria-label="暂停">⏸</button>
        </div>
      </div>
    </div>
  </div>
`;

// ===== 实例 =====
const canvas = document.getElementById('tetris-canvas') as HTMLCanvasElement;
const holdCanvas = document.getElementById('tetris-hold') as HTMLCanvasElement;
const nextCanvas = document.getElementById('tetris-next') as HTMLCanvasElement;
const renderer = new CanvasRenderer(canvas, holdCanvas, nextCanvas);

type ModeType = EndlessMode | SprintMode | null;
let mode: ModeType = null;
let timer: number | null = null;
let sprintTimer: number | null = null;
let keyHandler: KeyHandler | null = null;
let isOnlineMode = false;
let currentModeName = 'endless';

// 统计踪
let sessionTSpins = 0;
let sessionQuads = 0;
let sessionAllClears = 0;
let sessionMaxCombo = 0;
let sessionMaxB2B = 0;

const statusEl = document.getElementById('tetris-status')!;
const scoreEl = document.getElementById('stat-score');
const linesEl = document.getElementById('stat-lines');
const levelEl = document.getElementById('stat-level');
const comboEl = document.getElementById('stat-combo');
const b2bEl = document.getElementById('stat-b2b');
const timerRow = document.getElementById('stat-timer-row')!;
const timerEl = document.getElementById('stat-timer');
const opponentWrap = document.getElementById('tetris-opponent-wrap')!;
const bestEl = document.getElementById('tetris-best')!;
const goOverlay = document.getElementById('tetris-gameover-overlay')!;
const goTitle = document.getElementById('go-title')!;
const goStats = document.getElementById('go-stats')!;
const goBests = document.getElementById('go-bests')!;
const goRetry = document.getElementById('go-retry') as HTMLButtonElement;
const goClose = document.getElementById('go-close') as HTMLButtonElement;

// ===== 联机模块 =====
const onlineClient = new OnlineClient();
const onlineController = new OnlineGameController(
  onlineClient, renderer, statusEl,
  scoreEl!, linesEl!, levelEl!, comboEl!, b2bEl!
);
const onlineLobby = new OnlineLobby(app, onlineClient);

onlineLobby.setOnStartGame(() => {
  isOnlineMode = true;
  opponentWrap.style.display = '';
  statusEl.textContent = '联机对局开始！';
  showShell();
  onlineController.start();
});

onlineController.setOnGameOver((_winner) => {
  // re-enable controls when online game ends
});

// ===== 画面切换 =====
function showEntry(): void {
  document.getElementById('tetris-entry')?.classList.remove('hidden');
  document.getElementById('tetris-shell')?.classList.add('hidden');
}

function showShell(): void {
  document.getElementById('tetris-entry')?.classList.add('hidden');
  document.getElementById('tetris-shell')?.classList.remove('hidden');
}

// ===== 更新最佳记录显示 =====
function updateBestDisplay(): void {
  const s = statsManager.get();
  let html = '';
  if (currentModeName === 'sprint') {
    if (s.bestSprintTime !== null) {
      html = `<div class="best-item"><span>🏆 最佳40L</span><span>${formatTime(s.bestSprintTime)}</span></div>`;
    }
  } else {
    if (s.bestScore > 0) html += `<div class="best-item"><span>🏆 最高分</span><span>${s.bestScore.toLocaleString()}</span></div>`;
    if (s.bestLines > 0) html += `<div class="best-item"><span>📏 最多行</span><span>${s.bestLines}</span></div>`;
  }
  if (s.totalGames > 0) html += `<div class="best-item"><span>🎮 总局数</span><span>${s.totalGames}</span></div>`;
  bestEl.innerHTML = html;
}

// ===== 显示游戏结算 =====
function showGameOver(): void {
  const s = statsManager.get();
  let title = '游戏结束';
  let statsHtml = '';

  if (currentModeName === 'sprint' && mode instanceof SprintMode) {
    const elapsed = mode.elapsed;
    const completed = mode.isFinished();
    title = completed ? '🎉 40 行完成！' : '游戏结束';
    statsHtml = `
      <div class="go-stat"><span>⏱ 用时</span><span>${formatTime(elapsed)}</span></div>
      <div class="go-stat"><span>📏 行数</span><span>${mode.lines} / 40</span></div>
      <div class="go-stat"><span>💯 分数</span><span>${mode.score.toLocaleString()}</span></div>
      <div class="go-stat"><span>🔥 T-Spin</span><span>${mode.tspinCount}</span></div>
      <div class="go-stat"><span>💥 四消</span><span>${mode.quadCount}</span></div>
      <div class="go-stat"><span>🔗 最大 Combo</span><span>${mode.maxCombo}</span></div>
    `;
    if (completed) {
      const isBest = s.bestSprintTime === null || elapsed <= s.bestSprintTime;
      if (isBest) statsHtml += '<div class="go-new-record">🏅 新纪录！</div>';
    }
  } else {
    const score = mode ? mode.score : 0;
    const lines = mode ? mode.lines : 0;
    const level = mode ? mode.level : 1;
    const isBest = score >= s.bestScore;
    statsHtml = `
      <div class="go-stat"><span>💯 最终分数</span><span>${score.toLocaleString()}</span></div>
      <div class="go-stat"><span>📏 消行数</span><span>${lines}</span></div>
      <div class="go-stat"><span>📊 等级</span><span>${level}</span></div>
      <div class="go-stat"><span>🔗 最大 Combo</span><span>${sessionMaxCombo}</span></div>
      <div class="go-stat"><span>🔥 最大 B2B</span><span>${sessionMaxB2B}</span></div>
      <div class="go-stat"><span>🌀 T-Spin</span><span>${sessionTSpins}</span></div>
      <div class="go-stat"><span>💥 四消</span><span>${sessionQuads}</span></div>
      ${isBest && score > 0 ? '<div class="go-new-record">🏅 新纪录！</div>' : ''}
    `;
  }

  goTitle.textContent = title;
  goStats.innerHTML = statsHtml;

  // 历史最佳
  let bestsHtml = '';
  if (currentModeName === 'sprint') {
    if (s.bestSprintTime !== null) bestsHtml = `<div class="go-stat dim"><span>🏆 最佳40L</span><span>${formatTime(s.bestSprintTime)}</span></div>`;
  } else {
    bestsHtml = `<div class="go-stat dim"><span>🏆 历史最高分</span><span>${s.bestScore.toLocaleString()}</span></div>`;
  }
  bestsHtml += `<div class="go-stat dim"><span>🎮 总局数</span><span>${s.totalGames}</span></div>`;
  goBests.innerHTML = bestsHtml;

  goOverlay.classList.remove('hidden');
}

function hideGameOver(): void {
  goOverlay.classList.add('hidden');
}

// ===== 开始游戏 =====
function startGame(modeName?: string): void {
  stopGame();
  hideGameOver();
  isOnlineMode = false;
  if (modeName) currentModeName = modeName;

  // 重置统计
  sessionTSpins = 0;
  sessionQuads = 0;
  sessionAllClears = 0;
  sessionMaxCombo = 0;
  sessionMaxB2B = 0;

  // 计时器显示
  timerRow.style.display = currentModeName === 'sprint' ? '' : 'none';

  showShell();

  if (currentModeName === 'zen') {
    mode = new EndlessMode();
    (mode as any)._isZen = true;
  } else if (currentModeName === 'sprint') {
    mode = new SprintMode();
  } else {
    mode = new EndlessMode();
  }

  keyHandler = new KeyHandler(handleAction);
  statusEl.textContent = currentModeName === 'zen' ? '禅模式 — 无限畅玩' : '游戏中';
  render();
  startTimer();

  if (currentModeName === 'sprint') startSprintTimer();
  updateBestDisplay();
}

function stopGame(): void {
  if (timer) { clearInterval(timer); timer = null; }
  if (sprintTimer) { clearInterval(sprintTimer); sprintTimer = null; }
  if (keyHandler) { keyHandler.destroy(); keyHandler = null; }
  onlineController.stop();
}

function handleAction(action: string): void {
  if (isOnlineMode) { onlineController.handleAction(action); return; }
  if (!mode) return;

  if (action === 'pause') {
    mode.paused = !mode.paused;
    statusEl.textContent = mode.paused ? '已暂停' : '游戏中';
    return;
  }

  const result = mode.handleAction(action);
  if (result) {
    showResult(result);
    // 统计
    if (result.type.startsWith('tspin')) sessionTSpins++;
    if (result.type === 'quad') sessionQuads++;
    if (result.allClear) sessionAllClears++;
    if (result.combo > sessionMaxCombo) sessionMaxCombo = result.combo;
  }
  render();

  // 禅模式：game over 时清理顶部行
  if (mode.gameOver && (mode as any)._isZen) {
    zenClearTop();
    return;
  }

  if (mode.gameOver) {
    // 记录统计
    if (currentModeName === 'sprint' && mode instanceof SprintMode) {
      if (mode.isFinished()) {
        statsManager.recordSprintTime(mode.elapsed);
      }
      statsManager.recordGameEnd(mode.score, mode.lines, 1, mode.maxCombo, mode.maxB2B, mode.tspinCount, mode.quadCount, mode.allClearCount);
    } else {
      statsManager.recordGameEnd(mode.score, mode.lines, mode.level, sessionMaxCombo, sessionMaxB2B, sessionTSpins, sessionQuads, sessionAllClears);
    }
    stopGame();
    showGameOver();
    updateBestDisplay();
  }
}

/** 禅模式：游戏结束时清理顶部 4 行，继续游戏 */
function zenClearTop(): void {
  if (!mode) return;
  const board = (mode as EndlessMode).board;
  const grid = board.grid;
  // 清空顶部 4 行
  for (let r = 0; r < 4; r++) {
    grid[r] = Array(10).fill(0);
  }
  // 把下面的行往下移
  mode.gameOver = false;
  if (mode instanceof EndlessMode) mode.current = null;
  mode.spawn();
  statusEl.textContent = '禅模式 — 无限畅玩';
  render();
}

function startTimer(): void {
  if (timer) clearInterval(timer);
  timer = window.setInterval(() => {
    if (!mode || mode.gameOver || mode.paused) return;
    const result = mode.tick();
    if (result) {
      showResult(result);
      if (result.type.startsWith('tspin')) sessionTSpins++;
      if (result.type === 'quad') sessionQuads++;
      if (result.allClear) sessionAllClears++;
      if (result.combo > sessionMaxCombo) sessionMaxCombo = result.combo;
    }
    render();

    if (mode.gameOver && (mode as any)._isZen) {
      zenClearTop();
      return;
    }

    if (mode.gameOver) {
      if (currentModeName === 'sprint' && mode instanceof SprintMode) {
        if (mode.isFinished()) statsManager.recordSprintTime(mode.elapsed);
        statsManager.recordGameEnd(mode.score, mode.lines, 1, mode.maxCombo, mode.maxB2B, mode.tspinCount, mode.quadCount, mode.allClearCount);
      } else {
        statsManager.recordGameEnd(mode.score, mode.lines, mode.level, sessionMaxCombo, sessionMaxB2B, sessionTSpins, sessionQuads, sessionAllClears);
      }
      stopGame();
      showGameOver();
      updateBestDisplay();
    }
    if (timer) { clearInterval(timer); startTimer(); }
  }, mode?.getDropInterval() ?? 800);
}

function startSprintTimer(): void {
  if (sprintTimer) clearInterval(sprintTimer);
  sprintTimer = window.setInterval(() => {
    if (!mode || mode.gameOver || mode.paused) return;
    if (mode instanceof SprintMode && timerEl) {
      timerEl.textContent = formatTime(mode.getElapsed());
    }
  }, 50);
}

function render(): void {
  if (!mode) return;
  renderer.render(mode.getState(), mode.getGhostY());
  updateStats();
}

function updateStats(): void {
  if (!mode) return;
  scoreEl!.textContent = String(mode.score);
  linesEl!.textContent = String(mode.lines);
  levelEl!.textContent = String(mode.level);
  comboEl!.textContent = String(mode.combo);
  b2bEl!.textContent = String(mode.b2b);
}

function showResult(r: ClearResult): void {
  const msgs: Record<string, string> = {
    single: 'Single', double: 'Double', triple: 'Triple', quad: 'QUAD!',
    tspin_single: 'T-Spin Single!', tspin_double: 'T-Spin Double!',
    tspin_triple: 'T-Spin Triple!', tspin_mini: 'T-Spin Mini', tspin_mini_double: 'T-Spin Mini Double',
  };
  let msg = msgs[r.type] ?? '';
  if (r.allClear) msg += ' ALL CLEAR!';
  if (r.totalAttack > 0) msg += ` +${r.totalAttack}攻击`;
  if (msg) statusEl.textContent = msg;
}

// ===== 入口大厅事件 =====
document.getElementById('tetris-btn-start')?.addEventListener('click', () => {
  startGame('endless');
});

document.getElementById('tetris-mode-sprint')?.addEventListener('click', () => {
  startGame('sprint');
});

document.getElementById('tetris-mode-zen')?.addEventListener('click', () => {
  startGame('zen');
});

document.getElementById('tetris-btn-online')?.addEventListener('click', () => {
  onlineLobby.hide();
  onlineClient.disconnect();
  onlineController.stop();
  opponentWrap.style.display = 'none';
  isOnlineMode = false;
  currentModeName = 'endless';
  timerRow.style.display = 'none';
  updateBestDisplay();
  showShell();
  statusEl.textContent = '请选择匹配或创建房间';
  onlineClient.connect();
  onlineLobby.show();
});

document.getElementById('tetris-back-entry')?.addEventListener('click', () => {
  stopGame();
  hideGameOver();
  isOnlineMode = false;
  onlineLobby.hide();
  onlineClient.disconnect();
  onlineController.stop();
  opponentWrap.style.display = 'none';
  currentModeName = 'endless';
  timerRow.style.display = 'none';
  updateBestDisplay();
  showEntry();
});

// ===== 事件绑定 =====
goRetry.addEventListener('click', () => { hideGameOver(); startGame(currentModeName); });
goClose.addEventListener('click', () => {
  hideGameOver();
  stopGame();
  isOnlineMode = false;
  onlineLobby.hide();
  onlineClient.disconnect();
  onlineController.stop();
  opponentWrap.style.display = 'none';
  showEntry();
});

// ===== 移动端触控 =====
document.querySelectorAll<HTMLButtonElement>('.touch-btn[data-action]').forEach(btn => {
  const action = btn.dataset.action!;
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleAction(action);
  }, { passive: false });
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    handleAction(action);
  });
});

// 窗口 resize
window.addEventListener('resize', () => {
  renderer.resize();
  if (isOnlineMode) { /* online controller renders */ }
  else render();
});

// 初始显示入口
renderer.resize();
updateBestDisplay();
showEntry();
