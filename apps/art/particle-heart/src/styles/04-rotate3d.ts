/**
 * 4. 3D旋转粒子
 */
import { generateHeart3D } from '../heart-utils.js';

interface Particle3D {
  x: number; y: number; z: number;
  size: number; baseColor: { r: number; g: number; b: number };
}

export class Rotate3DStyle {
  private particles: Particle3D[] = [];
  private angle = 0;

  constructor(private ctx: CanvasRenderingContext2D, private w: number, private h: number) {
    this.init();
  }

  private init(): void {
    const pts = generateHeart3D(600);
    const scale = Math.min(this.w, this.h) / 45;
    this.particles = pts.map(p => ({
      x: p.x * scale,
      y: p.y * scale,
      z: p.z * scale,
      size: 2 + Math.random() * 2,
      baseColor: { r: 220 + Math.random() * 35, g: 60 + Math.random() * 40, b: 80 + Math.random() * 40 },
    }));
  }

  render(): void {
    this.angle += 0.012;
    const ctx = this.ctx;
    const cx = this.w / 2, cy = this.h / 2;
    const cosA = Math.cos(this.angle), sinA = Math.sin(this.angle);

    // 透视投影
    const fov = 400;
    const projected = this.particles.map(p => {
      // Y轴旋转
      const rx = p.x * cosA - p.z * sinA;
      const rz = p.x * sinA + p.z * cosA;
      const scale = fov / (fov + rz);
      return {
        sx: cx + rx * scale,
        sy: cy + p.y * scale,
        depth: rz,
        size: p.size * scale,
        color: p.baseColor,
      };
    });

    // 按深度排序（远的先画）
    projected.sort((a, b) => b.depth - a.depth);

    for (const p of projected) {
      const depthNorm = (p.depth + 100) / 200; // 归一化深度
      const brightness = 0.3 + (1 - depthNorm) * 0.7;
      ctx.globalAlpha = 0.4 + brightness * 0.6;
      ctx.fillStyle = `rgb(${Math.round(p.color.r * brightness)}, ${Math.round(p.color.g * brightness)}, ${Math.round(p.color.b * brightness)})`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize(w: number, h: number): void { this.w = w; this.h = h; this.particles = []; this.init(); }
}
