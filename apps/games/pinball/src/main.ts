/// <reference types="vite/client" />
import './style.css';

const W = 300, H = 500, BALL_R = 6, PAD_W = 60, PAD_H = 8;
const GRAVITY = 0.15, BOUNCE = 0.85;

interface Ball { x: number; y: number; dx: number; dy: number; }
interface Bumper { x: number; y: number; r: number; score: number; color: string; }
interface Target { x: number; y: number; w: number; h: number; score: number; hit: boolean; }

let ball: Ball = { x: W / 2, y: H - 100, dx: 0, dy: 0 };
let score = 0, best = 0, lives = 3, alive = false, started = false;
let lpadX = 80, rpadX = 180, lpadDown = false, rpadDown = false;
let frameCount = 0;

const BEST_KEY = 'pinball_best';
try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch {}

const bumpers: Bumper[] = [
  { x: 80, y: 120, r: 18, score: 100, color: '#ff6b6b' },
  { x: 220, y: 120, r: 18, score: 100, color: '#ff6b6b' },
  { x: 150, y: 180, r: 20, score: 150, color: '#feca57' },
  { x: 80, y: 260, r: 15, score: 100, color: '#48dbfb' },
  { x: 220, y: 260, r: 15, score: 100, color: '#48dbfb' },
  { x: 150, y: 320, r: 16, score: 120, color: '#ff9ff3' },
  { x: 60, y: 370, r: 12, score: 80, color: '#54a0ff' },
  { x: 240, y: 370, r: 12, score: 80, color: '#54a0ff' },
];

const targets: Target[] = [
  { x: 50, y: 80, w: 30, h: 10, score: 200, hit: false },
  { x: 135, y: 60, w: 30, h: 10, score: 300, hit: false },
  { x: 220, y: 80, w: 30, h: 10, score: 200, hit: false },
];

// Audio
let audioCtx: AudioContext | null = null;
function playSound(freq: number, dur: number, type: OscillatorType = 'square'): void {
  if (!audioCtx) try { audioCtx = new AudioContext(); } catch { return; }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

function init(): void {
  ball = { x: W / 2, y: H - 150, dx: (Math.random() - 0.5) * 3, dy: -4 };
  score = 0;
  lives = 3;
  alive = true;
  started = true;
  targets.forEach(t => t.hit = false);
  lpadX = 80;
  rpadX = 180;
}

function resetBall(): void {
  ball = { x: W / 2, y: H - 150, dx: (Math.random() - 0.5) * 3, dy: -4 };
}

function saveBest(): void {
  if (score > best) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch {} }
}

function update(): void {
  if (!alive || !started) return;
  frameCount++;

  // Physics
  ball.dy += GRAVITY;
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Walls
  if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.dx = Math.abs(ball.dx); playSound(300, 0.05); }
  if (ball.x + BALL_R > W) { ball.x = W - BALL_R; ball.dx = -Math.abs(ball.dx); playSound(300, 0.05); }
  if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.dy = Math.abs(ball.dy); playSound(300, 0.05); }

  // Bottom - lose life
  if (ball.y + BALL_R > H) {
    lives--;
    playSound(150, 0.3, 'sawtooth');
    if (lives <= 0) { alive = false; saveBest(); return; }
    resetBall();
    return;
  }

  // Bumpers
  for (const b of bumpers) {
    const dx = ball.x - b.x, dy = ball.y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < BALL_R + b.r) {
      const nx = dx / dist, ny = dy / dist;
      ball.x = b.x + nx * (BALL_R + b.r);
      ball.y = b.y + ny * (BALL_R + b.r);
      ball.dx = nx * Math.abs(ball.dx + ball.dy) * BOUNCE + nx * 2;
      ball.dy = ny * Math.abs(ball.dx + ball.dy) * BOUNCE + ny * 2;
      score += b.score;
      playSound(600 + b.score, 0.1, 'sine');
    }
  }

  // Targets
  for (const t of targets) {
    if (!t.hit && ball.x > t.x && ball.x < t.x + t.w && ball.y > t.y && ball.y < t.y + t.h) {
      t.hit = true;
      score += t.score;
      ball.dy = -Math.abs(ball.dy);
      playSound(880, 0.15, 'sine');
      // Check all targets hit
      if (targets.every(tt => tt.hit)) {
        score += 1000;
        targets.forEach(tt => tt.hit = false);
        playSound(1200, 0.3, 'sine');
      }
    }
  }

  // Left paddle
  const ly = H - 40;
  if (lpadDown) {
    // Paddle up (rotate)
    const px = lpadX + PAD_W / 2;
    if (ball.y + BALL_R > ly - 15 && ball.y < ly && ball.x > lpadX && ball.x < lpadX + PAD_W) {
      ball.dy = -Math.abs(ball.dy) - 2;
      ball.dx += (ball.x - px) * 0.15;
      playSound(440, 0.05);
    }
  } else {
    if (ball.y + BALL_R > ly && ball.y + BALL_R < ly + PAD_H + 4 && ball.x > lpadX && ball.x < lpadX + PAD_W) {
      ball.dy = -Math.abs(ball.dy) * BOUNCE;
      playSound(440, 0.05);
    }
  }

  // Right paddle
  const ry = H - 40;
  if (rpadDown) {
    const px = rpadX + PAD_W / 2;
    if (ball.y + BALL_R > ry - 15 && ball.y < ry && ball.x > rpadX && ball.x < rpadX + PAD_W) {
      ball.dy = -Math.abs(ball.dy) - 2;
      ball.dx += (ball.x - px) * 0.15;
      playSound(440, 0.05);
    }
  } else {
    if (ball.y + BALL_R > ry && ball.y + BALL_R < ry + PAD_H + 4 && ball.x > rpadX && ball.x < rpadX + PAD_W) {
      ball.dy = -Math.abs(ball.dy) * BOUNCE;
      playSound(440, 0.05);
    }
  }

  // Slow terminal velocity
  const maxV = 12;
  if (Math.abs(ball.dx) > maxV) ball.dx = Math.sign(ball.dx) * maxV;
  if (ball.dy > maxV) ball.dy = maxV;
}

const app = document.getElementById('app')!;

function render(): void {
  app.innerHTML = `<div class="pb-wrapper">
    <div class="pb-header">
      <span class="pb-title">🎯 弹球</span>
      <div class="pb-info"><span>得分: ${score}</span><span>❤️×${lives}</span><span class="pb-best">最佳: ${best}</span></div>
      <button id="pb-restart" class="pb-btn">重开</button>
    </div>
    <div class="pb-canvas-wrap">
      <canvas id="pb-canvas" width="${W}" height="${H}"></canvas>
      ${!started ? '<div class="pb-overlay"><div class="pb-start"><h2>🎯 弹球</h2><p>← → 键控制挡板</p><p class="pb-best-info">最高分: ' + best + '</p><button class="pb-btn primary" id="pb-begin">开始</button></div></div>' : ''}
      ${!alive ? `<div class="pb-overlay"><div class="pb-over"><h2>游戏结束</h2><div class="pb-over-score">${score}</div><p class="pb-best-info">最高: ${best}</p><button class="pb-btn primary" id="pb-retry">再来一局</button></div></div>` : ''}
    </div>
    <div class="pb-hints">← 左挡板 | → 右挡板</div>
    <div class="pb-touch">
      <button class="pb-touch-btn left" id="pb-tl">◀ LEFT</button>
      <button class="pb-touch-btn right" id="pb-tr">RIGHT ▶</button>
    </div>
  </div>`;

  const c = document.getElementById('pb-canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  // Targets
  for (const t of targets) {
    ctx.fillStyle = t.hit ? '#333' : '#ffd700';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    if (!t.hit) {
      ctx.fillStyle = '#fff';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(t.score), t.x + t.w / 2, t.y + 8);
    }
  }

  // Bumpers
  for (const b of bumpers) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(b.score), b.x, b.y);
  }

  // Paddles
  ctx.fillStyle = '#8b5cf6';
  // Left paddle (tilted when pressed)
  ctx.save();
  ctx.translate(lpadX + PAD_W / 2, H - 40);
  ctx.rotate(lpadDown ? -0.4 : 0);
  ctx.fillRect(-PAD_W / 2, -PAD_H / 2, PAD_W, PAD_H);
  ctx.restore();
  // Right paddle
  ctx.save();
  ctx.translate(rpadX + PAD_W / 2, H - 40);
  ctx.rotate(rpadDown ? 0.4 : 0);
  ctx.fillRect(-PAD_W / 2, -PAD_H / 2, PAD_W, PAD_H);
  ctx.restore();

  // Ball
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  // Glow
  ctx.shadowColor = '#8b5cf6';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Events
  document.getElementById('pb-restart')?.addEventListener('click', init);
  document.getElementById('pb-begin')?.addEventListener('click', init);
  document.getElementById('pb-retry')?.addEventListener('click', init);

  // Touch
  const tl = document.getElementById('pb-tl');
  const tr = document.getElementById('pb-tr');
  tl?.addEventListener('touchstart', (e) => { e.preventDefault(); lpadDown = true; }, { passive: false });
  tl?.addEventListener('touchend', () => { lpadDown = false; });
  tl?.addEventListener('mousedown', () => { lpadDown = true; });
  tl?.addEventListener('mouseup', () => { lpadDown = false; });
  tr?.addEventListener('touchstart', (e) => { e.preventDefault(); rpadDown = true; }, { passive: false });
  tr?.addEventListener('touchend', () => { rpadDown = false; });
  tr?.addEventListener('mousedown', () => { rpadDown = true; });
  tr?.addEventListener('mouseup', () => { rpadDown = false; });
}

// Keyboard
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') lpadDown = true;
  if (e.key === 'ArrowRight' || e.key === 'd') rpadDown = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') lpadDown = false;
  if (e.key === 'ArrowRight' || e.key === 'd') rpadDown = false;
});

init();
setInterval(() => { update(); render(); }, 16);
render();
