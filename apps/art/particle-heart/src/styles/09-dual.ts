/**
 * 9. 双爱心交错
 */
import { heartPoint } from '../heart-utils.js';

interface DualParticle {
  x: number; y: number; baseX: number; baseY: number;
  size: number; which: 0 | 1; offset: number;
}

export class DualHeartStyle {
  private particles: DualParticle[] = [];
  private time = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const cx = this.w / 2, cy = this.h / 2;
    const scale = Math.min(this.w, this.h) / 50;
    // 第一个心形（红色，偏左上）
    for (let i = 0; i < 400; i++) {
      const t = (i / 400) * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.7;
      const p = heartPoint(t);
      this.particles.push({
        baseX: cx - 20 + p.x * scale * r,
        baseY: cy - 10 + p.y * scale * r,
        x: 0, y: 0,
        size: 1.5 + Math.random() * 2,
        which: 0,
        offset: Math.random() * Math.PI * 2,
      });
    }
    // 第二个心形（粉色，偏右下）
    for (let i = 0; i < 400; i++) {
      const t = (i / 400) * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.7;
      const p = heartPoint(t);
      this.particles.push({
        baseX: cx + 20 + p.x * scale * r,
        baseY: cy + 10 + p.y * scale * r,
        x: 0, y: 0,
        size: 1.5 + Math.random() * 2,
        which: 1,
        offset: Math.random() * Math.PI * 2,
      });
    }
  }

  render(): void {
    this.time += 0.02;
    const ctx = this.ctx;
    const cx = this.w / 2, cy = this.h / 2;

    // 两个心形做相反方向呼吸
    const beat0 = 1 + Math.sin(this.time * 2) * 0.1;
    const beat1 = 1 + Math.sin(this.time * 2 + Math.PI) * 0.1;

    for (const p of this.particles) {
      const scale = p.which === 0 ? beat0 : beat1;
      const dx = p.baseX - cx;
      const dy = p.baseY - cy;
      p.x = cx + dx * scale;
      p.y = cy + dy * scale;

      const twinkle = Math.sin(this.time * 3 + p.offset);
      const alpha = 0.6 + twinkle * 0.3;

      if (p.which === 0) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `hsl(350, 85%, ${55 + twinkle * 10}%)`;
      } else {
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = `hsl(330, 75%, ${65 + twinkle * 10}%)`;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void { this.w = w; this.h = h; this.particles = []; this.init(); }
}
