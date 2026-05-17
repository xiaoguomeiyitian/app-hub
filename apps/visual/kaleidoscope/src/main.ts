import './style.css';

const SIZE = Math.min(600, window.innerWidth - 48);
let segments = 6;
let color = '#e94560';
let drawing = false;
let lastX = 0, lastY = 0;

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1>🔮 万花筒</h1>
    <div class="toolbar">
      <button class="btn ${segments===3?'active':''}" data-s="3">3轴</button>
      <button class="btn ${segments===6?'active':''}" data-s="6">6轴</button>
      <button class="btn ${segments===8?'active':''}" data-s="8">8轴</button>
      <input type="color" class="color-pick" value="${color}" title="颜色"/>
      <button class="btn" id="clear">🗑️ 清空</button>
      <button class="btn" id="save">💾 保存壁纸</button>
    </div>
    <canvas id="cv" width="${SIZE}" height="${SIZE}"></canvas>
  `;

  document.querySelectorAll('[data-s]').forEach(el => {
    el.addEventListener('click', () => { segments = +(el as HTMLElement).dataset.s!; render(); });
  });
  (document.querySelector('.color-pick') as HTMLInputElement).addEventListener('input', e => { color = (e.target as HTMLInputElement).value; });
  document.getElementById('clear')!.addEventListener('click', () => { const c = document.getElementById('cv') as HTMLCanvasElement; c.getContext('2d')!.fillStyle='#0d1117'; c.getContext('2d')!.fillRect(0,0,SIZE,SIZE); });
  document.getElementById('save')!.addEventListener('click', saveWallpaper);

  const cv = document.getElementById('cv') as HTMLCanvasElement;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, SIZE, SIZE);

  cv.addEventListener('pointerdown', e => { drawing = true; lastX = e.offsetX - SIZE/2; lastY = e.offsetY - SIZE/2; });
  cv.addEventListener('pointermove', e => {
    if (!drawing) return;
    const x = e.offsetX - SIZE/2, y = e.offsetY - SIZE/2;
    drawMirrored(ctx, lastX, lastY, x, y);
    lastX = x; lastY = y;
  });
  cv.addEventListener('pointerup', () => { drawing = false; });
  cv.addEventListener('pointerleave', () => { drawing = false; });
}

function drawMirrored(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const cx = SIZE / 2, cy = SIZE / 2;
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.globalAlpha = 0.8;
  const angleStep = (Math.PI * 2) / segments;
  for (let i = 0; i < segments; i++) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angleStep * i);
    // Draw line
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // Mirror
    ctx.scale(1, -1);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function saveWallpaper() {
  const cv = document.getElementById('cv') as HTMLCanvasElement;
  cv.toBlob(b => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = url; a.download = `kaleidoscope-${segments}x.png`; a.click();
    URL.revokeObjectURL(url);
  });
}

render();
