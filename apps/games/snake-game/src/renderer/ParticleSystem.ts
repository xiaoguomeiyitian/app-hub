export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; // 0-1
  color: string;
  size: number;
}

export class ParticleSystem {
  particles: Particle[] = [];

  emit(x: number, y: number, color: string, count = 8): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 2.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  update(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.life -= 0.03;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  get count(): number { return this.particles.length; }
}

export interface ScorePopup {
  x: number; y: number;
  text: string;
  life: number; // 0-1
  color: string;
}

export class ScorePopupSystem {
  popups: ScorePopup[] = [];

  add(x: number, y: number, text: string, color = '#ffd93d'): void {
    this.popups.push({ x, y, text, life: 1, color });
  }

  update(): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 1.2;
      p.life -= 0.025;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.popups) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}
