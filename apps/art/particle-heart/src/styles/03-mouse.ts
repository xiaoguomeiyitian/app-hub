/**
 * 3. 鼠标交互粒子
 */
import { heartPoint } from '../heart-utils.js';

interface MouseParticle {
  x: number; y: number; baseX: number; baseY: number;
  vx: number; vy: number; size: number; color: string;
}

export class MouseInteractiveStyle {
  private particles: MouseParticle[] = [];
  private mouseX = -1000;
  private mouseY = -1000;
  private isNear = false;
  private time = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const cx = this.w / 2, cy = this.h / 2;
    const scale = Math.min(this.w, this.h) / 45;
    for (let i = 0; i < 400; i++) {
      const t = (i / 400) * Math.PI * 2;
      const r = 0.2 + Math.random() * 0.8;
      const p = heartPoint(t);
      const jitter = (Math.random() - 0.5) * 5;
      const x = cx + p.x * scale * r + jitter;
      const y = cy + p.y * scale * r + jitter;
      this.particles.push({
        x, y, baseX: x, baseY: y, vx: 0, vy: 0,
        size: 1.5 + Math.random() * 2.5,
        color: `hsl(${340 + Math.random() * 30}, 80%, ${55 + Math.random() * 20}%)`,
      });
    }
  }

  onMouseMove(x: number, y: number): void {
    this.mouseX = x;
    this.mouseY = y;
  }

  render(): void {
    this.time += 0.02;
    const ctx = this.ctx;
    const repelRadius = 120;
    const repelForce = 8;
    const returnForce = 0.05;
    const damping = 0.92;

    // 更新粒子
    for (const p of this.particles) {
      const dx = p.x - this.mouseX;
      const dy = p.y - this.mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < repelRadius && dist > 0) {
        const force = (1 - dist / repelRadius) * repelForce;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }

      // 回归原位
      p.vx += (p.baseX - p.x) * returnForce;
      p.vy += (p.baseY - p.y) * returnForce;
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx;
      p.y += p.vy;
    }

    // 绘制连接线
    ctx.strokeStyle = 'rgba(255, 100, 130, 0.15)';
    ctx.lineWidth = 0.5;
    const connectDist = 30;
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i], b = this.particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < connectDist) {
          ctx.globalAlpha = (1 - dist / connectDist) * 0.4;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // 绘制粒子
    for (const p of this.particles) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void { this.w = w; this.h = h; this.particles = []; this.init(); }
}
