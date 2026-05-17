const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W: number = 0;
let H: number = 0;

function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize();
addEventListener('resize', resize);

interface Point { x: number; y: number; color: string; vx?: number; vy?: number }

let points: Point[] = [];
let density = 8;
let animId = 0;

const PALETTES = [
  ['#e94560','#533483','#0f3460','#16213e'],
  ['#2d6a4f','#40916c','#52b788','#74c69d'],
  ['#ff006e','#8338ec','#3a86ff','#fb5607'],
  ['#03071e','#370617','#6a040f','#9d0208','#dc2f02','#ffba08'],
  ['#606c38','#283618','#fefae0','#dda15e','#bc6c25'],
  ['#264653','#2a9d8f','#e9c46a','#f4a261','#e76f51'],
  ['#f72585','#7209b7','#3a0ca3','#4361ee','#4cc9f0'],
];
let palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];

function randomColor(): string {
  return palette[Math.floor(Math.random() * palette.length)];
}

function generatePoints(x: number, y: number) {
  const count = density;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * 40;
    points.push({
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      color: randomColor(),
    });
  }
}

function shatter(x: number, y: number) {
  const count = 12 + Math.floor(Math.random() * 15);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 3 + Math.random() * 8;
    points.push({
      x, y,
      color: randomColor(),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });
  }
}

// Voronoi rendering using nearest-point approach
function renderVoronoi() {
  // For performance, use a coarse grid then fill
  const cellSize = 6;
  const cols = Math.ceil(W / cellSize);
  const rows = Math.ceil(H / cellSize);

  // For each grid cell, find nearest point
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const px = gx * cellSize + cellSize / 2;
      const py = gy * cellSize + cellSize / 2;

      let minDist = Infinity;
      let minIdx = 0;
      let secondDist = Infinity;

      for (let i = 0; i < points.length; i++) {
        const dx = px - points[i].x;
        const dy = py - points[i].y;
        const d = dx * dx + dy * dy;
        if (d < minDist) {
          secondDist = minDist;
          minDist = d;
          minIdx = i;
        } else if (d < secondDist) {
          secondDist = d;
        }
      }

      // Parse color
      const hex = points[minIdx]?.color ?? '#16213e';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);

      // Edge detection: draw lines between cells
      const edgeDist = Math.sqrt(secondDist) - Math.sqrt(minDist);
      const isEdge = edgeDist < 3;

      for (let py2 = 0; py2 < cellSize && gy * cellSize + py2 < H; py2++) {
        for (let px2 = 0; px2 < cellSize && gx * cellSize + px2 < W; px2++) {
          const idx = ((gy * cellSize + py2) * W + (gx * cellSize + px2)) * 4;
          if (isEdge) {
            data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255;
            data[idx + 3] = 180;
          } else {
            // Slight gradient based on distance to center
            const cx2 = gx * cellSize + px2 - points[minIdx].x;
            const cy2 = gy * cellSize + py2 - points[minIdx].y;
            const dist = Math.sqrt(cx2 * cx2 + cy2 * cy2);
            const factor = Math.max(0.4, 1 - dist / 300);
            data[idx] = Math.floor(r * factor);
            data[idx + 1] = Math.floor(g * factor);
            data[idx + 2] = Math.floor(b * factor);
            data[idx + 3] = 255;
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw point centers
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}

function updatePhysics() {
  let needsRedraw = false;
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p.vx !== undefined && p.vy !== undefined) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.vy += 0.1; // gravity
      if (p.x < -50 || p.x > W + 50 || p.y > H + 50) {
        points.splice(i, 1);
      }
      needsRedraw = true;
    }
  }
  return needsRedraw;
}

function animate() {
  const moved = updatePhysics();
  if (moved || points.length > 0) {
    renderVoronoi();
  }
  animId = requestAnimationFrame(animate);
}

// Mouse tracking - add points with throttling
let lastAdd = 0;
canvas.addEventListener('pointermove', e => {
  const now = Date.now();
  if (now - lastAdd < 50) return;
  lastAdd = now;
  generatePoints(e.clientX, e.clientY);
  renderVoronoi();
});

canvas.addEventListener('click', e => {
  shatter(e.clientX, e.clientY);
});

document.getElementById('clearBtn')!.addEventListener('click', () => {
  points = [];
  palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);
});

document.getElementById('exportBtn')!.addEventListener('click', () => {
  renderVoronoi();
  canvas.toBlob(b => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = `voronoi-${Date.now()}.png`; a.click();
    URL.revokeObjectURL(url);
  });
});

(document.getElementById('densitySlider') as HTMLInputElement).addEventListener('input', e => {
  density = +(e.target as HTMLInputElement).value;
});

// Initial render
ctx.fillStyle = '#0a0a1a';
ctx.fillRect(0, 0, W, H);
animate();
