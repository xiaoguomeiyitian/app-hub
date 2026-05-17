import './style.css';

const W = 500, H = 300, PW = 10, PH = 60, BALL_R = 8;
const WIN_SCORE = 5;

let bx = W / 2, by = H / 2, bdx = 3, bdy = 2;
let py = H / 2 - PH / 2, ey = H / 2 - PH / 2;
let ps = 0, es = 0, speed = 3;
let paused = false, gameOver = false;
let difficulty = 0.08; // AI 反应速度
let bestWins = 0;

const BEST_KEY = 'pong_best';
try { bestWins = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch {}

function saveBest(): void {
  if (ps > bestWins) {
    bestWins = ps;
    try { localStorage.setItem(BEST_KEY, String(bestWins)); } catch {}
  }
}

function resetBall(): void {
  bx = W / 2; by = H / 2;
  bdx = 3 * (Math.random() > 0.5 ? 1 : -1);
  bdy = (Math.random() * 2 - 1) * 2;
  speed = 3;
}

function initGame(): void {
  ps = 0; es = 0;
  py = H / 2 - PH / 2; ey = H / 2 - PH / 2;
  paused = false; gameOver = false;
  resetBall();
}

function update(): void {
  if (paused || gameOver) return;

  bx += bdx; by += bdy;

  // 上下反弹
  if (by - BALL_R <= 0) { by = BALL_R; bdy = Math.abs(bdy); }
  if (by + BALL_R >= H) { by = H - BALL_R; bdy = -Math.abs(bdy); }

  // 玩家球拍碰撞
  if (bx - BALL_R <= 20 && bx - BALL_R >= 10 && by >= py && by <= py + PH) {
    bdx = Math.abs(bdx);
    bdy = (by - py - PH / 2) / 8;
    speed = Math.min(7, speed + 0.15);
  }

  // AI 球拍碰撞
  if (bx + BALL_R >= W - 20 && bx + BALL_R <= W - 10 && by >= ey && by <= ey + PH) {
    bdx = -Math.abs(bdx);
    bdy += (Math.random() - 0.5) * 0.5;
  }

  // 得分
  if (bx <= 0) {
    es++;
    if (es >= WIN_SCORE) { gameOver = true; saveBest(); }
    else resetBall();
  }
  if (bx >= W) {
    ps++;
    if (ps >= WIN_SCORE) { gameOver = true; saveBest(); }
    else resetBall();
  }

  // AI 移动
  ey += (by - ey - PH / 2) * difficulty;
  ey = Math.max(0, Math.min(H - PH, ey));
}

const app = document.getElementById('app')!;

function render(): void {
  const winner = ps >= WIN_SCORE ? '你赢了！' : 'AI 赢了';

  app.innerHTML = `<div class="pg-wrapper">
    <div class="pg-header">
      <span class="pg-title">🏓 乒乓球</span>
      <div class="pg-score">${ps} <span class="pg-colon">:</span> ${es}</div>
      <div class="pg-btns">
        <select id="pg-diff" class="pg-select">
          <option value="0.05">简单</option>
          <option value="0.08" selected>中等</option>
          <option value="0.13">困难</option>
        </select>
        <button id="pg-pause" class="pg-btn">${paused ? '继续' : '暂停'}</button>
        <button id="pg-restart" class="pg-btn">重开</button>
      </div>
    </div>
    <div class="pg-best">目标: ${WIN_SCORE} 分 | 最佳: ${bestWins} 胜</div>
    <div class="pg-canvas-wrap">
      <canvas id="pg-canvas" width="${W}" height="${H}"></canvas>
      ${gameOver ? `<div class="pg-overlay"><div class="pg-over-card"><h2>${ps >= WIN_SCORE ? '🎉' : '😢'} ${winner}</h2><div class="pg-over-score">${ps} : ${es}</div><button class="pg-btn primary" id="pg-retry">再来一局</button></div></div>` : ''}
      ${paused && !gameOver ? '<div class="pg-overlay"><div class="pg-pause-card"><h2>⏸ 已暂停</h2><button class="pg-btn primary" id="pg-resume">继续</button></div></div>' : ''}
    </div>
    <div class="pg-hints">↑↓ 移动 | P 暂停</div>
    <div class="pg-touch">
      <div class="pg-touch-zone">
        <canvas id="pg-touch-canvas" width="80" height="200"></canvas>
      </div>
    </div>
  </div>`;

  // 绘制游戏画面
  const c = document.getElementById('pg-canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

  // 中线
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();

  // 分数
  ctx.setLineDash([]);
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillText(String(ps), W / 4, 60);
  ctx.fillText(String(es), W * 3 / 4, 60);

  // 球拍 - 发光效果
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#fff';
  ctx.fillRect(10, py, PW, PH);
  ctx.fillRect(W - 20, ey, PW, PH);
  ctx.shadowBlur = 0;

  // 球 - 发光
  ctx.shadowColor = '#0ff';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 触控区域
  const tc = document.getElementById('pg-touch-canvas') as HTMLCanvasElement;
  if (tc) {
    const tctx = tc.getContext('2d')!;
    tctx.fillStyle = '#222';
    tctx.fillRect(0, 0, 80, 200);
    tctx.fillStyle = '#444';
    tctx.font = '12px sans-serif';
    tctx.textAlign = 'center';
    tctx.fillText('拖动控制', 40, 100);
  }

  // 事件
  document.getElementById('pg-restart')?.addEventListener('click', initGame);
  document.getElementById('pg-retry')?.addEventListener('click', initGame);
  document.getElementById('pg-pause')?.addEventListener('click', () => { if (!gameOver) paused = !paused; render(); });
  document.getElementById('pg-resume')?.addEventListener('click', () => { paused = false; render(); });

  const diffSel = document.getElementById('pg-diff') as HTMLSelectElement;
  diffSel?.addEventListener('change', () => {
    difficulty = parseFloat(diffSel.value);
  });
}

// 键盘
window.addEventListener('keydown', e => {
  if (e.code === 'ArrowUp') { e.preventDefault(); py = Math.max(0, py - 20); }
  if (e.code === 'ArrowDown') { e.preventDefault(); py = Math.min(H - PH, py + 20); }
  if (e.key === 'p' || e.key === 'P') { if (!gameOver) paused = !paused; }
});

// 触控拖动
let touchY = 0;
app.addEventListener('touchstart', e => {
  const touch = e.touches[0];
  const rect = (e.target as HTMLElement).getBoundingClientRect?.();
  touchY = touch.clientY;
}, { passive: true });

app.addEventListener('touchmove', e => {
  e.preventDefault();
  const touch = e.touches[0];
  const dy = touch.clientY - touchY;
  py = Math.max(0, Math.min(H - PH, py + dy * 0.8));
  touchY = touch.clientY;
}, { passive: false });

initGame();
setInterval(() => { update(); render(); }, 16);
render();
