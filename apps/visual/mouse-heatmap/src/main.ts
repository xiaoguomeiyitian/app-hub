import './style.css';

const trail: { x: number; y: number }[] = [];
let W: number, H: number;

const app = document.getElementById('app')!;
app.innerHTML = `
  <div id="ui">
    <h1>🔥 鼠标热力图</h1>
    <button class="btn" id="clearBtn">🗑️ 清除</button>
    <button class="btn" id="exportBtn">💾 导出图片</button>
  </div>
  <canvas id="trail-canvas"></canvas>
  <canvas id="heatmap"></canvas>
  <div class="stats" id="stats">移动鼠标开始记录...</div>
`;

const trailCanvas = document.getElementById('trail-canvas') as HTMLCanvasElement;
const heatCanvas = document.getElementById('heatmap') as HTMLCanvasElement;
const trailCtx = trailCanvas.getContext('2d')!;
const heatCtx = heatCanvas.getContext('2d')!;
const stats = document.getElementById('stats')!;

function resize() {
  W = innerWidth; H = innerHeight;
  trailCanvas.width = W; trailCanvas.height = H;
  heatCanvas.width = W; heatCanvas.height = H;
  redraw();
}
resize();
addEventListener('resize', resize);

let lastX = -1, lastY = -1;

document.addEventListener('mousemove', e => {
  const x = e.clientX, y = e.clientY;
  if (Math.abs(x - lastX) < 3 && Math.abs(y - lastY) < 3) return;
  lastX = x; lastY = y;
  trail.push({ x, y });
  if (trail.length > 10000) trail.shift();
  stats.textContent = `记录点: ${trail.length} | 移动距离: ${calcDist()}px`;
  drawTrail(x, y);
  updateHeatmap();
});

function drawTrail(x: number, y: number) {
  trailCtx.beginPath(); trailCtx.arc(x, y, 2, 0, Math.PI * 2);
  trailCtx.fillStyle = 'rgba(88,166,255,0.5)'; trailCtx.fill();
}

function updateHeatmap() {
  heatCtx.clearRect(0, 0, W, H);

  // Build grid
  const cellSize = 20;
  const cols = Math.ceil(W / cellSize);
  const rows = Math.ceil(H / cellSize);
  const grid = new Float32Array(cols * rows);

  for (const p of trail) {
    const gx = Math.floor(p.x / cellSize);
    const gy = Math.floor(p.y / cellSize);
    // Spread to neighbors
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx, ny = gy + dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          grid[ny * cols + nx] += 1 / (1 + dist);
        }
      }
    }
  }

  // Find max
  let max = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i];
  if (max === 0) return;

  // Draw heatmap
  const imgData = heatCtx.createImageData(W, H);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const val = grid[gy * cols + gx] / max;
      if (val < 0.01) continue;
      const { r, g, b, a } = heatColor(val);
      for (let py = 0; py < cellSize && gy * cellSize + py < H; py++) {
        for (let px = 0; px < cellSize && gx * cellSize + px < W; px++) {
          const idx = ((gy * cellSize + py) * W + (gx * cellSize + px)) * 4;
          imgData.data[idx] = r; imgData.data[idx + 1] = g;
          imgData.data[idx + 2] = b; imgData.data[idx + 3] = a;
        }
      }
    }
  }
  heatCtx.putImageData(imgData, 0, 0);
}

function heatColor(v: number): { r: number; g: number; b: number; a: number } {
  // blue -> cyan -> green -> yellow -> red
  const a = Math.min(255, Math.floor(v * 255 * 1.5));
  let r: number, g: number, b: number;
  if (v < 0.25) { r = 0; g = 0; b = Math.floor(255 * v * 4); }
  else if (v < 0.5) { r = 0; g = Math.floor(255 * (v - 0.25) * 4); b = 255 - Math.floor(255 * (v - 0.25) * 4); }
  else if (v < 0.75) { r = Math.floor(255 * (v - 0.5) * 4); g = 255; b = 0; }
  else { r = 255; g = 255 - Math.floor(255 * (v - 0.75) * 4); b = 0; }
  return { r, g, b, a };
}

function calcDist(): number {
  let d = 0;
  for (let i = 1; i < trail.length; i++) {
    d += Math.sqrt((trail[i].x - trail[i - 1].x) ** 2 + (trail[i].y - trail[i - 1].y) ** 2);
  }
  return Math.floor(d);
}

function redraw() {
  trailCtx.clearRect(0, 0, W, H);
  for (const p of trail) { trailCtx.beginPath(); trailCtx.arc(p.x, p.y, 2, 0, Math.PI * 2); trailCtx.fillStyle = 'rgba(88,166,255,0.5)'; trailCtx.fill(); }
  updateHeatmap();
}

document.getElementById('clearBtn')!.addEventListener('click', () => {
  trail.length = 0; trailCtx.clearRect(0, 0, W, H); heatCtx.clearRect(0, 0, W, H);
  stats.textContent = '已清除';
});

document.getElementById('exportBtn')!.addEventListener('click', () => {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(heatCanvas, 0, 0);
  c.toBlob(b => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = `heatmap-${Date.now()}.png`; a.click();
    URL.revokeObjectURL(url);
  });
});
