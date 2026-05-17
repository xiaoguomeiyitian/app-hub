/// <reference types="vite/client" />
import './style.css';

const W = 300, H = 500, BALL_R = 12, HOOP_W = 70, HOOP_Y = 80;
const TIME_LIMIT = 60;

let ballX = W / 2, ballY = H - 60, ballDx = 0, ballDy = 0;
let ballInAir = false, hoopX = W / 2 - HOOP_W / 2, hoopDir = 1;
let score = 0, best = 0, timeLeft = TIME_LIMIT;
let charging = false, chargeStart = 0, chargePower = 0;
let gameActive = false, gameStarted = false;
let timer: number | null = null;
let combo = 0;

const BEST_KEY = 'bb_best';
try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch {}

let audioCtx: AudioContext | null = null;
function playSound(freq: number, dur: number, type: OscillatorType = 'sine'): void {
  if (!audioCtx) try { audioCtx = new AudioContext(); } catch { return; }
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.12, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
}

function startGame(): void {
  score = 0; timeLeft = TIME_LIMIT; combo = 0;
  gameActive = true; gameStarted = true; ballInAir = false;
  resetBall();
  if (timer) clearInterval(timer);
  timer = window.setInterval(() => {
    if (!gameActive) return;
    timeLeft--;
    if (timeLeft <= 0) { gameActive = false; saveBest(); }
    render();
  }, 1000);
  render();
}

function resetBall(): void {
  ballX = W / 2; ballY = H - 60; ballDx = 0; ballDy = 0; ballInAir = false;
}

function saveBest(): void {
  if (score > best) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch {} }
}

function shoot(power: number): void {
  if (ballInAir || !gameActive) return;
  const p = Math.min(power, 100) / 100;
  ballDy = -(8 + p * 12);
  ballDx = (Math.random() - 0.5) * 4;
  ballInAir = true;
  playSound(440, 0.1);
}

function update(): void {
  if (!gameActive) return;

  // Move hoop
  hoopX += hoopDir * 1.5;
  if (hoopX <= 20 || hoopX + HOOP_W >= W - 20) hoopDir *= -1;

  if (!ballInAir) return;

  ballDy += 0.3; // gravity
  ballX += ballDx;
  ballY += ballDy;

  // Walls
  if (ballX - BALL_R < 0) { ballX = BALL_R; ballDx = Math.abs(ballDx); playSound(200, 0.05); }
  if (ballX + BALL_R > W) { ballX = W - BALL_R; ballDx = -Math.abs(ballDx); playSound(200, 0.05); }
  if (ballY - BALL_R < 0) { ballY = BALL_R; ballDy = Math.abs(ballDy); }

  // Hoop collision
  const hx = hoopX, hy = HOOP_Y;
  if (ballY > hy - 5 && ballY < hy + 15 && ballX > hx && ballX < hx + HOOP_W && ballDy > 0) {
    // Score!
    const points = 2 + (combo >= 3 ? 1 : 0);
    score += points;
    combo++;
    playSound(880, 0.2, 'sine');
    setTimeout(() => playSound(1100, 0.15, 'sine'), 100);
    resetBall();
    return;
  }

  // Backboard
  if (ballY > hy - 20 && ballY < hy + 5 && (ballX < hx - 5 || ballX > hx + HOOP_W + 5)) {
    ballDy = Math.abs(ballDy) * 0.7;
    combo = 0;
    playSound(150, 0.1);
  }

  // Ball out of bounds
  if (ballY > H + 50) {
    combo = 0;
    playSound(100, 0.2, 'sawtooth');
    resetBall();
  }
}

const app = document.getElementById('app')!;

function render(): void {
  const power = charging ? Math.min((Date.now() - chargeStart) / 15, 100) : 0;
  chargePower = power;

  app.innerHTML = `<div class="bb-wrapper">
    <div class="bb-header">
      <span class="bb-title">🏀 投篮</span>
      <div class="bb-info">
        <span>得分: ${score}</span>
        <span>⏱ ${timeLeft}s</span>
        ${combo >= 3 ? `<span class="bb-combo">🔥 x${combo}</span>` : ''}
      </div>
      <span class="bb-best">最佳: ${best}</span>
    </div>
    <div class="bb-canvas-wrap">
      <canvas id="bb-canvas" width="${W}" height="${H}"></canvas>
      ${!gameStarted ? '<div class="bb-overlay"><div class="bb-start"><h2>🏀 投篮大赛</h2><p>按住蓄力，松开投篮</p><p>60秒内尽可能多得分</p><button class="bb-btn primary" id="bb-begin">开始</button></div></div>' : ''}
      ${!gameActive && gameStarted ? `<div class="bb-overlay"><div class="bb-over"><h2>时间到！</h2><div class="bb-over-score">${score}</div><p>最佳: ${best}</p><button class="bb-btn primary" id="bb-retry">再来一局</button></div></div>` : ''}
    </div>
    <div class="bb-hints">按住鼠标/屏幕蓄力，松开投篮</div>
  </div>`;

  const c = document.getElementById('bb-canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;

  // Court
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);
  // Floor
  ctx.fillStyle = '#2d1810';
  ctx.fillRect(0, H - 40, W, 40);
  ctx.strokeStyle = '#4a2810';
  ctx.beginPath(); ctx.moveTo(0, H - 40); ctx.lineTo(W, H - 40); ctx.stroke();

  // Hoop backboard
  ctx.fillStyle = '#fff';
  ctx.fillRect(hoopX - 5, HOOP_Y - 20, HOOP_W + 10, 5);
  // Rim
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hoopX, HOOP_Y);
  ctx.lineTo(hoopX + HOOP_W, HOOP_Y);
  ctx.stroke();
  ctx.lineWidth = 1;
  // Net
  ctx.strokeStyle = '#ccc';
  for (let i = 0; i < 5; i++) {
    const nx = hoopX + (HOOP_W * i / 4);
    ctx.beginPath(); ctx.moveTo(nx, HOOP_Y); ctx.lineTo(nx + (Math.sin(frameCount * 0.1 + i) * 3), HOOP_Y + 25); ctx.stroke();
  }

  // Ball
  ctx.beginPath();
  ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = '#ff8c00';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Ball lines
  ctx.beginPath();
  ctx.moveTo(ballX - BALL_R, ballY);
  ctx.lineTo(ballX + BALL_R, ballY);
  ctx.stroke();

  // Power bar
  if (charging || ballInAir) {
    const barH = 150, barW = 16;
    const bx = W - 30, by = H / 2 - barH / 2;
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, barW, barH);
    const fill = power / 100;
    ctx.fillStyle = `hsl(${120 - fill * 120}, 80%, 50%)`;
    ctx.fillRect(bx, by + barH * (1 - fill), barW, barH * fill);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(bx, by, barW, barH);
  }

  // Events
  document.getElementById('bb-begin')?.addEventListener('click', startGame);
  document.getElementById('bb-retry')?.addEventListener('click', startGame);
}

let frameCount = 0;

function startCharge(): void {
  if (!gameActive || ballInAir) return;
  charging = true;
  chargeStart = Date.now();
}

function endCharge(): void {
  if (!charging) return;
  charging = false;
  const power = Math.min((Date.now() - chargeStart) / 15, 100);
  shoot(power);
}

// Mouse/Touch
document.addEventListener('mousedown', (e) => {
  if ((e.target as HTMLElement).tagName === 'BUTTON') return;
  startCharge();
});
document.addEventListener('mouseup', endCharge);
document.addEventListener('touchstart', (e) => {
  if ((e.target as HTMLElement).tagName === 'BUTTON') return;
  e.preventDefault();
  startCharge();
}, { passive: false });
document.addEventListener('touchend', endCharge);

init();
function init(): void { gameActive = false; gameStarted = false; resetBall(); render(); }
setInterval(() => { update(); frameCount++; render(); }, 16);
render();
