const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W: number, H: number;

type Mode = 'rain' | 'storm' | 'snow';
let mode: Mode = 'rain';

function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize();
addEventListener('resize', resize);

// Ripple
interface Ripple { x: number; y: number; r: number; maxR: number; alpha: number }
const ripples: Ripple[] = [];

canvas.addEventListener('click', e => {
  const count = mode === 'storm' ? 5 : 2;
  for (let i = 0; i < count; i++) {
    ripples.push({ x: e.clientX + (Math.random()-.0)*30, y: e.clientY + (Math.random()-.0)*30, r: 0, maxR: 40 + Math.random() * 40, alpha: 1 });
  }
});

canvas.addEventListener('pointermove', e => {
  if (Math.random() > 0.85) {
    ripples.push({ x: e.clientX, y: e.clientY, r: 0, maxR: 20 + Math.random() * 20, alpha: 0.6 });
  }
});

// Drops
interface Drop { x: number; y: number; vy: number; len: number; alpha: number }
let drops: Drop[] = [];

function spawnDrop() {
  const speed = mode === 'storm' ? 18 : mode === 'snow' ? 1.5 : 8;
  const len = mode === 'snow' ? 0 : mode === 'storm' ? 20 : 12;
  drops.push({ x: Math.random() * W, y: -10, vy: speed + Math.random() * speed * 0.5, len, alpha: 0.3 + Math.random() * 0.5 });
}

function draw() {
  ctx.fillStyle = 'rgba(10, 10, 26, 0.15)';
  ctx.fillRect(0, 0, W, H);

  const spawnRate = mode === 'storm' ? 12 : mode === 'snow' ? 4 : 3;
  for (let i = 0; i < spawnRate; i++) spawnDrop();

  // Draw drops
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    if (mode === 'snow') {
      d.x += Math.sin(d.y * 0.02) * 0.5;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220,230,255,${d.alpha})`;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + 0.5, d.y - d.len);
      ctx.strokeStyle = `rgba(120,160,220,${d.alpha})`;
      ctx.lineWidth = mode === 'storm' ? 1.5 : 1;
      ctx.stroke();
    }
    d.y += d.vy;
    if (d.y > H + 10) drops.splice(i, 1);
  }

  // Draw ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.r, r.r * 0.4, 0, 0, Math.PI * 2);
    ctx.strokeStyle = mode === 'snow' ? `rgba(200,220,255,${r.alpha})` : `rgba(100,150,220,${r.alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    r.r += 2;
    r.alpha -= 0.015;
    if (r.alpha <= 0 || r.r > r.maxR) ripples.splice(i, 1);
  }

  // Water surface indicator at bottom
  const waterY = H - 4;
  ctx.fillStyle = mode === 'snow' ? 'rgba(200,220,255,0.1)' : 'rgba(80,130,200,0.15)';
  ctx.fillRect(0, waterY, W, 4);

  requestAnimationFrame(draw);
}

draw();

// Mode buttons
document.querySelectorAll('[data-m]').forEach(el => {
  el.addEventListener('click', () => {
    mode = (el as HTMLElement).dataset.m as Mode;
    document.querySelectorAll('[data-m]').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    drops = [];
  });
});
