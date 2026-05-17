/**
 * 1. 心跳粒子（李峋同款经典款）
 */
import { heartPoint } from '../heart-utils.js';

interface BeatParticle {
  x: number; y: number; baseX: number; baseY: number;
  size: number; alpha: number; offset: number; color: string;
}

export class HeartbeatStyle {
  private particles: BeatParticle[] = [];
  private time = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const cx = this.w / 2, cy = this.h / 2;
    const scale = Math.min(this.w, this.h) / 45;
    const count = 500;
    // 轮廓粒子
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const p = heartPoint(t);
      const jitter = (Math.random() - 0.5) * 4;
      this.particles.push({
        baseX: cx + p.x * scale + jitter,
        baseY: cy + p.y * scale + jitter,
        x: 0, y: 0,
        size: 1.5 + Math.random() * 2.5,
        alpha: 0.6 + Math.random() * 0.4,
        offset: Math.random() * Math.PI * 2,
        color: `hsl(${350 + Math.random() * 20}, ${80 + Math.random() * 20}%, ${50 + Math.random() * 20}%)`,
      });
    }
    // 内部填充粒子
    for (let i = 0; i < 300; i++) {
      const t = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.85;
      const p = heartPoint(t);
      const jitter = (Math.random() - 0.5) * 6;
      this.particles.push({
        baseX: cx + p.x * scale * r + jitter,
        baseY: cy + p.y * scale * r + jitter,
        x: 0, y: 0,
        size: 1 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.5,
        offset: Math.random() * Math.PI * 2,
        color: `hsl(${345 + Math.random() * 30}, ${70 + Math.random() * 30}%, ${45 + Math.random() * 25}%)`,
      });
    }
  }

  render(): void {
    this.time += 0.03;
    const ctx = this.ctx;
    // 心跳缩放
    const beat = Math.sin(this.time * 2);
    const beatScale = 1 + (beat > 0 ? beat * 0.12 : beat * 0.04);
    const cx = this.w / 2, cy = this.h / 2;

    for (const p of this.particles) {
      const dx = p.baseX - cx;
      const dy = p.baseY - cy;
      p.x = cx + dx * beatScale;
      p.y = cy + dy * beatScale;

      const pulse = Math.sin(this.time * 3 + p.offset);
      const alpha = p.alpha * (0.6 + pulse * 0.4);
      const size = p.size * (0.8 + pulse * 0.3);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void {
    this.w = w; this.h = h;
    this.particles = [];
    this.init();
  }
}
