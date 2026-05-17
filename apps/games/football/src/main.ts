/// <reference types="vite/client" />
import './style.css';

// ===== 常量 =====
const W = 400;
const H = 300;
const BALL_R = 6;
const PAD_H = 50;
const PAD_W = 8;

// ===== 状态 =====
let bx = W / 2;
let by = H / 2;
let bdx = 3;
let bdy = 2;
let scoreA = 0;
let scoreB = 0;
let py = H / 2 - PAD_H / 2;
let ey = H / 2 - PAD_H / 2;
let half = 1;
let timeLeft = 30;
let gameActive = false;
let started = false;
let timer: number | null = null;
let best = 0;

const BEST_KEY = 'fb_best';
try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch { /* ignore */ }

// ===== 音效 =====
let audioCtx: AudioContext | null = null;
function sfx(freq: number, dur: number, type: OscillatorType = 'sine'): void {
  if (!audioCtx) { try { audioCtx = new AudioContext(); } catch { return; } }
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

// ===== 游戏逻辑 =====
function resetBall(): void {
  bx = W / 2;
  by = H / 2;
  bdx = 3 * (Math.random() > 0.5 ? 1 : -1);
  bdy = (Math.random() - 0.5) * 4;
}

function startGame(): void {
  scoreA = 0;
  scoreB = 0;
  half = 1;
  timeLeft = 30;
  gameActive = true;
  started = true;
  resetBall();
  if (timer) { clearInterval(timer); }
  timer = window.setInterval(() => {
    if (!gameActive) { return; }
    timeLeft--;
    if (timeLeft <= 0) {
      if (half === 1) {
        half = 2;
        timeLeft = 30;
        sfx(880, 0.3);
      } else {
        gameActive = false;
        if (scoreA > best) {
          best = scoreA;
          try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ }
        }
      }
    }
    render();
  }, 1000);
  render();
}

function update(): void {
  if (!gameActive) { return; }
  bx += bdx;
  by += bdy;
  // 墙壁反弹
  if (by - BALL_R < 0 || by + BALL_R > H) { bdy *= -1; sfx(300, 0.05); }
  // 玩家挡板
  if (bx - BALL_R < 30 && by > py && by < py + PAD_H) {
    bdx = Math.abs(bdx);
    bdy += (by - py - PAD_H / 2) * 0.1;
    sfx(440, 0.1);
  }
  // AI 挡板
  if (bx + BALL_R > W - 30 && by > ey && by < ey + PAD_H) {
    bdx = -Math.abs(bdx);
    bdy += (by - ey - PAD_H / 2) * 0.1;
    sfx(440, 0.1);
  }
  // 得分
  if (bx < 0) { scoreB++; resetBall(); sfx(200, 0.2, 'sawtooth'); }
  if (bx > W) { scoreA++; resetBall(); sfx(880, 0.3, 'sine'); }
  // AI 移动
  ey += (by - ey - PAD_H / 2) * 0.08;
  // 速度限制
  const speed = Math.sqrt(bdx * bdx + bdy * bdy);
  if (speed > 8) { bdx *= 8 / speed; bdy *= 8 / speed; }
}

// ===== 渲染 =====
const app = document.getElementById('app')!;

function render(): void {
  app.innerHTML = `<div class="fb-wrapper">
    <div class="fb-header">
      <span class="fb-title">⚽ 足球</span>
      <div class="fb-score">${scoreA} : ${scoreB}</div>
      <div class="fb-info">
        <span>半场${half}</span>
        <span>${timeLeft}s</span>
        <span>最佳:${best}</span>
      </div>
    </div>
    <div class="fb-canvas-wrap">
      <canvas id="fb-canvas" width="${W}" height="${H}"></canvas>
      ${!started ? '<div class="fb-overlay"><div><h2>⚽ 足球</h2><p>↑↓移动挡板</p><p>2×30秒半场</p><button class="fb-btn primary" id="fb-go">开始</button></div></div>' : ''}
      ${!gameActive && started ? `<div class="fb-overlay"><div><h2>${scoreA > scoreB ? '你赢了！' : '游戏结束'}</h2><div class="fb-final">${scoreA} : ${scoreB}</div><button class="fb-btn primary" id="fb-retry">再来</button></div></div>` : ''}
    </div>
    <div class="fb-hints">↑↓ 移动</div>
    <div class="fb-touch">
      <button class="fb-tb" id="fb-tu">▲</button>
      <button class="fb-tb" id="fb-td">▼</button>
    </div>
  </div>`;

  const c = document.getElementById('fb-canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1a4d1a';
  ctx.fillRect(0, 0, W, H);
  // 中线
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 40, 0, Math.PI * 2);
  ctx.stroke();
  // 挡板
  ctx.fillStyle = '#fff';
  ctx.fillRect(28, py, PAD_W, PAD_H);
  ctx.fillRect(W - 36, ey, PAD_W, PAD_H);
  // 球
  ctx.beginPath();
  ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  // 暗色分数
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.font = '60px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(scoreA), W / 4, 70);
  ctx.fillText(String(scoreB), W * 3 / 4, 70);

  document.getElementById('fb-go')?.addEventListener('click', startGame);
  document.getElementById('fb-retry')?.addEventListener('click', startGame);
  document.getElementById('fb-tu')?.addEventListener('touchstart', (e) => { e.preventDefault(); py = Math.max(0, py - 20); }, { passive: false });
  document.getElementById('fb-td')?.addEventListener('touchstart', (e) => { e.preventDefault(); py = Math.min(H - PAD_H, py + 20); }, { passive: false });
}

// ===== 键盘 =====
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') { py = Math.max(0, py - 20); }
  if (e.key === 'ArrowDown') { py = Math.min(H - PAD_H, py + 20); }
});

// ===== 初始化 =====
function init(): void { gameActive = false; started = false; render(); }
init();
setInterval(() => { update(); render(); }, 16);
render();
