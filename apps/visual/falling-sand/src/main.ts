import './style.css';

type Material = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
const EMPTY: Material = 0;
const SAND: Material = 1;
const WATER: Material = 2;
const OIL: Material = 3;
const FIRE: Material = 4;
const LAVA: Material = 5;
const STONE: Material = 6;
const WOOD: Material = 7;
const STEAM: Material = 8;
const GLASS: Material = 9;

interface MatDef { name: string; color: string; bg: string }

const MATS: Record<Material, MatDef> = {
  [EMPTY]: { name: '橡皮', color: '#0d1117', bg: '#161b22' },
  [SAND]:  { name: '沙子', color: '#d2a65a', bg: '#b8923e' },
  [WATER]: { name: '水', color: '#4488ff', bg: '#2266dd' },
  [OIL]:   { name: '油', color: '#8b6914', bg: '#6d5210' },
  [FIRE]:  { name: '火', color: '#ff4400', bg: '#ff8800' },
  [LAVA]:  { name: '岩浆', color: '#ff2200', bg: '#cc0000' },
  [STONE]: { name: '石头', color: '#666666', bg: '#555555' },
  [WOOD]:  { name: '木头', color: '#8b5e3c', bg: '#6d4a2f' },
  [STEAM]: { name: '蒸汽', color: '#aaccee', bg: '#8899aa' },
  [GLASS]: { name: '玻璃', color: '#88ccdd', bg: '#66aabb' },
};

const W = 200;
const H = 140;
const CELL = Math.min(4, Math.floor((window.innerWidth - 32) / W));
const CW = W * CELL;
const CH = H * CELL;

let grid: Material[][] = Array.from({ length: H }, () => new Uint8Array(W) as unknown as Material[]);
let ages: number[][] = Array.from({ length: H }, () => new Int16Array(W) as unknown as number[]);
let brush: Material = SAND;
let brushSize = 3;
let drawing = false;
let running = true;

// Color variation for realism
function cellColor(m: Material, x: number, y: number): string {
  const base = MATS[m].color;
  const v = ((x * 7 + y * 13 + ages[y][x] * 3) % 30) - 15;
  return shiftColor(base, v);
}

function shiftColor(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return `rgb(${r},${g},${b})`;
}

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1>🏖️ 沙粒模拟器</h1>
    <div class="toolbar">
      ${(Object.keys(MATS) as unknown as Material[]).map(m => {
        const d = MATS[m];
        return `<button class="mat-btn ${brush===m?'active':''}" data-m="${m}" style="background:${d.color}">${d.name}</button>`;
      }).join('')}
      <label>大小 <input type="range" id="sizeSlider" min="1" max="10" value="${brushSize}"/></label>
      <button class="btn" id="clearBtn">🗑️ 清空</button>
      <button class="btn" id="pauseBtn">${running?'⏸ 暂停':'▶️ 运行'}</button>
    </div>
    <canvas id="cv" width="${CW}" height="${CH}"></canvas>
  `;

  document.querySelectorAll('.mat-btn').forEach(el => {
    el.addEventListener('click', () => { brush = +(el as HTMLElement).dataset.m! as Material; render(); });
  });
  document.getElementById('sizeSlider')!.addEventListener('input', e => { brushSize = +(e.target as HTMLInputElement).value; });
  document.getElementById('clearBtn')!.addEventListener('click', () => { grid = Array.from({length:H},()=>new Uint8Array(W) as unknown as Material[]); ages = Array.from({length:H},()=>new Int16Array(W) as unknown as number[]); });
  document.getElementById('pauseBtn')!.addEventListener('click', () => { running = !running; render(); });

  const cv = document.getElementById('cv') as HTMLCanvasElement;
  cv.addEventListener('pointerdown', e => { drawing = true; paint(e); });
  cv.addEventListener('pointermove', e => { if (drawing) paint(e); });
  cv.addEventListener('pointerup', () => { drawing = false; });
  cv.addEventListener('pointerleave', () => { drawing = false; });
}

function paint(e: PointerEvent) {
  const cv = document.getElementById('cv') as HTMLCanvasElement;
  const rect = cv.getBoundingClientRect();
  const scaleX = CW / rect.width, scaleY = CH / rect.height;
  const gx = Math.floor((e.clientX - rect.left) * scaleX / CELL);
  const gy = Math.floor((e.clientY - rect.top) * scaleY / CELL);
  for (let dy = -brushSize; dy <= brushSize; dy++) {
    for (let dx = -brushSize; dx <= brushSize; dx++) {
      if (dx * dx + dy * dy > brushSize * brushSize) continue;
      const nx = gx + dx, ny = gy + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
        if (grid[ny][nx] === EMPTY || brush === EMPTY) {
          grid[ny][nx] = brush;
          ages[ny][nx] = 0;
        }
      }
    }
  }
}

function inBounds(x: number, y: number): boolean { return x >= 0 && x < W && y >= 0 && y < H; }
function get(x: number, y: number): Material { return inBounds(x, y) ? grid[y][x] : STONE; }
function set(x: number, y: number, m: Material) { if (inBounds(x, y)) { grid[y][x] = m; ages[y][x] = 0; } }
function swap(x1: number, y1: number, x2: number, y2: number) {
  const tmp = grid[y1][x1]; grid[y1][x1] = grid[y2][x2]; grid[y2][x2] = tmp;
  const ta = ages[y1][x1]; ages[y1][x1] = ages[y2][x2]; ages[y2][x2] = ta;
}

function isLiquid(m: Material): boolean { return m === WATER || m === OIL || m === STEAM; }
function isGas(m: Material): boolean { return m === FIRE || m === STEAM; }

function simulate() {
  // Bottom-up, alternating left-right to avoid bias
  for (let y = H - 1; y >= 0; y--) {
    const leftToRight = Math.random() > 0.5;
    for (let i = 0; i < W; i++) {
      const x = leftToRight ? i : W - 1 - i;
      const m = grid[y][x];
      if (m === EMPTY || m === STONE || m === GLASS) continue;
      ages[y][x]++;

      // Interactions
      handleInteractions(x, y, m);

      // Movement
      if (m === SAND) movePowder(x, y);
      else if (m === WATER) moveLiquid(x, y);
      else if (m === OIL) moveLiquid(x, y, true);
      else if (m === FIRE) moveFire(x, y);
      else if (m === LAVA) moveLava(x, y);
      else if (m === STEAM) moveSteam(x, y);
      else if (m === WOOD) { /* static, but can burn */ }
    }
  }
}

function handleInteractions(x: number, y: number, m: Material) {
  const neighbors = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]];

  for (const [dx, dy] of neighbors) {
    const nx = x + dx, ny = y + dy;
    if (!inBounds(nx, ny)) continue;
    const other = grid[ny][nx];

    // Lava + Water = Stone + Steam
    if (m === LAVA && other === WATER) { set(x, y, STONE); set(nx, ny, STEAM); return; }
    // Fire + Water = Steam
    if (m === FIRE && other === WATER) { set(x, y, EMPTY); set(nx, ny, STEAM); return; }
    // Fire + Wood = Fire (spreads)
    if (m === FIRE && other === WOOD) { if (Math.random() < 0.05) set(nx, ny, FIRE); }
    // Fire + Oil = Fire
    if (m === FIRE && other === OIL) { if (Math.random() < 0.3) set(nx, ny, FIRE); }
    // Lava + Wood = Fire
    if (m === LAVA && other === WOOD) { if (Math.random() < 0.03) set(nx, ny, FIRE); }
    // Lava + Sand = Glass
    if (m === LAVA && other === SAND) { if (Math.random() < 0.02) set(nx, ny, GLASS); }
    // Fire dies out
    if (m === FIRE) { if (Math.random() < 0.02) set(x, y, EMPTY); }
  }
}

function movePowder(x: number, y: number) {
  if (get(x, y + 1) === EMPTY || isLiquid(get(x, y + 1))) { swap(x, y, x, y + 1); }
  else {
    const dir = Math.random() > 0.5 ? 1 : -1;
    if (get(x + dir, y + 1) === EMPTY || isLiquid(get(x + dir, y + 1))) { swap(x, y, x + dir, y + 1); }
    else if (get(x - dir, y + 1) === EMPTY || isLiquid(get(x - dir, y + 1))) { swap(x, y, x - dir, y + 1); }
  }
}

function moveLiquid(x: number, y: number, isOil = false) {
  const below = get(x, y + 1);
  const density = isOil ? 1 : 2; // Oil is lighter

  // Fall down (oil floats on water)
  if (below === EMPTY) { swap(x, y, x, y + 1); return; }
  if (!isOil && below === OIL) { swap(x, y, x, y + 1); return; } // Water sinks through oil

  // Fall diagonal
  const dir = Math.random() > 0.5 ? 1 : -1;
  if (get(x + dir, y + 1) === EMPTY) { swap(x, y, x + dir, y + 1); return; }
  if (get(x - dir, y + 1) === EMPTY) { swap(x, y, x - dir, y + 1); return; }

  // Flow sideways
  const spread = 3 + Math.floor(Math.random() * 3);
  for (let i = 1; i <= spread; i++) {
    if (get(x + dir * i, y) === EMPTY) { swap(x, y, x + dir * i, y); return; }
    if (get(x + dir * i, y) !== get(x, y)) break;
  }
  for (let i = 1; i <= spread; i++) {
    if (get(x - dir * i, y) === EMPTY) { swap(x, y, x - dir * i, y); return; }
    if (get(x - dir * i, y) !== get(x, y)) break;
  }
}

function moveFire(x: number, y: number) {
  // Rise up
  if (get(x, y - 1) === EMPTY) { swap(x, y, x, y - 1); }
  else {
    const dir = Math.random() > 0.5 ? 1 : -1;
    if (get(x + dir, y - 1) === EMPTY) swap(x, y, x + dir, y - 1);
    else if (get(x - dir, y - 1) === EMPTY) swap(x, y, x - dir, y - 1);
    else if (get(x + dir, y) === EMPTY) swap(x, y, x + dir, y);
  }
}

function moveLava(x: number, y: number) {
  // Like very slow powder
  if (Math.random() > 0.1) return; // Very slow
  if (get(x, y + 1) === EMPTY) { swap(x, y, x, y + 1); }
  else {
    const dir = Math.random() > 0.5 ? 1 : -1;
    if (get(x + dir, y) === EMPTY) swap(x, y, x + dir, y);
    else if (get(x - dir, y) === EMPTY) swap(x, y, x - dir, y);
  }
}

function moveSteam(x: number, y: number) {
  // Rises and dissipates
  if (Math.random() < 0.005) { set(x, y, EMPTY); return; }
  if (get(x, y - 1) === EMPTY) { swap(x, y, x, y - 1); }
  else {
    const dir = Math.random() > 0.5 ? 1 : -1;
    if (get(x + dir, y - 1) === EMPTY) swap(x, y, x + dir, y - 1);
    else if (get(x + dir, y) === EMPTY) swap(x, y, x + dir, y);
  }
}

// Draw loop
const cv = document.createElement('canvas');
cv.width = CW; cv.height = CH;

function draw() {
  const ctx2 = cv.getContext('2d')!;
  ctx2.fillStyle = '#0d1117';
  ctx2.fillRect(0, 0, CW, CH);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = grid[y][x];
      if (m === EMPTY) continue;
      ctx2.fillStyle = cellColor(m, x, y);
      ctx2.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  const display = document.getElementById('cv') as HTMLCanvasElement;
  if (display) {
    const dctx = display.getContext('2d')!;
    dctx.drawImage(cv, 0, 0);
  }

  if (running) simulate();
  requestAnimationFrame(draw);
}

render();
draw();
