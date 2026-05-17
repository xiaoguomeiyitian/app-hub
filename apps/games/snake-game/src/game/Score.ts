import {
  INITIAL_SPEED,
  SPEED_INCREMENT,
  FOODS_PER_SPEED_UP,
  MIN_SPEED,
} from '../config/constants';

const HIGH_SCORE_KEY = 'snake_high_score';

export class Score {
  current: number;
  highScore: number;
  private foodsEaten: number;
  private speedModifier: number;
  /** 分数翻倍技能乘数 */
  multiplier: number;

  constructor() {
    this.current = 0;
    this.foodsEaten = 0;
    this.speedModifier = 0;
    this.multiplier = 1;
    this.highScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  }

  add(points: number = 1): void {
    const actual = points * this.multiplier;
    this.current = Math.max(0, this.current + actual);
    if (points > 0) this.foodsEaten++;
    if (this.current > this.highScore) {
      this.highScore = this.current;
      localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
    }
  }

  setSpeedModifier(ms: number): void {
    this.speedModifier = ms;
  }

  get speedLevel(): number {
    return Math.floor(this.foodsEaten / FOODS_PER_SPEED_UP) + 1;
  }

  get interval(): number {
    const level = Math.floor(this.foodsEaten / FOODS_PER_SPEED_UP);
    const base = Math.max(MIN_SPEED, INITIAL_SPEED - level * SPEED_INCREMENT);
    return Math.max(MIN_SPEED, base + this.speedModifier);
  }
}
