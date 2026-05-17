import './style.css';
import '@app-hub/utils/theme/variables.css';
import { Encoder } from 'modern-gif';

const W = 128;
const H = 128;

const COLORS = ['#000000','#ffffff','#ff0000','#ff6b6b','#ffa500','#ffd700','#ffff00','#3fb950','#00bfff','#58a6ff','#6c5ce7','#bc8cff','#ff69b4','#f85149','#8b949e','#21262d'];
let color = COLORS[0];
let tool: 'pen' | 'eraser' | 'fill' = 'pen';

const TOTAL_FRAMES = 24;
let currentFrame = 0;
let isPlaying = false;
let playInterval: number | null = null;

// frames: [frame][y][x]
const frames: string[][][] = Array.from({ length: TOTAL_FRAMES }, () =>
  Array.from({ length: H }, () => Array(W).fill(''))
);

function getGrid() { return frames[currentFrame]; }

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1>🎨 像素画板 (${W}×${H})</h1>
    <div class="frame-controls">
      <button class="btn" id="prev">⏮️</button>
      <span>帧 <input type="number" id="frame-num" min="1" max="${TOTAL_FRAMES}" value="1" style="width:40px"/> / ${TOTAL_FRAMES}</span>
      <button class="btn" id="next">⏭️</button>
      <button class="btn" id="add-frame">➕ 添加帧</button>
      <button class="btn" id="delete-frame">🗑️ 删除</button>
      <button class="btn" id="play">▶️ 播放</button>
      <button class="btn" id="export-gif">💾 GIF</button>
    </div>
    <div class="toolbar">
      <button class="btn ${tool==='pen'?'active':''}" data-t="pen">🖊️ 画笔</button>
      <button class="btn ${tool==='eraser'?'active':''}" data-t="eraser">🧹 橡皮</button>
      <button class="btn ${tool==='fill'?'active':''}" data-t="fill">🪣 填充</button>
      <button class="btn" id="clear">🗑️ 清空</button>
    </div>
    <div class="palette">${COLORS.map(c=>`<div class="swatch ${c===color?'active':''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div>
    <canvas id="cv" width="${W}" height="${H}"></canvas>
  `;

  // Toolbar
  document.querySelectorAll('[data-t]').forEach(el => el.addEventListener('click', () => { tool = (el as HTMLElement).dataset.t as any; render(); }));
  document.querySelectorAll('.swatch').forEach(el => el.addEventListener('click', () => { color = (el as HTMLElement).dataset.c!; tool='pen'; render(); }));
  document.getElementById('clear')!.addEventListener('click', () => { getGrid().forEach(row => row.fill('')); redraw(); });

  // Frame controls
  document.getElementById('prev')!.addEventListener('click', prevFrame);
  document.getElementById('next')!.addEventListener('click', nextFrame);
  document.getElementById('add-frame')!.addEventListener('click', addFrame);
  document.getElementById('delete-frame')!.addEventListener('click', deleteFrame);
  document.getElementById('play')!.addEventListener('click', togglePlay);
  document.getElementById('export-gif')!.addEventListener('click', exportGIF);
  const frameNumInput = document.getElementById('frame-num') as HTMLInputElement;
  frameNumInput.addEventListener('change', () => {
    let v = parseInt(frameNumInput.value, 10);
    if (v < 1) v = 1;
    if (v > TOTAL_FRAMES) v = TOTAL_FRAMES;
    currentFrame = v - 1;
    updateFrameUI();
    redraw();
  });

  const cv = document.getElementById('cv') as HTMLCanvasElement;
  let drawing = false;
  cv.addEventListener('pointerdown', e => {
    drawing = true;
    const rect = cv.getBoundingClientRect();
    const gx = Math.floor(((e as PointerEvent).clientX - rect.left) * (W / rect.width));
    const gy = Math.floor(((e as PointerEvent).clientY - rect.top) * (H / rect.height));
    apply(gx, gy);
  });
  cv.addEventListener('pointermove', e => {
    if (drawing) {
      const rect = cv.getBoundingClientRect();
      const gx = Math.floor(((e as PointerEvent).clientX - rect.left) * (W / rect.width));
      const gy = Math.floor(((e as PointerEvent).clientY - rect.top) * (H / rect.height));
      apply(gx, gy);
    }
  });
  cv.addEventListener('pointerup', () => { drawing = false; });
  cv.addEventListener('pointerleave', () => { drawing = false; });

  updateFrameUI();
  redraw();
}

function updateFrameUI() {
  const frameNumInput = document.getElementById('frame-num') as HTMLInputElement;
  if (frameNumInput) frameNumInput.value = (currentFrame + 1).toString();
}

function prevFrame() {
  if (currentFrame > 0) currentFrame--;
  updateFrameUI(); redraw();
}
function nextFrame() {
  if (currentFrame < TOTAL_FRAMES - 1) currentFrame++;
  updateFrameUI(); redraw();
}
function addFrame() {
  if (currentFrame < TOTAL_FRAMES - 1) {
    const newIdx = currentFrame + 1;
    frames[newIdx] = JSON.parse(JSON.stringify(frames[currentFrame]));
    currentFrame = newIdx;
  } else {
    alert('已经是最后一帧，无法添加');
    return;
  }
  updateFrameUI(); redraw();
}
function deleteFrame() {
  getGrid().forEach(row => row.fill(''));
  redraw();
}
function togglePlay() {
  if (isPlaying) stopPlay();
  else startPlay();
}
function startPlay() {
  if (currentFrame === TOTAL_FRAMES - 1) currentFrame = -1;
  isPlaying = true;
  playInterval = window.setInterval(() => {
    currentFrame = (currentFrame + 1) % TOTAL_FRAMES;
    updateFrameUI(); redraw();
  }, 100);
  const btn = document.getElementById('play') as HTMLButtonElement;
  if (btn) btn.textContent = '⏸️ 暂停';
}
function stopPlay() {
  isPlaying = false;
  if (playInterval !== null) clearInterval(playInterval);
  const btn = document.getElementById('play') as HTMLButtonElement;
  if (btn) btn.textContent = '▶️ 播放';
}

function apply(gx: number, gy: number) {
  if (gx < 0 || gx >= W || gy < 0 || gy >= H) return;
  const grid = getGrid();
  if (tool === 'fill') {
    floodFill(gx, gy, grid[gy][gx], color);
    redraw();
    return;
  }
  grid[gy][gx] = tool === 'eraser' ? '' : color;
  redraw();
}

function floodFill(x: number, y: number, target: string, replacement: string) {
  if (target === replacement) return;
  const grid = getGrid();
  const stack: [number, number][] = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
    if (grid[cy][cx] !== target) continue;
    grid[cy][cx] = replacement;
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
}

function redraw() {
  const cv = document.getElementById('cv') as HTMLCanvasElement;
  const ctx = cv.getContext('2d')!;
  const grid = getGrid();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = grid[y][x];
      if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
    }
  }
}

async function exportGIF() {
  const encoder = new Encoder({ width: W, height: H });
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const octx = off.getContext('2d')!;
    const frame = frames[i];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame[y][x];
        if (c) { octx.fillStyle = c; octx.fillRect(x, y, 1, 1); }
      }
    }
    await encoder.encode({ data: off });
  }
  const blob = await encoder.flush('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pixel-art.gif';
  a.click();
  URL.revokeObjectURL(url);
}

render();