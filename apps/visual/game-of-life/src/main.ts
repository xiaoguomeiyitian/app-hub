import './style.css';

const COLS = 100;
const ROWS = 70;
const CELL = Math.min(8, Math.floor((window.innerWidth - 32) / COLS));
const W = COLS * CELL;
const H = ROWS * CELL;

let grid = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
let running = false;
let generation = 0;
let speed = 80; // ms per step
let timer: ReturnType<typeof setInterval> | null = null;

// Presets (relative coords from center)
const PRESETS: Record<string, [number, number][]> = {
  '滑翔机': [[0,0],[1,0],[2,0],[2,1],[1,2]],
  '轻量飞船': [[0,1],[0,3],[1,0],[2,0],[3,0],[3,3],[4,0],[4,1],[4,2]],
  '脉冲星': (() => {
    const pts: [number, number][] = [];
    const base = [[2,0],[3,0],[4,0],[8,0],[9,0],[10,0],[0,2],[5,2],[7,2],[12,2],[0,3],[5,3],[7,3],[12,3],[0,4],[5,4],[7,4],[12,4],[2,5],[3,5],[4,5],[8,5],[9,5],[10,5]];
    for (const [x,y] of base) { pts.push([x,y]); pts.push([x,12-y]); pts.push([12-x,y]); pts.push([12-x,12-y]); }
    return pts;
  })(),
  '滑翔机枪': [[0,4],[0,5],[1,4],[1,5],[10,4],[10,5],[10,6],[11,3],[11,7],[12,2],[12,8],[13,2],[13,8],[14,5],[15,3],[15,7],[16,4],[16,5],[16,6],[17,5],[20,2],[20,3],[20,4],[21,2],[21,3],[21,4],[22,1],[22,5],[24,0],[24,1],[24,5],[24,6],[34,2],[34,3],[35,2],[35,3]],
  '方块': [[0,0],[0,1],[1,0],[1,1]],
  '蜂巢': [[1,0],[2,0],[0,1],[3,1],[1,2],[2,2]],
  '闪烁灯': [[0,0],[1,0],[2,0]],
  'RPentomino': [[0,1],[1,0],[1,1],[1,2],[2,0]],
  'Diehard': [[6,0],[0,1],[1,1],[1,2],[5,2],[6,2],[7,2]],
  'Acorn': [[1,0],[3,1],[0,2],[1,2],[4,2],[5,2],[6,2]],
};

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1>🦠 Conway's Game of Life</h1>
    <div class="controls">
      <button class="btn ${running?'primary':''}" id="playBtn">${running?'⏸ 暂停':'▶️ 运行'}</button>
      <button class="btn" id="stepBtn">⏭ 单步</button>
      <button class="btn" id="clearBtn">🗑️ 清空</button>
      <button class="btn" id="randomBtn">🎲 随机</button>
      <select id="presetSelect"><option value="">📌 预设图案...</option>${Object.keys(PRESETS).map(n=>`<option value="${n}">${n}</option>`).join('')}</select>
      <label>速度 <input type="range" id="speedSlider" min="10" max="300" value="${310-speed}"/> </label>
    </div>
    <div class="stats">代数: ${generation} | 存活: ${countAlive()}</div>
    <canvas id="cv" width="${W}" height="${H}"></canvas>
  `;

  document.getElementById('playBtn')!.addEventListener('click', togglePlay);
  document.getElementById('stepBtn')!.addEventListener('click', () => { step(); drawGrid(); render(); });
  document.getElementById('clearBtn')!.addEventListener('click', () => { grid = Array.from({length:ROWS},()=>new Uint8Array(COLS)); generation=0; stopTimer(); drawGrid(); render(); });
  document.getElementById('randomBtn')!.addEventListener('click', () => { grid = Array.from({length:ROWS},()=>Uint8Array.from({length:COLS},()=>Math.random()>0.7?1:0)); generation=0; drawGrid(); render(); });
  document.getElementById('presetSelect')!.addEventListener('change', e => {
    const name = (e.target as HTMLSelectElement).value;
    if (!name) return;
    grid = Array.from({length:ROWS},()=>new Uint8Array(COLS));
    const pts = PRESETS[name];
    const ox = Math.floor(COLS/2) - 15, oy = Math.floor(ROWS/2) - 5;
    for (const [x,y] of pts) { if (oy+y<ROWS && ox+x<COLS) grid[oy+y][ox+x] = 1; }
    generation = 0;
    drawGrid(); render();
  });
  document.getElementById('speedSlider')!.addEventListener('input', e => {
    speed = 310 - +(e.target as HTMLInputElement).value;
    if (running) { stopTimer(); startTimer(); }
  });

  const cv = document.getElementById('cv') as HTMLCanvasElement;
  let drawing = false;
  cv.addEventListener('pointerdown', e => { drawing = true; paint(e); });
  cv.addEventListener('pointermove', e => { if (drawing) paint(e); });
  cv.addEventListener('pointerup', () => { drawing = false; });
  cv.addEventListener('pointerleave', () => { drawing = false; });

  drawGrid();
}

function paint(e: MouseEvent) {
  const cv = document.getElementById('cv') as HTMLCanvasElement;
  const rect = cv.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / (rect.width / COLS));
  const y = Math.floor((e.clientY - rect.top) / (rect.height / ROWS));
  if (x >= 0 && x < COLS && y >= 0 && y < ROWS) { grid[y][x] = grid[y][x] ? 0 : 1; drawGrid(); }
}

function step() {
  const next = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ny = (y + dy + ROWS) % ROWS, nx = (x + dx + COLS) % COLS;
        n += grid[ny][nx];
      }
      if (grid[y][x]) next[y][x] = (n === 2 || n === 3) ? 1 : 0;
      else next[y][x] = n === 3 ? 1 : 0;
    }
  }
  grid = next;
  generation++;
}

function drawGrid() {
  const cv = document.getElementById('cv') as HTMLCanvasElement;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (grid[y][x]) {
      // Color by age approximation (neighbors)
      ctx.fillStyle = '#3fb950';
      ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
    }
  }
  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i*CELL,0); ctx.lineTo(i*CELL,H); ctx.stroke(); }
  for (let i = 0; i <= ROWS; i++) { ctx.beginPath(); ctx.moveTo(0,i*CELL); ctx.lineTo(W,i*CELL); ctx.stroke(); }
}

function countAlive(): number {
  let c = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) c += grid[y][x];
  return c;
}

function togglePlay() {
  running = !running;
  if (running) startTimer(); else stopTimer();
  render();
}

function startTimer() {
  timer = setInterval(() => { step(); drawGrid(); }, speed);
}
function stopTimer() {
  if (timer) { clearInterval(timer); timer = null; }
}

render();
