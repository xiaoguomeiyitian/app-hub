import { Game2048 } from './render/Game2048.js';
import { OnlineClient } from './online/OnlineClient.js';
import { OnlineLobby } from './ui/OnlineLobby.js';
import './style.css';

const app = document.getElementById('app')!;

app.innerHTML = `
  <div class="g2048-wrapper">
    <!-- 入口大厅 -->
    <div id="g2048-entry" class="entry-bg">
      <div class="entry-logo">
        <span class="logo-icon">🟧</span>
        <h1>2048</h1>
        <p class="entry-tagline">经典数字拼图 · 单机 / 联机 双入口</p>
      </div>
      <div class="entry-actions">
        <button id="g2048-btn-start" class="entry-btn primary">
          <span class="btn-icon">🎮</span>
          <span class="btn-text-wrap">
            <span class="btn-text">单机对局</span>
            <span class="btn-desc">本地挑战 · 经典 2048</span>
          </span>
        </button>
        <button id="g2048-btn-online" class="entry-btn">
          <span class="btn-icon">🌐</span>
          <span class="btn-text-wrap">
            <span class="btn-text">联机对战</span>
            <span class="btn-desc">匹配 · 房间 · 实时竞技</span>
          </span>
        </button>
      </div>
      <div class="entry-footer">v1.0 · 经典 2048 · 单机 / 联机 双入口</div>
    </div>

    <!-- 游戏画面 -->
    <div id="g2048-shell" class="g2048-shell hidden">
      <div class="g2048-shell-header">
        <button id="g2048-back-entry" class="g2048-back-btn" type="button">🏠 返回入口</button>
        <span class="g2048-shell-title">🟧 2048</span>
      </div>
      <div class="g2048-header">
        <div class="g2048-score-box">
          <div class="g2048-score-label">分数</div>
          <div id="g2048-score" class="g2048-score-value">0</div>
        </div>
        <div class="g2048-score-box">
          <div class="g2048-score-label">最高</div>
          <div id="g2048-best" class="g2048-score-value">0</div>
        </div>
      </div>
      <div class="g2048-actions">
        <button id="g2048-new" class="g2048-btn">新游戏</button>
        <button id="g2048-undo" class="g2048-btn" disabled>↩ 撤销</button>
      </div>
      <div id="g2048-status" class="g2048-status">鼠标拖动或触摸滑动合并数字</div>
      <div id="g2048-opponent-wrap" class="g2048-opponent-wrap" style="display:none">
        <div class="g2048-opponent-panel">
          <div class="g2048-opponent-label">对手</div>
          <div id="g2048-opponent-score" class="g2048-score-value" style="font-size:1.2rem">0</div>
          <div id="g2048-opponent-status" class="g2048-opponent-status"></div>
        </div>
      </div>
      <div class="g2048-canvas-wrap">
        <canvas id="g2048-canvas"></canvas>
        <!-- 游戏结算遮罩 -->
        <div id="g2048-overlay" class="g2048-overlay hidden">
          <div class="g2048-overlay-card">
            <h2 id="g2048-go-title">游戏结束</h2>
            <div id="g2048-go-stats" class="g2048-go-stats"></div>
            <div class="g2048-go-actions">
              <button id="g2048-retry" class="g2048-btn primary">再来一局</button>
              <button id="g2048-undo-go" class="g2048-btn">↩ 撤销继续</button>
              <button id="g2048-back-entry-go" class="g2048-btn" style="background:#888">🏠 返回入口</button>
            </div>
          </div>
        </div>
      </div>
      <div class="g2048-hints">鼠标拖动/触摸滑动移动 | Z 撤销</div>
    </div>
  </div>
`;

const canvas = document.getElementById('g2048-canvas') as HTMLCanvasElement;
const scoreEl = document.getElementById('g2048-score')!;
const bestEl = document.getElementById('g2048-best')!;
const statusEl = document.getElementById('g2048-status')!;
const opponentWrap = document.getElementById('g2048-opponent-wrap')!;
const opponentScoreEl = document.getElementById('g2048-opponent-score')!;
const opponentStatusEl = document.getElementById('g2048-opponent-status')!;
const newGameBtn = document.getElementById('g2048-new')!;
const undoBtn = document.getElementById('g2048-undo') as HTMLButtonElement;
const overlay = document.getElementById('g2048-overlay')!;
const goTitle = document.getElementById('g2048-go-title')!;
const goStats = document.getElementById('g2048-go-stats')!;
const retryBtn = document.getElementById('g2048-retry') as HTMLButtonElement;
const undoGoBtn = document.getElementById('g2048-undo-go') as HTMLButtonElement;
const backEntryGoBtn = document.getElementById('g2048-back-entry-go')!;

const game = new Game2048(canvas, scoreEl, bestEl, statusEl);

function updateUndoBtn(): void {
  undoBtn.disabled = !game.canUndo();
}

function showOverlay(): void {
  const isWin = game.won && !game.engine.canMove();
  const maxTile = game.engine.maxTile();
  goTitle.textContent = isWin ? '🎉 恭喜通关！' : '游戏结束';
  goStats.innerHTML = `
    <div class="go-stat"><span>💯 最终分数</span><span>${game.score.toLocaleString()}</span></div>
    <div class="go-stat"><span>🔢 总步数</span><span>${game.moves}</span></div>
    <div class="go-stat"><span>🏆 最高方块</span><span>${maxTile}</span></div>
    <div class="go-stat dim"><span>📊 历史最佳</span><span>${game.best.toLocaleString()}</span></div>
    ${game.score >= game.best && game.score > 0 ? '<div class="go-new-record">🏅 新纪录！</div>' : ''}
  `;
  overlay.classList.remove('hidden');
  undoGoBtn.style.display = game.canUndo() ? '' : 'none';
}

function hideOverlay(): void {
  overlay.classList.add('hidden');
}

// ===== 联机模块 =====
const onlineClient = new OnlineClient();
const onlineLobby = new OnlineLobby(app, onlineClient);
let isOnlineMode = false;

function showEntry(): void {
  document.getElementById('g2048-entry')?.classList.remove('hidden');
  document.getElementById('g2048-shell')?.classList.add('hidden');
}

function showShell(): void {
  document.getElementById('g2048-entry')?.classList.add('hidden');
  document.getElementById('g2048-shell')?.classList.remove('hidden');
}

game.setMoveCallback((dir, result, gameOver) => {
  updateUndoBtn();
  if (!isOnlineMode) return;
  onlineClient.send('game:move', {
    direction: dir,
    merges: result.merges,
  });
  if (gameOver) {
    onlineClient.send('game:over', { score: game.getScore(), maxTile: game.getEngine().maxTile() });
  }
});

// 定期检查游戏结束状态
let checkTimer: number | null = null;
function startGameOverCheck(): void {
  if (checkTimer) clearInterval(checkTimer);
  checkTimer = window.setInterval(() => {
    if (game.gameOver) {
      if (checkTimer) { clearInterval(checkTimer); checkTimer = null; }
      showOverlay();
    }
    updateUndoBtn();
  }, 200);
}

onlineLobby.setOnStartGame(() => {
  isOnlineMode = true;
  opponentWrap.style.display = '';
  newGameBtn.textContent = '单机重开';
  statusEl.textContent = '联机对局开始！';
  showShell();
  game.start();
  updateUndoBtn();
});

onlineClient.on('game:opponent_moved', (data: unknown) => {
  const d = data as { score: number };
  opponentScoreEl.textContent = String(d.score);
});

onlineClient.on('game:attack_received', (data: unknown) => {
  const d = data as { attack: string };
  const attackNames: Record<string, string> = {
    lock: '🔒 锁定', freeze: '❄️ 冰冻', increment: '📈 增值',
    bomb: '💣 炸弹', rotate: '🔄 旋转', ghost: '👻 幽灵', monument: '🏛️ 纪念碑',
  };
  statusEl.textContent = `⚠️ ${attackNames[d.attack] || d.attack} 攻击！`;
  opponentStatusEl.textContent = `收到 ${attackNames[d.attack] || d.attack}`;
});

onlineClient.on('game:over', (data: unknown) => {
  const d = data as { winner: string; scores: Record<string, number> };
  isOnlineMode = false;
  newGameBtn.textContent = '单机重开';
  const scoreKeys = Object.keys(d.scores);
  if (scoreKeys.length >= 2) {
    const myScore = d.scores[scoreKeys[0]] || 0;
    const oppScore = d.scores[scoreKeys[1]] || 0;
    statusEl.textContent = `游戏结束！${myScore > oppScore ? '🎉 你赢了！' : myScore < oppScore ? '😢 你输了' : '🤝 平局'}`;
  }
  showOverlay();
});

onlineClient.on('room:opponent_left', () => {
  statusEl.textContent = '⚠️ 对手已离开';
});

// ===== 键盘 Z 撤销 =====
window.addEventListener('keydown', (e) => {
  if (e.key === 'z' || e.key === 'Z') {
    e.preventDefault();
    if (game.undo()) {
      hideOverlay();
      updateUndoBtn();
    }
  }
});

// ===== 入口大厅事件 =====
document.getElementById('g2048-btn-start')?.addEventListener('click', () => {
  showShell();
  game.start();
  hideOverlay();
  updateUndoBtn();
  startGameOverCheck();
});

document.getElementById('g2048-btn-online')?.addEventListener('click', () => {
  isOnlineMode = false;
  onlineLobby.hide();
  onlineClient.disconnect();
  opponentWrap.style.display = 'none';
  newGameBtn.textContent = '单机重开';
  hideOverlay();
  showShell();
  statusEl.textContent = '请选择匹配或创建房间';
  onlineClient.connect();
  onlineLobby.show();
});

document.getElementById('g2048-back-entry')?.addEventListener('click', () => {
  isOnlineMode = false;
  onlineLobby.hide();
  onlineClient.disconnect();
  opponentWrap.style.display = 'none';
  newGameBtn.textContent = '单机重开';
  hideOverlay();
  showEntry();
});

newGameBtn.addEventListener('click', () => {
  if (!isOnlineMode) {
    game.start();
    hideOverlay();
    updateUndoBtn();
    startGameOverCheck();
  }
});

undoBtn.addEventListener('click', () => {
  game.undo();
  hideOverlay();
  updateUndoBtn();
});

retryBtn.addEventListener('click', () => {
  hideOverlay();
  game.start();
  updateUndoBtn();
  startGameOverCheck();
});

undoGoBtn.addEventListener('click', () => {
  game.undo();
  hideOverlay();
  updateUndoBtn();
});

backEntryGoBtn.addEventListener('click', () => {
  isOnlineMode = false;
  onlineLobby.hide();
  onlineClient.disconnect();
  opponentWrap.style.display = 'none';
  newGameBtn.textContent = '单机重开';
  hideOverlay();
  showEntry();
});

// 初始显示入口
showEntry();
startGameOverCheck();
updateUndoBtn();
