/**
 * 2. 彩虹渐变粒子
 */
import { heartPoint } from '../heart-utils.js';

interface RainbowParticle {
  x: number; y: number; baseX: number; baseY: number;
  size: number; phase: number; alpha: number;
}

export class RainbowStyle {
  private particles: RainbowParticle[] = [];
  private time = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const cx = this.w / 2, cy = this.h / 2;
    const scale = Math.min(this.w, this.h) / 45;
    for (let i = 0; i < 600; i++) {
      const t = (i / 600) * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.7;
      const p = heartPoint(t);
      const jitter = (Math.random() - 0.5) * 3;
      this.particles.push({
        baseX: cx + p.x * scale * r + jitter,
        baseY: cy + p.y * scale * r + jitter,
        x: 0, y: 0,
        size: 1.5 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.5 + Math.random() * 0.5,
      });
    }
  }

  render(): void {
    this.time += 0.015;
    const ctx = this.ctx;
    for (const p of this.particles) {
      const hue = ((this.time * 60 + p.phase * 57) % 360 + 360) % 360;
      const wave = Math.sin(this.time * 2 + p.phase);
      p.x = p.baseX + wave * 2;
      p.y = p.baseY + Math.cos(this.time * 2 + p.phase) * 2;

      ctx.globalAlpha = p.alpha * (0.6 + wave * 0.3);
      ctx.fillStyle = `hsl(${hue}, 85%, 60%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.8 + wave * 0.2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void { this.w = w; this.h = h; this.particles = []; this.init(); }
}
