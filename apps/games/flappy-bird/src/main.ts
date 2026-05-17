import './style.css';

const W = 300, H = 500;
const GRAVITY = 0.4, JUMP = -7, PIPE_W = 50, GAP = 120, BIRD_R = 14;

let by = H / 2, bvy = 0, rotation = 0;
let pipes: { x: number; ty: number; by: number; scored: boolean }[] = [];
let score = 0, bestScore = 0;
let alive = true, started = false;
let frameCount = 0;
let groundX = 0;

const BEST_KEY = 'flappy_best';
try { bestScore = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch {}

function saveBest(): void {
  if (score > bestScore) {
    bestScore = score;
    try { localStorage.setItem(BEST_KEY, String(bestScore)); } catch {}
  }
}

function init(): void {
  by = H / 2; bvy = 0; rotation = 0;
  pipes = []; score = 0; alive = true; started = false; frameCount = 0; groundX = 0;
}

function addPipe(): void {
  const minTop = 60, maxTop = H - 160 - GAP;
  const ty = Math.random() * (maxTop - minTop) + minTop;
  pipes.push({ x: W + 20, ty, by: ty + GAP, scored: false });
}

function update(): void {
  if (!alive || !started) return;
  frameCount++;
  bvy += GRAVITY;
  by += bvy;
  rotation = bvy < -2 ? -25 : bvy < 0 ? -15 : bvy < 3 ? 0 : Math.min(bvy * 5, 70);

  // 管道
  const speed = 2 + Math.min(score / 20, 1.5); // 难度递增
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= speed;
    // 计分
    if (!pipes[i].scored && pipes[i].x + PIPE_W < W / 2) {
      pipes[i].scored = true;
      score++;
    }
    // 移除
    if (pipes[i].x < -PIPE_W - 10) pipes.splice(i, 1);
    // 碰撞
    if (W / 2 + BIRD_R > pipes[i].x && W / 2 - BIRD_R < pipes[i].x + PIPE_W) {
      if (by - BIRD_R < pipes[i].ty || by + BIRD_R > pipes[i].by) {
        alive = false;
        saveBest();
        return;
      }
    }
  }

  if (pipes.length === 0 || pipes[pipes.length - 1].x < W - 200) addPipe();

  if (by - BIRD_R < 0) { by = BIRD_R; bvy = 0; }
  if (by + BIRD_R > H - 40) { by = H - 40 - BIRD_R; alive = false; saveBest(); }

  groundX = (groundX + speed) % 24;
}

const app = document.getElementById('app')!;

function render(): void {
  app.innerHTML = `<div class="fl-wrapper">
    <div class="fl-header">
      <span class="fl-title">🐦 Flappy Bird</span>
      <div class="fl-scores">
        <span>得分: ${score}</span>
        <span class="fl-best">最高: ${bestScore}</span>
      </div>
      <button id="fl-restart" class="fl-btn">重开</button>
    </div>
    <div class="fl-canvas-wrap">
      <canvas id="fl-canvas" width="${W}" height="${H}"></canvas>
      ${!started && alive ? '<div class="fl-overlay"><div class="fl-start"><h2>🐦 Flappy Bird</h2><p>点击或按空格开始</p><p class="fl-best-info">最高分: ' + bestScore + '</p></div></div>' : ''}
      ${!alive ? `<div class="fl-overlay"><div class="fl-over"><h2>${score >= bestScore && score > 0 ? '🏆 新纪录！' : '游戏结束'}</h2><div class="fl-over-stats"><div class="fl-over-score">${score}</div><div class="fl-over-label">得分</div><div class="fl-over-best">${bestScore}</div><div class="fl-over-label">最高</div></div><button class="fl-btn primary" id="fl-retry">再来一局</button></div></div>` : ''}
    </div>
    <div class="fl-hints">点击/空格 跳跃</div>
  </div>`;

  const c = document.getElementById('fl-canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;

  // 天空渐变
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#4dc9f6');
  sky.addColorStop(1, '#87ceeb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 云朵
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 3; i++) {
    const cx = ((i * 120 + frameCount * 0.3) % (W + 60)) - 30;
    const cy = 40 + i * 50;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.arc(cx + 18, cy - 5, 16, 0, Math.PI * 2);
    ctx.arc(cx + 30, cy, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // 管道
  for (const p of pipes) {
    // 上管
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(p.x, 0, PIPE_W, p.ty);
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(p.x - 3, p.ty - 20, PIPE_W + 6, 20);
    // 下管
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(p.x, p.by, PIPE_W, H - p.by);
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(p.x - 3, p.by, PIPE_W + 6, 20);
  }

  // 地面
  ctx.fillStyle = '#ded895';
  ctx.fillRect(0, H - 40, W, 40);
  ctx.fillStyle = '#c4a856';
  for (let x = -groundX; x < W; x += 24) {
    ctx.fillRect(x, H - 40, 12, 4);
  }

  // 鸟
  ctx.save();
  ctx.translate(W / 2, by);
  ctx.rotate((rotation * Math.PI) / 180);
  // 身体
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_R, BIRD_R * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // 翅膀
  const wingY = alive ? Math.sin(frameCount * 0.5) * 4 : 5;
  ctx.fillStyle = '#e8b808';
  ctx.beginPath();
  ctx.ellipse(-4, wingY, 8, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // 眼睛
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(7, -4, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // 嘴巴
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(BIRD_R - 2, 0);
  ctx.lineTo(BIRD_R + 6, 2);
  ctx.lineTo(BIRD_R - 2, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 事件
  document.getElementById('fl-restart')?.addEventListener('click', () => init());
  document.getElementById('fl-retry')?.addEventListener('click', () => init());
}

function flap(): void {
  if (!alive) return;
  if (!started) { started = true; addPipe(); }
  bvy = JUMP;
}

window.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); flap(); }
});
app.addEventListener('click', flap);
app.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, { passive: false });

init();
setInterval(() => { update(); render(); }, 30);
render();
