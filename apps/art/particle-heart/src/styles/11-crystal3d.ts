/**
 * 11. 立体水晶爱心
 */
import { generateHeart3D } from '../heart-utils.js';
import { heartPoint } from '../heart-utils.js';

interface Crystal3DParticle {
  x: number; y: number; z: number;
  size: number; isOutline: boolean;
  hue: number;
}

export class Crystal3DStyle {
  private particles: Crystal3DParticle[] = [];
  private outlineParticles: Crystal3DParticle[] = [];
  private angle = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const scale = Math.min(this.w, this.h) / 45;
    // 填充粒子
    const pts = generateHeart3D(400);
    this.particles = pts.map(p => ({
      x: p.x * scale, y: p.y * scale, z: p.z * scale,
      size: 1 + Math.random() * 1.5,
      isOutline: false,
      hue: 200 + Math.random() * 40,
    }));
    // 棱线粒子（多层轮廓）
    for (let layer = 0; layer < 5; layer++) {
      const zOff = (layer - 2) * 10;
      for (let i = 0; i < 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        const p = heartPoint(t);
        this.outlineParticles.push({
          x: p.x * scale, y: p.y * scale, z: zOff,
          size: 2 + Math.random() * 1.5,
          isOutline: true,
          hue: 190 + Math.random() * 50,
        });
      }
    }
  }

  render(): void {
    this.angle += 0.008;
    const ctx = this.ctx;
    const cx = this.w / 2, cy = this.h / 2;
    const cosA = Math.cos(this.angle), sinA = Math.sin(this.angle);
    const fov = 400;
    const all = [...this.particles, ...this.outlineParticles];

    const projected = all.map(p => {
      const rx = p.x * cosA - p.z * sinA;
      const rz = p.x * sinA + p.z * cosA;
      const scale = fov / (fov + rz);
      return { sx: cx + rx * scale, sy: cy + p.y * scale, depth: rz, size: p.size * scale, isOutline: p.isOutline, hue: p.hue };
    }).sort((a, b) => b.depth - a.depth);

    for (const p of projected) {
      const depthNorm = (p.depth + 80) / 160;
      const alpha = (0.2 + (1 - depthNorm) * 0.6) * (p.isOutline ? 0.8 : 0.4);
      ctx.globalAlpha = alpha;

      if (p.isOutline) {
        // 棱线发光
        const grad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, p.size * 3);
        grad.addColorStop(0, `hsla(${p.hue}, 70%, 75%, 0.6)`);
        grad.addColorStop(1, `hsla(${p.hue}, 70%, 60%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = `hsl(${p.hue}, ${p.isOutline ? 70 : 40}%, ${p.isOutline ? 75 : 60}%)`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void { this.w = w; this.h = h; this.particles = []; this.outlineParticles = []; this.init(); }
}
