/**
 * 13. 分形递归爱心
 */
import { heartPoint } from '../heart-utils.js';

interface FractalParticle {
  x: number; y: number;
  baseX: number; baseY: number;
  size: number; color: string;
  subHeart: { cx: number; cy: number; scale: number } | null;
}

export class FractalStyle {
  private particles: FractalParticle[] = [];
  private time = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const cx = this.w / 2, cy = this.h / 2;
    const scale = Math.min(this.w, this.h) / 45;

    // 大心形的轮廓点位置（小心形的中心）
    const subHeartPositions: { cx: number; cy: number; scale: number }[] = [];
    const subCount = 20;
    for (let i = 0; i < subCount; i++) {
      const t = (i / subCount) * Math.PI * 2;
      const p = heartPoint(t);
      subHeartPositions.push({
        cx: cx + p.x * scale * 0.8,
        cy: cy + p.y * scale * 0.8,
        scale: scale * 0.18,
      });
    }
    // 内部也放一些
    for (let i = 0; i < 10; i++) {
      const t = Math.random() * Math.PI * 2;
      const r = 0.2 + Math.random() * 0.4;
      const p = heartPoint(t);
      subHeartPositions.push({
        cx: cx + p.x * scale * r,
        cy: cy + p.y * scale * r,
        scale: scale * (0.1 + Math.random() * 0.12),
      });
    }

    // 为每个小心形生成粒子
    for (const sub of subHeartPositions) {
      const count = 30 + Math.floor(Math.random() * 20);
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const p = heartPoint(t);
        const r = 0.3 + Math.random() * 0.7;
        const x = sub.cx + p.x * sub.scale * r;
        const y = sub.cy + p.y * sub.scale * r;
        this.particles.push({
          x, y, baseX: x, baseY: y,
          size: 1 + Math.random() * 1.5,
          color: `hsl(${330 + Math.random() * 40}, 80%, ${50 + Math.random() * 25}%)`,
          subHeart: sub,
        });
      }
    }

    // 大心形轮廓粒子
    for (let i = 0; i < 200; i++) {
      const t = (i / 200) * Math.PI * 2;
      const p = heartPoint(t);
      const jitter = (Math.random() - 0.5) * 3;
      const x = cx + p.x * scale + jitter;
      const y = cy + p.y * scale + jitter;
      this.particles.push({
        x, y, baseX: x, baseY: y,
        size: 1 + Math.random() * 2,
        color: `hsl(350, 90%, ${55 + Math.random() * 20}%)`,
        subHeart: null,
      });
    }
  }

  render(): void {
    this.time += 0.02;
    const ctx = this.ctx;
    const cx = this.w / 2, cy = this.h / 2;
    const beat = 1 + Math.sin(this.time * 2) * 0.08;

    for (const p of this.particles) {
      const dx = p.baseX - cx;
      const dy = p.baseY - cy;
      p.x = cx + dx * beat;
      p.y = cy + dy * beat;

      // 小心形粒子有额外的脉冲
      let extraPulse = 1;
      if (p.subHeart) {
        extraPulse = 1 + Math.sin(this.time * 3 + p.subHeart.cx * 0.01) * 0.15;
        const sdx = p.x - p.subHeart.cx;
        const sdy = p.y - p.subHeart.cy;
        p.x = p.subHeart.cx + sdx * extraPulse;
        p.y = p.subHeart.cy + sdy * extraPulse;
      }

      const twinkle = Math.sin(this.time * 4 + p.baseX * 0.05);
      ctx.globalAlpha = 0.5 + twinkle * 0.4;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * extraPulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void { this.w = w; this.h = h; this.particles = []; this.init(); }
}
