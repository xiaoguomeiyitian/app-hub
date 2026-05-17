/**
 * 5. 水晶轮廓粒子
 */
import { heartPoint } from '../heart-utils.js';

interface CrystalParticle {
  x: number; y: number; baseAlpha: number;
  size: number; twinkleSpeed: number; phase: number;
  glowSize: number;
}

export class CrystalStyle {
  private particles: CrystalParticle[] = [];
  private time = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const cx = this.w / 2, cy = this.h / 2;
    const scale = Math.min(this.w, this.h) / 45;
    const count = 400;
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const p = heartPoint(t);
      const jitter = (Math.random() - 0.5) * 2;
      this.particles.push({
        x: cx + p.x * scale + jitter,
        y: cy + p.y * scale + jitter,
        baseAlpha: 0.3 + Math.random() * 0.5,
        size: 1.5 + Math.random() * 2.5,
        twinkleSpeed: 1 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
        glowSize: 6 + Math.random() * 8,
      });
    }
  }

  render(): void {
    this.time += 0.02;
    const ctx = this.ctx;

    for (const p of this.particles) {
      const twinkle = Math.sin(this.time * p.twinkleSpeed + p.phase);
      const alpha = p.baseAlpha * (0.4 + twinkle * 0.6);

      // 外发光
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.glowSize);
      grad.addColorStop(0, `rgba(120, 180, 255, ${alpha * 0.6})`);
      grad.addColorStop(0.5, `rgba(80, 140, 220, ${alpha * 0.2})`);
      grad.addColorStop(1, 'rgba(40, 80, 160, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.glowSize, 0, Math.PI * 2);
      ctx.fill();

      // 核心
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgba(180, 220, 255, 1)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void { this.w = w; this.h = h; this.particles = []; this.init(); }
}
