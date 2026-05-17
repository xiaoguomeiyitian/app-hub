/**
 * 6. 粒子汇聚动画
 */
import { heartPoint } from '../heart-utils.js';

interface ConvergeParticle {
  x: number; y: number; targetX: number; targetY: number;
  vx: number; vy: number; size: number; color: string;
  trail: { x: number; y: number }[];
  phase: number;
}

export class ConvergeStyle {
  private particles: ConvergeParticle[] = [];
  private time = 0;
  private state: 'converge' | 'beat' | 'scatter' = 'converge';
  private stateTimer = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const cx = this.w / 2, cy = this.h / 2;
    const scale = Math.min(this.w, this.h) / 45;
    const count = 350;
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const r = 0.2 + Math.random() * 0.8;
      const p = heartPoint(t);
      const tx = cx + p.x * scale * r;
      const ty = cy + p.y * scale * r;
      this.particles.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        targetX: tx, targetY: ty,
        vx: 0, vy: 0,
        size: 1.5 + Math.random() * 2,
        color: `hsl(${340 + Math.random() * 30}, 80%, ${50 + Math.random() * 25}%)`,
        trail: [],
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  render(): void {
    this.time += 0.02;
    this.stateTimer += 0.02;
    const ctx = this.ctx;
    const cx = this.w / 2, cy = this.h / 2;

    // 状态机
    if (this.state === 'converge' && this.stateTimer > 3) {
      this.state = 'beat'; this.stateTimer = 0;
    } else if (this.state === 'beat' && this.stateTimer > 2) {
      this.state = 'scatter'; this.stateTimer = 0;
    } else if (this.state === 'scatter' && this.stateTimer > 1.5) {
      this.state = 'converge'; this.stateTimer = 0;
    }

    const beatScale = this.state === 'beat'
      ? 1 + Math.sin(this.stateTimer * 8) * 0.15
      : 1;

    for (const p of this.particles) {
      // 保存轨迹
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 8) p.trail.shift();

      if (this.state === 'converge') {
        const ease = 0.03;
        p.vx += (p.targetX - p.x) * ease;
        p.vy += (p.targetY - p.y) * ease;
      } else if (this.state === 'beat') {
        const tx = cx + (p.targetX - cx) * beatScale;
        const ty = cy + (p.targetY - cy) * beatScale;
        p.vx += (tx - p.x) * 0.08;
        p.vy += (ty - p.y) * 0.08;
      } else {
        // scatter
        const angle = Math.atan2(p.y - cy, p.x - cx);
        p.vx += Math.cos(angle) * 0.5;
        p.vy += Math.sin(angle) * 0.5;
      }

      p.vx *= 0.95;
      p.vy *= 0.95;
      p.x += p.vx;
      p.y += p.vy;

      // 绘制尾迹
      for (let i = 0; i < p.trail.length; i++) {
        const t = i / p.trail.length;
        ctx.globalAlpha = t * 0.3;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.trail[i].x, p.trail[i].y, p.size * t, 0, Math.PI * 2);
        ctx.fill();
      }

      // 绘制粒子
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
