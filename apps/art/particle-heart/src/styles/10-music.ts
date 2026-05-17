/**
 * 10. 音乐节拍粒子
 */
import { heartPoint } from '../heart-utils.js';

interface BeatParticle {
  x: number; y: number; baseX: number; baseY: number;
  size: number; color: string; offset: number;
}

interface Shockwave {
  x: number; y: number; radius: number; maxRadius: number; alpha: number;
}

interface BurstParticle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

export class MusicBeatStyle {
  private particles: BeatParticle[] = [];
  private shockwaves: Shockwave[] = [];
  private bursts: BurstParticle[] = [];
  private time = 0;
  private beatPhase = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const cx = this.w / 2, cy = this.h / 2;
    const scale = Math.min(this.w, this.h) / 45;
    for (let i = 0; i < 500; i++) {
      const t = (i / 500) * Math.PI * 2;
      const r = 0.2 + Math.random() * 0.8;
      const p = heartPoint(t);
      const jitter = (Math.random() - 0.5) * 4;
      this.particles.push({
        baseX: cx + p.x * scale * r + jitter,
        baseY: cy + p.y * scale * r + jitter,
        x: 0, y: 0,
        size: 1.5 + Math.random() * 2.5,
        color: `hsl(${340 + Math.random() * 40}, 90%, ${50 + Math.random() * 25}%)`,
        offset: Math.random() * Math.PI * 2,
      });
    }
  }

  render(): void {
    this.time += 0.025;
    const ctx = this.ctx;
    const cx = this.w / 2, cy = this.h / 2;

    // 模拟节拍（BPM ~120）
    const prevBeat = this.beatPhase;
    this.beatPhase = (this.time * 2) % 1;
    const isBeat = this.beatPhase < 0.1 && prevBeat >= 0.1;

    // 节拍时产生冲击波和爆发
    if (isBeat) {
      this.shockwaves.push({ x: cx, y: cy, radius: 10, maxRadius: 200, alpha: 0.8 });
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        this.bursts.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0, maxLife: 30 + Math.random() * 20,
          size: 1 + Math.random() * 3,
          color: `hsl(${Math.random() * 60}, 100%, 70%)`,
        });
      }
    }

    // 节拍脉冲
    const beatPulse = this.beatPhase < 0.2 ? 1 + (1 - this.beatPhase / 0.2) * 0.15 : 1;

    // 绘制心形粒子
    for (const p of this.particles) {
      const dx = p.baseX - cx;
      const dy = p.baseY - cy;
      p.x = cx + dx * beatPulse;
      p.y = cy + dy * beatPulse;

      const pulse = Math.sin(this.time * 4 + p.offset);
      ctx.globalAlpha = 0.6 + pulse * 0.3;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * beatPulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制冲击波
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 4;
      sw.alpha -= 0.015;
      if (sw.alpha <= 0) { this.shockwaves.splice(i, 1); continue; }
      ctx.globalAlpha = sw.alpha;
      ctx.strokeStyle = '#ff6688';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 绘制爆发粒子
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life++;
      if (b.life > b.maxLife) { this.bursts.splice(i, 1); continue; }
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.97;
      b.vy *= 0.97;
      const alpha = 1 - b.life / b.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void { this.w = w; this.h = h; this.particles = []; this.shockwaves = []; this.bursts = []; this.init(); }
}
