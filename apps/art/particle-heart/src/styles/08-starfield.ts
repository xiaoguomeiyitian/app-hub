/**
 * 8. 星空粒子
 */
import { heartPoint } from '../heart-utils.js';

interface StarParticle {
  x: number; y: number; size: number;
  twinkleSpeed: number; phase: number;
  isBig: boolean; baseAlpha: number;
}

export class StarfieldStyle {
  private particles: StarParticle[] = [];
  private time = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const cx = this.w / 2, cy = this.h / 2;
    const scale = Math.min(this.w, this.h) / 45;
    // 大量小粒子填充心形
    for (let i = 0; i < 800; i++) {
      const t = Math.random() * Math.PI * 2;
      const r = Math.random();
      const p = heartPoint(t);
      const jitter = (Math.random() - 0.5) * 8;
      this.particles.push({
        x: cx + p.x * scale * r + jitter,
        y: cy + p.y * scale * r + jitter,
        size: 0.5 + Math.random() * 1.5,
        twinkleSpeed: 1 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
        isBig: false,
        baseAlpha: 0.3 + Math.random() * 0.7,
      });
    }
    // 大星（脉冲恒星）
    for (let i = 0; i < 15; i++) {
      const t = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.7;
      const p = heartPoint(t);
      this.particles.push({
        x: cx + p.x * scale * r,
        y: cy + p.y * scale * r,
        size: 3 + Math.random() * 3,
        twinkleSpeed: 0.3 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        isBig: true,
        baseAlpha: 0.6 + Math.random() * 0.4,
      });
    }
  }

  render(): void {
    this.time += 0.015;
    const ctx = this.ctx;

    for (const p of this.particles) {
      const twinkle = Math.sin(this.time * p.twinkleSpeed + p.phase);
      const alpha = p.baseAlpha * (0.3 + twinkle * 0.7);

      if (p.isBig) {
        // 大星有发光效果
        const pulseSize = p.size * (0.8 + Math.sin(this.time * p.twinkleSpeed * 2 + p.phase) * 0.4);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pulseSize * 4);
        grad.addColorStop(0, `rgba(255, 255, 220, ${alpha})`);
        grad.addColorStop(0.3, `rgba(255, 240, 200, ${alpha * 0.4})`);
        grad.addColorStop(1, 'rgba(255, 220, 150, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulseSize * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fffef0';
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulseSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = alpha;
        const warmth = Math.random() > 0.5 ? '#fff8f0' : '#f0f0ff';
        ctx.fillStyle = warmth;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void { this.w = w; this.h = h; this.particles = []; this.init(); }
}
