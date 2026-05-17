import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  COLORS,
  FOOD_CONFIG,
} from '../config/constants';
import { Snake } from '../game/Snake';
import { FoodManager } from '../game/FoodManager';
import { Maze } from '../game/Maze';
import type { ActiveEffect } from '../types';
import { ParticleSystem, ScorePopupSystem } from './ParticleSystem';

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D | null;
  private frame = 0;
  particles = new ParticleSystem();
  popups = new ScorePopupSystem();

  // Flash/shake
  private flashAlpha = 0;
  private flashColor = '';
  private shakeX = 0;
  private shakeY = 0;
  private shakeDecay = 0;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) console.error('CanvasRenderer: 无法获取 2D 上下文');
  }

  /** 触发屏幕闪红 */
  flash(color = 'rgba(255,107,107,0.4)'): void {
    this.flashAlpha = 1;
    this.flashColor = color;
  }

  /** 触发屏幕震动 */
  shake(intensity = 6): void {
    this.shakeDecay = intensity;
  }

  /** 更新动画状态（每帧调用） */
  updateEffects(): void {
    this.particles.update();
    this.popups.update();
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - 0.06);
    if (this.shakeDecay > 0) {
      this.shakeX = (Math.random() - 0.5) * this.shakeDecay * 2;
      this.shakeY = (Math.random() - 0.5) * this.shakeDecay * 2;
      this.shakeDecay *= 0.85;
      if (this.shakeDecay < 0.5) { this.shakeDecay = 0; this.shakeX = 0; this.shakeY = 0; }
    }
  }

  clear(): void {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.translate(this.shakeX, this.shakeY);
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.ctx.strokeStyle = COLORS.grid;
    this.ctx.lineWidth = 0.5;
    for (let x = 0; x <= GRID_COLS; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * CELL_SIZE, 0);
      this.ctx.lineTo(x * CELL_SIZE, CANVAS_HEIGHT);
      this.ctx.stroke();
    }
    for (let y = 0; y <= GRID_ROWS; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * CELL_SIZE);
      this.ctx.lineTo(CANVAS_WIDTH, y * CELL_SIZE);
      this.ctx.stroke();
    }
  }

  drawSnake(snake: Snake, effects?: ActiveEffect[], isSecond?: boolean): void {
    if (!this.ctx) return;
    this.frame++;
    const frozen = effects?.some(e => e.type === 'frozen');
    const lightning = effects?.some(e => e.type === 'lightning');

    const headColorBase = isSecond ? COLORS.snakeHead2 : COLORS.snakeHead;
    const bodyColor1 = isSecond ? COLORS.snakeBody2 : COLORS.snakeBody;
    const bodyColor2 = isSecond ? '#c0392b' : '#00a882';

    snake.body.forEach((seg, i) => {
      const x = seg.x * CELL_SIZE;
      const y = seg.y * CELL_SIZE;
      const pad = i === 0 ? 1 : 2;
      if (i === 0) {
        let hc: string = headColorBase;
        if (frozen) hc = '#74b9ff';
        else if (lightning) hc = '#fdcb6e';
        this.ctx!.fillStyle = hc;
        this.ctx!.beginPath();
        this.roundRect(x + pad, y + pad, CELL_SIZE - pad * 2, CELL_SIZE - pad * 2, 5);
        this.ctx!.fill();
        this.ctx!.fillStyle = '#1a1a2e';
        const es = 3;
        const cx = x + CELL_SIZE / 2, cy = y + CELL_SIZE / 2;
        let e1x = cx, e1y = cy, e2x = cx, e2y = cy;
        switch (snake.direction) {
          case 'UP':    e1x -= 4; e1y -= 3; e2x += 4; e2y -= 3; break;
          case 'DOWN':  e1x -= 4; e1y += 3; e2x += 4; e2y += 3; break;
          case 'LEFT':  e1x -= 3; e1y -= 4; e2x -= 3; e2y += 4; break;
          case 'RIGHT': e1x += 3; e1y -= 4; e2x += 3; e2y += 4; break;
        }
        this.ctx!.beginPath(); this.ctx!.arc(e1x, e1y, es, 0, Math.PI * 2); this.ctx!.fill();
        this.ctx!.beginPath(); this.ctx!.arc(e2x, e2y, es, 0, Math.PI * 2); this.ctx!.fill();
      } else {
        let bc: string = i % 2 === 0 ? bodyColor1 : bodyColor2;
        if (frozen) bc = i % 2 === 0 ? '#a0d2ff' : '#74b9ff';
        else if (lightning) bc = i % 2 === 0 ? '#ffe066' : '#fdcb6e';
        this.ctx!.fillStyle = bc;
        this.ctx!.beginPath();
        this.roundRect(x + pad, y + pad, CELL_SIZE - pad * 2, CELL_SIZE - pad * 2, 4);
        this.ctx!.fill();
      }
    });
  }

  drawFoods(foodManager: FoodManager): void {
    if (!this.ctx) return;
    const now = Date.now();
    for (const item of foodManager.items) {
      const cfg = FOOD_CONFIG[item.type];
      const cx = item.position.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = item.position.y * CELL_SIZE + CELL_SIZE / 2;
      const radius = CELL_SIZE / 2 - 2;
      const pulse = 1 + Math.sin(this.frame * 0.15) * 0.1;
      this.ctx.fillStyle = cfg.glowColor;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius * 1.5 * pulse, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = cfg.color;
      this.ctx.globalAlpha = 0.7;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius * 0.9, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
      this.ctx.font = `${Math.floor(CELL_SIZE * 0.65)}px serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(cfg.emoji, cx, cy + 1);
      if (item.lifetime > 0) {
        const ratio = Math.max(0, 1 - (now - item.spawnTime) / item.lifetime);
        if (ratio > 0) {
          this.ctx.strokeStyle = cfg.color;
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
          this.ctx.stroke();
        }
      }
    }
  }

  drawObstacles(maze: Maze): void {
    if (!this.ctx || maze.obstacles.length === 0) return;
    this.drawBrickBlocks(maze.obstacles, COLORS.obstacle, COLORS.obstacleBorder);
  }

  /** 绘制trail墙壁 */
  drawTrailWalls(walls: { x: number; y: number }[]): void {
    if (!this.ctx || walls.length === 0) return;
    this.drawBrickBlocks(walls, COLORS.trailWall, COLORS.trailWallBorder);
  }

  /** 绘制时间暂停覆盖层 */
  drawTimeStopOverlay(): void {
    if (!this.ctx) return;
    this.ctx.fillStyle = 'rgba(116, 185, 255, 0.12)';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.ctx.fillStyle = '#74b9ff';
    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('⏳ 时间暂停中...', CANVAS_WIDTH / 2, 24);
  }

  /** Phase 6: 绘制粒子 + 弹出文字 + 闪屏 + 震动恢复 */
  finishFrame(): void {
    if (!this.ctx) return;
    // Particles & popups (in world space)
    this.particles.draw(this.ctx);
    this.popups.draw(this.ctx);
    // Flash overlay
    if (this.flashAlpha > 0 && this.flashColor) {
      this.ctx.fillStyle = this.flashColor;
      this.ctx.globalAlpha = this.flashAlpha;
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      this.ctx.globalAlpha = 1;
    }
    // Restore from shake
    this.ctx.restore();
  }

  private drawBrickBlocks(blocks: { x: number; y: number }[], color: string, borderColor: string): void {
    if (!this.ctx) return;
    for (const obs of blocks) {
      const x = obs.x * CELL_SIZE;
      const y = obs.y * CELL_SIZE;
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      this.ctx.strokeStyle = borderColor;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      this.ctx.beginPath();
      this.ctx.moveTo(x + 1, y + CELL_SIZE / 2);
      this.ctx.lineTo(x + CELL_SIZE - 1, y + CELL_SIZE / 2);
      this.ctx.moveTo(x + CELL_SIZE / 2, y + 1);
      this.ctx.lineTo(x + CELL_SIZE / 2, y + CELL_SIZE / 2);
      this.ctx.stroke();
    }
  }

  /** Phase 20: 大逃杀边界 */
  drawRoyaleBorder(border: number): void {
    if (!this.ctx || border <= 0) return;
    const ctx = this.ctx;
    const b = border * CELL_SIZE;
    // Darken outside border
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    // Top
    ctx.fillRect(0, 0, CANVAS_WIDTH, b);
    // Bottom
    ctx.fillRect(0, CANVAS_HEIGHT - b, CANVAS_WIDTH, b);
    // Left
    ctx.fillRect(0, 0, b, CANVAS_HEIGHT);
    // Right
    ctx.fillRect(CANVAS_WIDTH - b, 0, b, CANVAS_HEIGHT);
    // Red border line
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(b, b, CANVAS_WIDTH - 2 * b, CANVAS_HEIGHT - 2 * b);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    if (!this.ctx) return;
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, r);
    this.ctx.arcTo(x + w, y + h, x, y + h, r);
    this.ctx.arcTo(x, y + h, x, y, r);
    this.ctx.arcTo(x, y, x + w, y, r);
    this.ctx.closePath();
  }
}
