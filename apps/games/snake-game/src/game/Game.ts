import type { GameState, GameMode, FoodItem, ActiveEffect, SkillType, SkillCard, ActiveSkill, Direction, GameStats } from '../types';
import { Snake } from './Snake';
import { FoodManager } from './FoodManager';
import { Maze } from './Maze';
import { Collision } from './Collision';
import { Score } from './Score';
import { SkillManager } from './SkillManager';
import { TrailManager } from './TrailManager';
import { FOOD_CONFIG, SKILL_CONFIG, GRID_COLS, GRID_ROWS, TIMELIMIT_DURATION, SURVIVAL_BASE_INTERVAL, SURVIVAL_SPEED_INCREASE, SURVIVAL_MIN_INTERVAL, ROYALE_SHRINK_INTERVAL, ROYALE_SHRINK_AMOUNT } from '../config/constants';

interface SnakeInstance {
  snake: Snake;
  score: Score;
  activeEffects: ActiveEffect[];
  skillCards: SkillCard[];
  activeSkills: ActiveSkill[];
  skillManager: SkillManager;
}

export class Game {
  private snakes: SnakeInstance[]; // always 1 or 2
  private foodManager: FoodManager;
  private maze: Maze;
  private trailManager: TrailManager;
  state: GameState;
  mode: GameMode;
  private loopId: number | null = null;
  private lastFrameTime = 0;
  private accumulated = 0;

  // Phase 2: stats tracking
  private gameStartTime = 0;
  private foodsEaten = 0;
  private maxSpeed = 1;
  private skillsUsed = 0;

  // callbacks
  private onRender?: () => void;
  private onScoreChange?: (primary: number, secondary?: number) => void;
  private onSpeedChange?: (level: number) => void;
  private onGameOver?: (stats: GameStats) => void;
  private onWin?: (stats: GameStats) => void;
  private onEffectChange?: (effects: ActiveEffect[]) => void;
  private onSkillChange?: (cards: SkillCard[], activeSkills: ActiveSkill[]) => void;
  private onSound?: (name: string) => void;
  private onSkillGranted?: (card: SkillCard) => void;
  private timeStopUntil: number = 0; // Date.now() timestamp for timeStop end

  // Phase 20: 新模式状态
  private timeLimitEndAt: number = 0; // timelimit mode end timestamp
  private survivalInterval: number = SURVIVAL_BASE_INTERVAL; // survival mode current speed
  private royaleBorder: number = 0; // royale mode border inset (cells)
  private royaleLastShrink: number = 0; // last shrink timestamp

  // callbacks for new modes
  private onTimerTick?: (remainingSec: number) => void;
  private onBorderChange?: (border: number) => void;

  constructor() {
    this.snakes = [this.createSnakeInstance()];
    this.foodManager = new FoodManager();
    this.maze = new Maze();
    this.trailManager = new TrailManager();
    this.state = 'IDLE';
    this.mode = 'classic';
  }

  private createSnakeInstance(startOpts?: { startX?: number; startY?: number; direction?: Direction; id?: string }): SnakeInstance {
    return {
      snake: new Snake(startOpts),
      score: new Score(),
      activeEffects: [],
      skillCards: [],
      activeSkills: [],
      skillManager: new SkillManager(),
    };
  }

  /** 绑定回调 */
  bindRender(cb: () => void): void { this.onRender = cb; }
  bindScoreChange(cb: (primary: number, secondary?: number) => void): void { this.onScoreChange = cb; }
  bindSpeedChange(cb: (l: number) => void): void { this.onSpeedChange = cb; }
  bindGameOver(cb: (stats: GameStats) => void): void { this.onGameOver = cb; }
  bindWin(cb: (stats: GameStats) => void): void { this.onWin = cb; }
  bindEffectChange(cb: (effects: ActiveEffect[]) => void): void { this.onEffectChange = cb; }
  bindSkillChange(cb: (cards: SkillCard[], activeSkills: ActiveSkill[]) => void): void { this.onSkillChange = cb; }
  bindSound(cb: (name: string) => void): void { this.onSound = cb; }
  bindSkillGranted(cb: (card: SkillCard) => void): void { this.onSkillGranted = cb; }
  bindTimerTick(cb: (remainingSec: number) => void): void { this.onTimerTick = cb; }
  bindBorderChange(cb: (border: number) => void): void { this.onBorderChange = cb; }

  get snakeRefs(): Snake[] { return this.snakes.map(s => s.snake); }
  get primarySnake(): Snake { return this.snakes[0].snake; }
  get secondarySnake(): Snake | null { return this.snakes.length > 1 ? this.snakes[1].snake : null; }
  get primaryScore(): Score { return this.snakes[0].score; }
  get primaryEffects(): ActiveEffect[] { return this.snakes[0].activeEffects; }
  get primarySkillCards(): SkillCard[] { return this.snakes[0].skillCards; }
  get primaryActiveSkills(): ActiveSkill[] { return this.snakes[0].activeSkills; }
  get foodManagerRef(): FoodManager { return this.foodManager; }
  get mazeRef(): Maze { return this.maze; }
  get trailWallsRef(): { x: number; y: number }[] { return this.trailManager.toArray(); }
  get isTimeStopped(): boolean { return Date.now() < this.timeStopUntil; }
  get timeLimitRemaining(): number { return Math.max(0, Math.ceil((this.timeLimitEndAt - Date.now()) / 1000)); }
  get currentRoyaleBorder(): number { return this.royaleBorder; }
  get currentSurvivalInterval(): number { return this.survivalInterval; }

  setMode(mode: GameMode): void {
    this.mode = mode;
  }

  start(): void {
    if (this.mode === 'dual') {
      this.snakes = [
        this.createSnakeInstance({ startX: Math.floor(GRID_COLS / 4), startY: Math.floor(GRID_ROWS / 2), direction: 'RIGHT', id: 'snake1' }),
        this.createSnakeInstance({ startX: Math.floor(GRID_COLS * 3 / 4), startY: Math.floor(GRID_ROWS / 2), direction: 'LEFT', id: 'snake2' }),
      ];
    } else {
      this.snakes = [this.createSnakeInstance()];
    }
    this.trailManager.reset();
    this.maze.obstacles = [];
    if (this.mode === 'maze') {
      this.maze.generate(this.snakes[0].snake.head, this.snakes[0].snake.occupy.bind(this.snakes[0].snake));
    }
    this.foodManager.init(this.totalOccupied.bind(this));
    this.state = 'RUNNING';
    this.gameStartTime = Date.now();
    this.foodsEaten = 0;
    this.maxSpeed = 1;
    this.skillsUsed = 0;
    // Phase 20: init mode state
    this.timeLimitEndAt = this.mode === 'timelimit' ? Date.now() + TIMELIMIT_DURATION * 1000 : 0;
    this.survivalInterval = SURVIVAL_BASE_INTERVAL;
    this.royaleBorder = 0;
    this.royaleLastShrink = Date.now();
    this.onScoreChange?.(this.snakes[0].score.current, this.snakes[1]?.score.current);
    this.onSpeedChange?.(1);
    this.onEffectChange?.([]);
    this.onSkillChange?.([], []);
    if (this.mode === 'timelimit') this.onTimerTick?.(TIMELIMIT_DURATION);
    if (this.mode === 'royale') this.onBorderChange?.(0);
    this.scheduleNext();
  }

  pause(): void {
    if (this.state !== 'RUNNING') return;
    this.state = 'PAUSED';
    if (this.loopId != null) { cancelAnimationFrame(this.loopId); this.loopId = null; }
  }

  resume(): void {
    if (this.state !== 'PAUSED') return;
    this.state = 'RUNNING';
    this.scheduleNext();
  }

  togglePause(): void {
    if (this.state === 'RUNNING') this.pause();
    else if (this.state === 'PAUSED') this.resume();
  }

  /** 设置主蛇方向 */
  setDirection(dir: string): void {
    if (this.state !== 'RUNNING') return;
    this.snakes[0].snake.setDirection(dir as Direction);
    // 双蛇模式：镜像方向
    if (this.mode === 'dual' && this.snakes.length > 1) {
      this.snakes[1].snake.setDirection(SkillManager.mirrorDirection(dir) as Direction);
    }
  }

  /** 使用技能卡（按槽位索引 0/1/2） */
  useSkill(slotIndex: number): void {
    if (this.state !== 'RUNNING') return;
    const inst = this.snakes[0];
    const card = inst.skillCards[slotIndex];
    if (!card) return;
    this.skillsUsed++;
    // 镜像翻转是瞬发
    if (card.type === 'mirrorFlip') {
      inst.skillCards.splice(slotIndex, 1);
      const flipped = SkillManager.flipDirection(inst.snake.direction) as Direction;
      inst.snake.setDirection(flipped);
      this.onSound?.('special');
      this.onSkillChange?.(inst.skillCards, inst.activeSkills);
      return;
    }
    // 时间暂停：冻结游戏2秒，玩家可规划路径
    if (card.type === 'timeStop') {
      inst.skillCards.splice(slotIndex, 1);
      this.timeStopUntil = Date.now() + 2000;
      this.onSound?.('special');
      this.onSkillChange?.(inst.skillCards, inst.activeSkills);
      return;
    }
    const active = SkillManager.useCard(inst.skillCards, slotIndex);
    if (active) {
      // 分数翻倍
      if (active.type === 'doubleScore') inst.score.multiplier = 2;
      inst.activeSkills.push(active);
      this.onSound?.('special');
      this.onSkillChange?.(inst.skillCards, inst.activeSkills);
    }
  }

  /** 综合占位：蛇身 + 食物 + 迷宫障碍 + trail墙壁 */
  private totalOccupied(x: number, y: number): boolean {
    const inSnake = this.snakes.some(s => s.snake.occupy(x, y));
    return inSnake || this.foodManager.isOccupied(x, y) || this.maze.isObstacle(x, y) || this.trailManager.isWall(x, y);
  }

  /** 获取所有障碍物（迷宫 + trail） */
  private allObstacles(): { x: number; y: number }[] {
    const obs = [...this.maze.obstacles];
    if (this.mode === 'trail') {
      obs.push(...this.trailManager.toArray());
    }
    return obs;
  }

  /** 碰撞检测（考虑技能） */
  private checkCollision(inst: SnakeInstance): boolean {
    const snake = inst.snake;
    const isWallPass = SkillManager.isActive(inst.activeSkills, 'wallPass');
    const isGhost = SkillManager.isActive(inst.activeSkills, 'ghost');
    // 墙壁
    if (!isWallPass && Collision.wall(snake.head)) return true;
    // Phase 20: 大逃杀边界
    if (!isWallPass && this.mode === 'royale' && this.royaleBorder > 0) {
      const b = this.royaleBorder;
      if (snake.head.x < b || snake.head.x >= GRID_COLS - b || snake.head.y < b || snake.head.y >= GRID_ROWS - b) return true;
    }
    // 自身
    if (!isGhost && Collision.self(snake)) return true;
    // 迷宫障碍物
    if (!isWallPass && Collision.obstacle(snake.head, this.maze.obstacles)) return true;
    // trail墙壁
    if (!isWallPass && this.mode === 'trail' && this.trailManager.isWall(snake.head.x, snake.head.y)) return true;
    // 蛇-蛇碰撞（双蛇模式）
    if (this.snakes.length > 1) {
      for (const other of this.snakes) {
        if (other === inst) continue;
        if (!isGhost && Collision.snakeVsSnake(snake, other.snake)) return true;
      }
    }
    return false;
  }

  /** 应用食物效果 */
  private applyEffect(inst: SnakeInstance, item: FoodItem): void {
    const now = Date.now();
    switch (item.type) {
      case 'frozen':
        inst.activeEffects = inst.activeEffects.filter(e => e.type !== 'frozen');
        inst.activeEffects.push({ type: 'frozen', expiresAt: now + 5000 });
        inst.activeEffects = inst.activeEffects.filter(e => e.type !== 'lightning');
        inst.score.setSpeedModifier(100);
        this.onSound?.('special');
        break;
      case 'lightning':
        inst.activeEffects = inst.activeEffects.filter(e => e.type !== 'lightning');
        inst.activeEffects.push({ type: 'lightning', expiresAt: now + 10000 });
        inst.activeEffects = inst.activeEffects.filter(e => e.type !== 'frozen');
        inst.score.setSpeedModifier(-50);
        this.onSound?.('special');
        break;
      case 'bomb':
        inst.snake.shrink(3);
        this.onSound?.('bomb');
        break;
      case 'gold':
      case 'diamond':
        this.onSound?.('special');
        break;
      default:
        this.onSound?.('eat');
    }
  }

  /** 检查并清除过期效果 */
  private checkEffects(inst: SnakeInstance): void {
    const now = Date.now();
    const before = inst.activeEffects.length;
    inst.activeEffects = inst.activeEffects.filter(e => now < e.expiresAt);
    if (inst.activeEffects.length !== before) {
      const hasFrozen = inst.activeEffects.some(e => e.type === 'frozen');
      const hasLightning = inst.activeEffects.some(e => e.type === 'lightning');
      inst.score.setSpeedModifier(hasFrozen ? 100 : hasLightning ? -50 : 0);
      this.onEffectChange?.(inst.activeEffects);
    }
    // 清除过期技能
    const prevLen = inst.activeSkills.length;
    inst.activeSkills = SkillManager.cleanExpired(inst.activeSkills);
    if (inst.activeSkills.length !== prevLen) {
      // 检查分数翻倍是否到期
      if (!SkillManager.isActive(inst.activeSkills, 'doubleScore')) {
        inst.score.multiplier = 1;
      }
      this.onSkillChange?.(inst.skillCards, inst.activeSkills);
    }
  }

  /** 磁铁效果：拉近食物 */
  private magnetPull(inst: SnakeInstance): void {
    if (!SkillManager.isActive(inst.activeSkills, 'magnet')) return;
    const head = inst.snake.head;
    for (const item of this.foodManager.items) {
      const dx = head.x - item.position.x;
      const dy = head.y - item.position.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > 1 && dist <= 5) {
        // 朝蛇头方向移动一格
        if (Math.abs(dx) >= Math.abs(dy)) {
          item.position.x += dx > 0 ? 1 : -1;
        } else {
          item.position.y += dy > 0 ? 1 : -1;
        }
      }
    }
  }

  private tick(): void {
    // 时间暂停：不移动、不更新食物/效果，只渲染并继续调度
    if (Date.now() < this.timeStopUntil) {
      this.onRender?.();
      return;
    }

    // Phase 20: 限时模式 — 检查时间
    if (this.mode === 'timelimit') {
      const remaining = this.timeLimitRemaining;
      this.onTimerTick?.(remaining);
      if (remaining <= 0) {
        this.state = 'GAME_OVER';
        this.onSound?.('collision');
        this.onGameOver?.(this.buildStats());
        return;
      }
    }

    // Phase 20: 生存模式 — 持续加速
    if (this.mode === 'survival') {
      this.survivalInterval = Math.max(SURVIVAL_MIN_INTERVAL, SURVIVAL_BASE_INTERVAL - this.foodsEaten * SURVIVAL_SPEED_INCREASE);
    }

    // Phase 20: 大逃杀模式 — 定期缩小边界
    if (this.mode === 'royale') {
      const now = Date.now();
      if (now - this.royaleLastShrink >= ROYALE_SHRINK_INTERVAL) {
        this.royaleBorder += ROYALE_SHRINK_AMOUNT;
        this.royaleLastShrink = now;
        this.onBorderChange?.(this.royaleBorder);
        this.onSound?.('special');
      }
    }

    // 先移动所有蛇
    for (const inst of this.snakes) {
      inst.snake.move();
    }

    // 碰撞检测
    for (const inst of this.snakes) {
      this.checkEffects(inst);
      if (this.checkCollision(inst)) {
        this.state = 'GAME_OVER';
        this.onSound?.('collision');
        this.onGameOver?.(this.buildStats());
        return;
      }
    }

    // 处理每条蛇的食物和效果
    for (const inst of this.snakes) {
      this.magnetPull(inst);
      const idx = this.foodManager.findAt(inst.snake.head.x, inst.snake.head.y);
      if (idx >= 0) {
        const item = this.foodManager.items[idx];
        const cfg = FOOD_CONFIG[item.type];
        inst.snake.grow();
        inst.score.add(cfg.score);
        this.foodsEaten++;
        if (inst.score.speedLevel > this.maxSpeed) this.maxSpeed = inst.score.speedLevel;
        this.applyEffect(inst, item);
        // 技能卡（仅主蛇获得，双蛇模式避免混乱）
        if (inst === this.snakes[0]) {
          const granted = inst.skillManager.tryGrant(inst.skillCards);
          if (granted) {
            this.onSkillGranted?.(granted);
            this.onSkillChange?.(inst.skillCards, inst.activeSkills);
          }
        }
        this.onScoreChange?.(this.snakes[0].score.current, this.snakes[1]?.score.current);
        this.onSpeedChange?.(this.snakes[0].score.speedLevel);
        this.onEffectChange?.(inst.activeEffects);
        this.foodManager.removeAt(idx);
        const ok = this.foodManager.spawnOne(this.totalOccupied.bind(this));
        if (!ok && this.foodManager.items.length === 0) {
          this.state = 'WIN';
          this.onWin?.(this.buildStats());
          return;
        }
      }
    }

    // trail模式：记录蛇尾为墙壁
    if (this.mode === 'trail') {
      const snakeBodies = new Set<string>();
      for (const s of this.snakes) {
        for (const p of s.snake.body) snakeBodies.add(`${p.x},${p.y}`);
      }
      for (const inst of this.snakes) {
        const tail = inst.snake.body[inst.snake.body.length - 1];
        this.trailManager.recordTail(tail, snakeBodies);
      }
    }

    this.foodManager.update(this.totalOccupied.bind(this));
    this.onRender?.();
    // Phase 5: gameLoop handles scheduling via rAF
  }

  private totalScore(): number {
    return this.snakes.reduce((sum, s) => sum + s.score.current, 0);
  }

  /** Phase 2: 构建游戏统计 */
  private buildStats(): GameStats {
    const score = this.totalScore();
    const duration = Math.round((Date.now() - this.gameStartTime) / 1000);
    const prevHigh = Number(localStorage.getItem('snake_high_score') || '0');
    const isNewRecord = score > prevHigh;
    if (isNewRecord) localStorage.setItem('snake_high_score', String(score));
    return { score, duration, foodsEaten: this.foodsEaten, maxSpeed: this.maxSpeed, skillsUsed: this.skillsUsed, isNewRecord };
  }

  private scheduleNext(): void {
    if (this.state !== 'RUNNING') return;
    this.lastFrameTime = performance.now();
    this.accumulated = 0;
    this.loopId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  /** Phase 5: rAF-based game loop with accumulated time */
  private gameLoop(timestamp: number): void {
    if (this.state !== 'RUNNING') return;
    // Phase 20: survival mode uses dynamic interval
    const interval = this.mode === 'survival' ? this.survivalInterval : this.snakes[0].score.interval;
    const delta = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    this.accumulated += delta;

    // Process ticks that should have happened
    while (this.accumulated >= interval) {
      this.accumulated -= interval;
      if (this.state !== 'RUNNING') return;
      this.tick();
    }

    this.loopId = requestAnimationFrame((t) => this.gameLoop(t));
  }
}
