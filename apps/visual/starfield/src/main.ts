const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const speedDisp = document.getElementById('speedDisp')!;
let W: number, H: number;

function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize();
addEventListener('resize', resize);

interface Star { x: number; y: number; z: number; pz: number; color: string }
interface Constellation { stars: { x: number; y: number; z: number }[]; lines: [number, number][]; color: string }

let speed = 1;
const STAR_COUNT = 1200;
const stars: Star[] = [];
const constellations: Constellation[] = [];

function randomColor(): string {
  const colors = ['#ffffff','#aaccff','#ffddaa','#ffaaaa','#aaffcc','#ddaaff'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function initStars() {
  stars.length = 0;
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: (Math.random() - 0.5) * W * 2,
      y: (Math.random() - 0.5) * H * 2,
      z: Math.random() * 2000,
      pz: 0,
      color: randomColor(),
    });
  }
}

function generateConstellation(): Constellation {
  const cx = (Math.random() - 0.5) * W;
  const cy = (Math.random() - 0.5) * H;
  const cz = 300 + Math.random() * 1500;
  const count = 5 + Math.floor(Math.random() * 8);
  const pts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    pts.push({
      x: cx + (Math.random() - 0.5) * 200,
      y: cy + (Math.random() - 0.5) * 200,
      z: cz + (Math.random() - 0.5) * 100,
    });
  }
  // Connect sequentially + some random connections
  const lines: [number, number][] = [];
  for (let i = 0; i < count - 1; i++) lines.push([i, i + 1]);
  if (count > 3) lines.push([0, Math.floor(count / 2)]);

  const colors = ['#58a6ff','#bc8cff','#3fb950','#d29922','#f778ba','#7ee787'];
  return { stars: pts, lines, color: colors[Math.floor(Math.random() * colors.length)] };
}

function initConstellations() {
  constellations.length = 0;
  for (let i = 0; i < 8; i++) constellations.push(generateConstellation());
}

initStars();
initConstellations();

function project(x: number, y: number, z: number): { sx: number; sy: number; sz: number } {
  const fov = 300;
  const scale = fov / (fov + z);
  return { sx: x * scale + W / 2, sy: y * scale + H / 2, sz: scale };
}

function draw() {
  // Fade effect for trails at high speed
  ctx.fillStyle = speed > 3 ? `rgba(0,0,0,${Math.min(0.4, 0.8 - speed * 0.05)})` : 'rgba(0,0,0,1)';
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (const s of stars) {
    s.pz = s.z;
    s.z -= speed * 8;
    if (s.z < 1) { s.z = 2000; s.x = (Math.random() - 0.5) * W * 2; s.y = (Math.random() - 0.5) * H * 2; s.pz = s.z; }

    const p = project(s.x, s.y, s.z);
    const pp = project(s.x, s.y, s.pz);
    const size = Math.max(0.5, (1 - s.z / 2000) * 3);

    if (speed > 2) {
      // Draw streaks at high speed
      ctx.beginPath();
      ctx.moveTo(pp.sx, pp.sy);
      ctx.lineTo(p.sx, p.sy);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = size;
      ctx.globalAlpha = Math.min(1, (1 - s.z / 2000) * 1.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, size, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = Math.min(1, (1 - s.z / 2000) * 1.5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Constellations
  for (const c of constellations) {
    const projected = c.stars.map(s => {
      s.z -= speed * 8;
      return project(s.x, s.y, s.z);
    });

    // Draw lines
    if (projected.every(p => p.sz > 0.05)) {
      ctx.strokeStyle = c.color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      for (const [a, b] of c.lines) {
        ctx.beginPath();
        ctx.moveTo(projected[a].sx, projected[a].sy);
        ctx.lineTo(projected[b].sx, projected[b].sy);
        ctx.stroke();
      }
      // Draw dots
      for (const p of projected) {
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 2 * p.sz, 0, Math.PI * 2);
        ctx.fillStyle = c.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Reset if passed
    if (c.stars[0].z < 1) {
      const nc = generateConstellation();
      c.stars = nc.stars; c.lines = nc.lines; c.color = nc.color;
    }
  }

  speedDisp.textContent = `速度: ${speed.toFixed(1)}x`;
  requestAnimationFrame(draw);
}

draw();

// Scroll to change speed
addEventListener('wheel', e => {
  speed = Math.max(0.1, Math.min(20, speed + e.deltaY * 0.005));
});

// Screenshot
document.getElementById('saveBtn')!.addEventListener('click', () => {
  // Draw a clean frame
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    const p = project(s.x, s.y, s.z);
    const size = Math.max(0.5, (1 - s.z / 2000) * 3);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, size, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.globalAlpha = Math.min(1, (1 - s.z / 2000) * 1.5);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const c of constellations) {
    const projected = c.stars.map(s => project(s.x, s.y, s.z));
    if (projected.every(p => p.sz > 0.05)) {
      ctx.strokeStyle = c.color; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
      for (const [a, b] of c.lines) {
        ctx.beginPath(); ctx.moveTo(projected[a].sx, projected[a].sy);
        ctx.lineTo(projected[b].sx, projected[b].sy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  canvas.toBlob(b => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = url; a.download = `starfield-${Date.now()}.png`; a.click();
    URL.revokeObjectURL(url);
  });
});
