const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const info = document.getElementById('info')!;

let W: number, H: number;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; render(); }
resize();
addEventListener('resize', resize);

type FractalType = 'mandelbrot' | 'julia';
let fractalType: FractalType = 'mandelbrot';
let paletteIdx = 0;

// View parameters
let cx = -0.5; // center x (for mandelbrot) or 0 (for julia)
let cy = 0;    // center y
let zoom = 200; // pixels per unit
let maxIter = 100;

// Julia parameters (mouse-controlled)
let juliaCr = -0.7;
let juliaCi = 0.27;

// Color palettes - functions that map t (0-1) to RGB
function palette1(t: number): [number, number, number] {
  // Classic blue-gold
  const r = Math.floor(9 * (1 - t) * t * t * t * 255);
  const g = Math.floor(15 * (1 - t) * (1 - t) * t * t * 255);
  const b = Math.floor(8.5 * (1 - t) * (1 - t) * (1 - t) * t * 255);
  return [r, g, b];
}

function palette2(t: number): [number, number, number] {
  // Fire
  return [
    Math.floor(Math.min(255, t * 3 * 255)),
    Math.floor(Math.max(0, Math.min(255, (t - 0.33) * 3 * 255))),
    Math.floor(Math.max(0, Math.min(255, (t - 0.66) * 3 * 255))),
  ];
}

function palette3(t: number): [number, number, number] {
  // Ice blue
  const r = Math.floor(t * 100);
  const g = Math.floor(100 + t * 155);
  const b = Math.floor(155 + t * 100);
  return [r, g, b];
}

function palette4(t: number): [number, number, number] {
  // Rainbow
  const h = t * 360;
  const s = 0.8, l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; }
  else if (h < 120) { r1 = x; g1 = c; }
  else if (h < 180) { g1 = c; b1 = x; }
  else if (h < 240) { g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  return [Math.floor((r1 + m) * 255), Math.floor((g1 + m) * 255), Math.floor((b1 + m) * 255)];
}

const palettes = [palette1, palette2, palette3, palette4];

// Use workers for parallel rendering
function render() {
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;
  const pal = palettes[paletteIdx];
  const zoomShift = Math.log2(zoom / 200) * 0.1; // color shift with zoom

  // Adjust max iterations based on zoom
  maxIter = Math.min(1000, Math.max(50, Math.floor(100 + Math.log2(zoom / 200) * 20)));

  const xmin = cx - W / (2 * zoom);
  const ymin = cy - H / (2 * zoom);
  const dx = 1 / zoom;
  const dy = 1 / zoom;

  for (let py = 0; py < H; py++) {
    const ci = ymin + py * dy;
    for (let px = 0; px < W; px++) {
      const cr = xmin + px * dx;

      let zr: number, zi: number;
      if (fractalType === 'mandelbrot') {
        zr = 0; zi = 0;
        // Cardioid / bulb check
        const q = (cr - 0.25) * (cr - 0.25) + ci * ci;
        if (q * (q + (cr - 0.25)) <= 0.25 * ci * ci ||
            (cr + 1) * (cr + 1) + ci * ci <= 0.0625) {
          const idx = (py * W + px) * 4;
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 255;
          continue;
        }
        zr = 0; zi = 0;
      } else {
        zr = cr; zi = ci;
      }

      // Escape time
      let iter = 0;
      let zr2 = zr * zr, zi2 = zi * zi;
      const juliaCr2 = fractalType === 'julia' ? juliaCr : cr;
      const juliaCi2 = fractalType === 'julia' ? juliaCi : ci;

      while (zr2 + zi2 < 4 && iter < maxIter) {
        zi = 2 * zr * zi + juliaCi2;
        zr = zr2 - zi2 + juliaCr2;
        zr2 = zr * zr;
        zi2 = zi * zi;
        iter++;
      }

      const idx = (py * W + px) * 4;
      if (iter === maxIter) {
        data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0;
      } else {
        // Smooth coloring
        const smooth = iter + 1 - Math.log2(Math.log2(zr2 + zi2));
        const t = ((smooth / maxIter + zoomShift) % 1 + 1) % 1;
        const [r, g, b] = pal(t);
        data[idx] = r; data[idx + 1] = g; data[idx + 2] = b;
      }
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  info.textContent = `滚轮缩放 | 拖拽平移 | 缩放: ${(zoom / 200).toFixed(1)}x | 迭代: ${maxIter} | 中心: (${cx.toFixed(6)}, ${cy.toFixed(6)})`;
}

// Drag
let dragging = false;
let dragStartX = 0, dragStartY = 0;
let dragCx = 0, dragCy = 0;

canvas.addEventListener('pointerdown', e => {
  dragging = true;
  dragStartX = e.clientX; dragStartY = e.clientY;
  dragCx = cx; dragCy = cy;
});
canvas.addEventListener('pointermove', e => {
  if (dragging) {
    cx = dragCx - (e.clientX - dragStartX) / zoom;
    cy = dragCy - (e.clientY - dragStartY) / zoom;
    render();
  }
  // Julia: update c from mouse
  if (fractalType === 'julia' && !dragging) {
    juliaCr = (e.clientX / W - 0.5) * 2;
    juliaCi = (e.clientY / H - 0.5) * 2;
    render();
  }
});
canvas.addEventListener('pointerup', () => { dragging = false; });

// Zoom
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const mx = e.clientX, my = e.clientY;
  // Zoom toward mouse position
  const worldX = cx + (mx - W / 2) / zoom;
  const worldY = cy + (my - H / 2) / zoom;

  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  zoom *= factor;

  // Keep mouse position stable
  cx = worldX - (mx - W / 2) / zoom;
  cy = worldY - (my - H / 2) / zoom;

  render();
}, { passive: false });

// UI
document.querySelectorAll('[data-f]').forEach(el => {
  el.addEventListener('click', () => {
    fractalType = (el as HTMLElement).dataset.f as FractalType;
    document.querySelectorAll('[data-f]').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    if (fractalType === 'mandelbrot') { cx = -0.5; cy = 0; }
    else { cx = 0; cy = 0; }
    zoom = 200;
    render();
  });
});

document.querySelectorAll('[data-p]').forEach(el => {
  el.addEventListener('click', () => {
    paletteIdx = +(el as HTMLElement).dataset.p!;
    render();
  });
});

document.getElementById('resetBtn')!.addEventListener('click', () => {
  cx = fractalType === 'mandelbrot' ? -0.5 : 0;
  cy = 0; zoom = 200;
  render();
});

render();
