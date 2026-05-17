import type { FoodItem, FoodType } from '../types';
import { GRID_COLS, GRID_ROWS, MAX_FOODS, FOOD_SPAWN_INTERVAL, FOOD_CONFIG } from '../config/constants';

export class FoodManager {
  items: FoodItem[];
  private lastSpawnCheck: number;

  constructor() {
    this.items = [];
    this.lastSpawnCheck = 0;
  }

  private randomType(): FoodType {
    const entries = Object.entries(FOOD_CONFIG) as [FoodType, typeof FOOD_CONFIG[FoodType]][];
    const totalWeight = entries.reduce((sum, [, cfg]) => sum + cfg.weight, 0);
    let r = Math.random() * totalWeight;
    for (const [type, cfg] of entries) {
      r -= cfg.weight;
      if (r <= 0) return type;
    }
    return 'normal';
  }

  private freeCells(occupyFn: (x: number, y: number) => boolean): { x: number; y: number }[] {
    const free: { x: number; y: number }[] = [];
    const occupied = new Set(this.items.map(f => `${f.position.x},${f.position.y}`));
    for (let x = 0; x < GRID_COLS; x++) {
      for (let y = 0; y < GRID_ROWS; y++) {
        if (!occupyFn(x, y) && !occupied.has(`${x},${y}`)) {
          free.push({ x, y });
        }
      }
    }
    return free;
  }

  spawnOne(occupyFn: (x: number, y: number) => boolean): boolean {
    if (this.items.length >= MAX_FOODS) return true;
    const free = this.freeCells(occupyFn);
    if (free.length === 0) return false;
    const pos = free[Math.floor(Math.random() * free.length)];
    const type = this.randomType();
    const cfg = FOOD_CONFIG[type];
    this.items.push({
      type,
      position: pos,
      spawnTime: Date.now(),
      lifetime: cfg.lifetime,
    });
    return true;
  }

  init(occupyFn: (x: number, y: number) => boolean): boolean {
    this.items = [];
    this.lastSpawnCheck = Date.now();
    return this.spawnOne(occupyFn);
  }

  findAt(x: number, y: number): number {
    return this.items.findIndex(f => f.position.x === x && f.position.y === y);
  }

  removeAt(index: number): void {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1);
    }
  }

  update(occupyFn: (x: number, y: number) => boolean): boolean {
    const now = Date.now();
    this.items = this.items.filter(f => f.lifetime === 0 || now - f.spawnTime < f.lifetime);
    if (now - this.lastSpawnCheck >= FOOD_SPAWN_INTERVAL) {
      this.lastSpawnCheck = now;
      if (this.items.length < MAX_FOODS) {
        return this.spawnOne(occupyFn);
      }
    }
    return true;
  }

  isOccupied(x: number, y: number): boolean {
    return this.items.some(f => f.position.x === x && f.position.y === y);
  }
}
