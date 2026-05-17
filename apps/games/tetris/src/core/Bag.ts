import type { PieceType } from '../types.js';

const ALL_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** Fisher-Yates 洗牌 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 7-Bag 随机器 */
export class Bag {
  private queue: PieceType[] = [];

  /** 预生成指定数量的 Bag */
  constructor(previewCount: number = 5) {
    this.ensure(previewCount + 1);
  }

  /** 取出下一个方块 */
  next(): PieceType {
    this.ensure(1);
    return this.queue.shift()!;
  }

  /** 预览接下来 N 个方块 */
  peek(count: number): PieceType[] {
    this.ensure(count);
    return this.queue.slice(0, count);
  }

  /** 用种子重置（联机用） */
  resetWithSeed(seed: number[]): void {
    this.queue = seed.map(i => ALL_TYPES[i % 7]);
  }

  /** 追加种子序列 */
  appendSeed(seed: number[]): void {
    for (const i of seed) {
      this.queue.push(ALL_TYPES[i % 7]);
    }
  }

  private ensure(count: number): void {
    while (this.queue.length < count) {
      this.queue.push(...shuffle([...ALL_TYPES]));
    }
  }
}
