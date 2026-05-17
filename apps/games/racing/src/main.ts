/// <reference types="vite/client" />
import './style.css';

const W = 300;
const H = 500;
const LANE_W = 100;

interface Car { lane: number; y: number; }
interface Obstacle { lane: number; y: number; type: 'car' | 'coin'; }

let car: Car = { lane: 1, y: H - 80 };
let score = 0;
let coins = 0;
let dist = 0;
let speed = 3;
let alive = true;
let started = false;
let obstacles: Obstacle[] = [];
let frameCount = 0;
let best = 0;

const BEST_KEY = 'rc_best';
try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch { /* ignore */ }

let audioCtx: AudioContext | null = null;
function sfx(freq: number, dur: number, type: OscillatorType = 'square'): void {
  if (!audioCtx) { try { audioCtx = new AudioContext(); } catch { return; } }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

function saveBest(): void {
  if (score > best) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ } }
}

function init(): void {
  car = { lane: 1, y: H - 80 };
  score = 0;
  coins = 0;
  dist = 0;
  speed = 3;
  alive = true;
  started = true;
  obstacles = [];
}

function spawnObstacle(): void {
  const lane = Math.floor(Math.random() * 3);
  const type = Math.random() < 0.2 ? 'coin' : 'car';
  obstacles.push({ lane, y: -40, type });
}

function update(): void {
  if (!alive || !started) { return; }
  frameCount++;
  dist += speed;
  speed = 3 + dist / 5000;
  score = Math.floor(dist / 10);

  if (frameCount % Math.max(20, (60 - speed * 3) | 0) === 0) {
    spawnObstacle();
  }

  obstacles = obstacles.filter((o) => {
    o.y += speed;
    if (o.lane === car.lane && o.y > car.y - 30 && o.y < car.y + 30) {
      if (o.type === 'coin') {
        coins++;
        score += 50;
        sfx(880, 0.1, 'sine');
        return false;
      } else {
        alive = false;
        saveBest();
        sfx(150, 0.3, 'sawtooth');
        return false;
      }
    }
    return o.y < H + 50;
  });
}

// 触屏滑动换道
let touchStartX = 0;
document.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (dx > 30) { car.lane = Math.min(2, car.lane + 1); }
  if (dx < -30) { car.lane = Math.max(0, car.lane - 1); }
});

const app = document.getElementById('app')!;

function render(): void {
  const carX = LANE_W * car.lane + LANE_W / 2;

  app.innerHTML = `<div class="rc-wrapper">
    <div class="rc-header">
      <span class="rc-title">🏎️ 赛车</span>
      <div class="rc-info">
        <span>分数:${score}</span>
        <span>🪙${coins}</span>
        <span class="rc-best">最佳:${best}</span>
      </div>
    </div>
    <div class="rc-canvas-wrap">
      <canvas id="rc-canvas" width="${W}" height="${H}"></canvas>
      ${!started ? '<div class="rc-overlay"><div><h2>🏎️ 像素赛车</h2><p>←→切换车道</p><p>躲避车辆·收集金币</p><button class="rc-btn primary" id="rc-go">开始</button></div></div>' : ''}
      ${!alive ? `<div class="rc-overlay"><div><h2>撞车了！</h2><div class="rc-score">${score}</div><p>金币:${coins}</p><button class="rc-btn primary" id="rc-retry">再来</button></div></div>` : ''}
    </div>
    <div class="rc-hints">← → 切换车道</div>
    <div class="rc-touch">
      <button class="rc-tb" id="rc-tl">◀</button>
      <button class="rc-tb" id="rc-tr">▶</button>
    </div>
  </div>`;

  const c = document.getElementById('rc-canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;

  // 背景
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, W, H);

  // 车道线
  for (let i = 1; i < 3; i++) {
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(LANE_W * i, (frameCount * speed) % 35);
    ctx.lineTo(LANE_W * i, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 障碍物
  obstacles.forEach((o) => {
    const ox = LANE_W * o.lane + LANE_W / 2;
    if (o.type === 'coin') {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(ox, o.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', ox, o.y + 4);
    } else {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(ox - 15, o.y - 20, 30, 40);
      ctx.fillStyle = '#333';
      ctx.fillRect(ox - 13, o.y - 15, 10, 8);
      ctx.fillRect(ox + 3, o.y - 15, 10, 8);
    }
  });

  // 玩家车辆
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(carX - 15, car.y - 20, 30, 40);
  ctx.fillStyle = '#333';
  ctx.fillRect(carX - 13, car.y - 15, 10, 8);
  ctx.fillRect(carX + 3, car.y - 15, 10, 8);

  document.getElementById('rc-go')?.addEventListener('click', init);
  document.getElementById('rc-retry')?.addEventListener('click', init);
  document.getElementById('rc-tl')?.addEventListener('touchstart', (e) => { e.preventDefault(); car.lane = Math.max(0, car.lane - 1); }, { passive: false });
  document.getElementById('rc-tr')?.addEventListener('touchstart', (e) => { e.preventDefault(); car.lane = Math.min(2, car.lane + 1); }, { passive: false });
}

// 键盘
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') { car.lane = Math.max(0, car.lane - 1); }
  if (e.key === 'ArrowRight' || e.key === 'd') { car.lane = Math.min(2, car.lane + 1); }
});

init();
alive = false;
started = false;
setInterval(() => { update(); render(); }, 16);
render();
