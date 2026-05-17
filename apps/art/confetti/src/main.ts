import '@app-hub/utils/theme/variables.css';
import { exportCanvas } from '@app-hub/utils/export';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W: number, H: number;

function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize();
addEventListener('resize', resize);

// 控制面板 UI
const panel = document.createElement('div');
panel.style.cssText = 'position:fixed;top:10px;right:10px;background:rgba(255,255,255,0.9);padding:8px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;flex-direction:column;gap:6px;z-index:999';
['shape-upload','logo-upload','export-btn'].forEach(id => {
  const el = document.createElement('input');
  if (id==='shape-upload') { (el as HTMLInputElement).type='file'; (el as HTMLInputElement).accept='image/svg+xml,image/png'; (el as HTMLInputElement).title='上传自定义形状';
    el.addEventListener('change', async (e) => { const f=(e.target as HTMLInputElement).files?.[0]; if(f){ const url=URL.createObjectURL(f); const img=new Image(); img.onload=()=>{ customShapeImage=img; }; img.src=url; } }); }
  else if (id==='logo-upload') { (el as HTMLInputElement).type='file'; (el as HTMLInputElement).accept='image/svg+xml,image/png'; (el as HTMLInputElement).title='上传 Logo';
    el.addEventListener('change', async (e) => { const f=(e.target as HTMLInputElement).files?.[0]; if(f){ const url=URL.createObjectURL(f); const img=new Image(); img.onload=()=>{ logoImage=img; }; img.src=url; } }); }
  else if (id==='export-btn') { el.id='export-btn'; (el as HTMLButtonElement).textContent='Export PNG';
    (el as HTMLButtonElement).style.cssText='padding:6px 12px;border:none;border-radius:4px;background:#646cff;color:white;cursor:pointer';
    el.addEventListener('click', async () => { await exportCanvas(canvas, 'png'); }); }
  panel.appendChild(el);
});
document.body.appendChild(panel);

const COLORS = ['#f85149','#58a6ff','#3fb950','#d29922','#bc8cff','#f778ba','#ffa657','#7ee787','#ffd700','#ff6b6b'];
type ShapeType = 'rect' | 'star' | 'circle' | 'custom';
const SHAPES: ShapeType[] = ['rect','star','circle'];

// 自定义形状图片（可选）
let customShapeImage: HTMLImageElement | null = null;
let logoImage: HTMLImageElement | null = null;

class Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; shape: ShapeType; size: number;
  rotation: number; rotSpeed: number; gravity = 0.15; life = 1;
  decay: number;

  constructor(x: number, y: number, burst: boolean) {
    this.x = x; this.y = y;
    this.vx = (Math.random() - .5) * (burst ? 16 : 8);
    this.vy = burst ? -(Math.random() * 12 + 4) : -(Math.random() * 6 + 2);
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.shape = customShapeImage ? 'custom' : SHAPES[Math.floor(Math.random() * SHAPES.length)];
    this.size = Math.random() * 8 + 4;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - .5) * .2;
    this.decay = .005 + Math.random() * .005;
  }

  update(): boolean {
    this.vy += this.gravity; this.x += this.vx; this.y += this.vy;
    this.vx *= .99; this.rotation += this.rotSpeed; this.life -= this.decay;
    return this.life > 0;
  }

  draw(c: CanvasRenderingContext2D) {
    c.save(); c.translate(this.x, this.y); c.rotate(this.rotation);
    c.globalAlpha = this.life; c.fillStyle = this.color;
    if (this.shape === 'rect') {
      c.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
    } else if (this.shape === 'star') {
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 - Math.PI / 2;
        const b = a + Math.PI / 5;
        c.lineTo(Math.cos(a) * this.size / 2, Math.sin(a) * this.size / 2);
        c.lineTo(Math.cos(b) * this.size / 2 * .4, Math.sin(b) * this.size / 2 * .4);
      }
      c.closePath(); c.fill();
    } else if (this.shape === 'circle') {
      c.beginPath(); c.arc(0, 0, this.size / 2, 0, Math.PI * 2); c.fill();
    } else if (this.shape === 'custom' && customShapeImage) {
      const s = this.size * 2;
      c.drawImage(customShapeImage, -s/2, -s/2, s, s);
    }
    c.restore();
  }
}

let particles: Particle[] = [];

function burst(x: number, y: number, n = 80) {
  for (let i = 0; i < n; i++) particles.push(new Particle(x, y, true));
}

function rain() { for (let i = 0; i < 5; i++) particles.push(new Particle(Math.random() * W, -10, false)); }

canvas.addEventListener('click', e => burst(e.clientX, e.clientY, 60));
document.getElementById('burst')!.addEventListener('click', () => {
  for (let i = 0; i < 5; i++) setTimeout(() => burst(Math.random() * W, Math.random() * H * .5 + H * .2, 100), i * 150);
});

let rainTimer = 0;
function animate() {
  ctx.clearRect(0, 0, W, H);
  particles = particles.filter(p => p.update());
  particles.forEach(p => p.draw(ctx));
  if (logoImage) {
    const size = 100;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(logoImage, W - size - 10, H - size - 10, size, size);
    ctx.globalAlpha = 1;
  }
  if (++rainTimer % 3 === 0) rain();
  requestAnimationFrame(animate);
}
animate();
