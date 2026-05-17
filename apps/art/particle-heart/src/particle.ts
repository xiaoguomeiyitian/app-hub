/** 通用粒子类 */
export class Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  originX: number;
  originY: number;
  originZ: number;

  constructor(x: number, y: number, options: Partial<Particle> = {}) {
    this.x = x;
    this.y = y;
    this.z = options.z ?? 0;
    this.vx = options.vx ?? 0;
    this.vy = options.vy ?? 0;
    this.vz = options.vz ?? 0;
    this.size = options.size ?? 2;
    this.color = options.color ?? '#ff4466';
    this.alpha = options.alpha ?? 1;
    this.life = options.life ?? 1;
    this.maxLife = options.maxLife ?? 1;
    this.originX = options.originX ?? x;
    this.originY = options.originY ?? y;
    this.originZ = options.originZ ?? 0;
  }

  update(): void {
    this.x += this.vx;
    this.y += this.vy;
    this.z += this.vz;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}
