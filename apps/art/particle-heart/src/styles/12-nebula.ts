/**
 * 12. 星云漩涡爱心
 */
import { heartPoint } from '../heart-utils.js';

interface NebulaParticle {
  angle: number; dist: number;
  x: number; y: number;
  size: number; speed: number;
  hue: number; alpha: number;
  armIndex: number;
}

export class NebulaStyle {
  private particles: NebulaParticle[] = [];
  private time = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const scale = Math.min(this.w, this.h) / 50;
    const arms = 4;
    for (let i = 0; i < 600; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const dist = 5 + Math.random() * scale * 14;
      const spiralOffset = dist * 0.08;
      const angle = armAngle + spiralOffset + (Math.random() - 0.5) * 0.8;

      // 检查是否在心形范围内
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const hx = tx / scale;
      const hy = -ty / scale;
      const a = hx * hx + hy * hy - 1;
      const inHeart = a * a * a - hx * hx * hy * hy * hy < 0;

      if (inHeart || Math.random() < 0.3) {
        this.particles.push({
          angle, dist, x: 0, y: 0,
          size: 0.8 + Math.random() * 2.5,
          speed: 0.003 + Math.random() * 0.008,
          hue: 220 + Math.random() * 60 + (dist / scale) * 30,
          alpha: 0.3 + Math.random() * 0.6,
          armIndex: arm,
        });
      }
    }
  }

  render(): void {
    this.time += 0.015;
    const ctx = this.ctx;
    const cx = this.w / 2, cy = this.h / 2;

    for (const p of this.particles) {
      p.angle += p.speed;
      // 螺旋向内
      const spiralX = Math.cos(p.angle) * p.dist;
      const spiralY = Math.sin(p.angle) * p.dist;

      // 心形约束偏移
      p.x = cx + spiralX;
      p.y = cy + spiralY;

      const twinkle = Math.sin(this.time * 2 + p.angle * 3);
      const alpha = p.alpha * (0.5 + twinkle * 0.5);

      // 发光
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      grad.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${alpha * 0.6})`);
      grad.addColorStop(1, `hsla(${p.hue}, 80%, 50%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `hsl(${p.hue}, 80%, 75%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 中心引力点
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
    coreGrad.addColorStop(0, `rgba(255, 200, 255, ${0.3 + Math.sin(this.time * 3) * 0.2})`);
    coreGrad.addColorStop(1, 'rgba(200, 150, 255, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void { this.w = w; this.h = h; this.particles = []; this.init(); }
}
