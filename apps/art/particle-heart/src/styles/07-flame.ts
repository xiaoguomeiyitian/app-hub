/**
 * 7. 火焰粒子
 */
import { heartPoint } from '../heart-utils.js';

interface FlameParticle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  baseX: number; baseY: number;
}

export class FlameStyle {
  private particles: FlameParticle[] = [];
  private time = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.spawnBatch();
  }

  private spawnBatch(): void {
    const cx = this.w / 2, cy = this.h / 2;
    const scale = Math.min(this.w, this.h) / 45;
    for (let i = 0; i < 30; i++) {
      const t = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.7;
      const p = heartPoint(t);
      this.particles.push({
        x: cx + p.x * scale * r + (Math.random() - 0.5) * 10,
        y: cy + p.y * scale * r + (Math.random() - 0.5) * 10,
        baseX: cx + p.x * scale * r,
        baseY: cy + p.y * scale * r,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1 - Math.random() * 2.5,
        life: 0,
        maxLife: 40 + Math.random() * 40,
        size: 1.5 + Math.random() * 3,
      });
    }
  }

  render(): void {
    this.time += 0.02;
    const ctx = this.ctx;

    // 持续生成
    if (this.particles.length < 500) this.spawnBatch();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;
      if (p.life > p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vx += (Math.random() - 0.5) * 0.3;
      p.vy *= 0.99;

      const lifeRatio = p.life / p.maxLife;
      const alpha = 1 - lifeRatio;
      // 底部红色 → 顶部黄色
      const hue = 0 + lifeRatio * 50;
      const lightness = 45 + lifeRatio * 20;
      const size = p.size * (1 - lifeRatio * 0.5);

      // 火焰发光
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3);
      grad.addColorStop(0, `hsla(${hue}, 100%, ${lightness}%, ${alpha * 0.8})`);
      grad.addColorStop(0.5, `hsla(${hue}, 100%, ${lightness - 10}%, ${alpha * 0.3})`);
      grad.addColorStop(1, `hsla(${hue}, 100%, ${lightness - 20}%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void { this.w = w; this.h = h; this.particles = []; }
}
