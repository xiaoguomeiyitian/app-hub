/** 本地统计数据管理器 */
const STORAGE_KEY = 'tetris_stats';

export interface TetrisStats {
  bestScore: number;
  bestLines: number;
  bestLevel: number;
  bestSprintTime: number | null; // 40L 毫秒
  totalGames: number;
  totalLines: number;
  totalScore: number;
  maxCombo: number;
  maxB2B: number;
  totalTSpins: number;
  totalQuads: number;
  allClears: number;
}

const DEFAULT: TetrisStats = {
  bestScore: 0,
  bestLines: 0,
  bestLevel: 1,
  bestSprintTime: null,
  totalGames: 0,
  totalLines: 0,
  totalScore: 0,
  maxCombo: 0,
  maxB2B: 0,
  totalTSpins: 0,
  totalQuads: 0,
  allClears: 0,
};

export class StatsManager {
  private stats: TetrisStats;

  constructor() {
    this.stats = this.load();
  }

  private load(): TetrisStats {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch { /* ignore */ }
  }

  get(): TetrisStats { return { ...this.stats }; }

  /** 游戏结束时更新统计 */
  recordGameEnd(score: number, lines: number, level: number, maxCombo: number, maxB2B: number, tspins: number, quads: number, allClears: number): void {
    this.stats.totalGames++;
    this.stats.totalLines += lines;
    this.stats.totalScore += score;
    if (score > this.stats.bestScore) this.stats.bestScore = score;
    if (lines > this.stats.bestLines) this.stats.bestLines = lines;
    if (level > this.stats.bestLevel) this.stats.bestLevel = level;
    if (maxCombo > this.stats.maxCombo) this.stats.maxCombo = maxCombo;
    if (maxB2B > this.stats.maxB2B) this.stats.maxB2B = maxB2B;
    this.stats.totalTSpins += tspins;
    this.stats.totalQuads += quads;
    this.stats.allClears += allClears;
    this.save();
  }

  /** 记录 40L 冲刺成绩 */
  recordSprintTime(ms: number): void {
    if (this.stats.bestSprintTime === null || ms < this.stats.bestSprintTime) {
      this.stats.bestSprintTime = ms;
      this.save();
    }
  }

  reset(): void {
    this.stats = { ...DEFAULT };
    this.save();
  }
}
