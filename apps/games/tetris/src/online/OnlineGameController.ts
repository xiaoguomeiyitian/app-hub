import { OnlineClient } from './OnlineClient.js';
import { EndlessMode } from '../modes/EndlessMode.js';
import { Bag } from '../core/Bag.js';
import { CanvasRenderer } from '../render/CanvasRenderer.js';
import type { ClearResult } from '../types.js';

/**
 * 联机对局控制器（俄罗斯方块）
 */
export class OnlineGameController {
  private client: OnlineClient;
  private renderer: CanvasRenderer;
  private mode: EndlessMode | null = null;
  private timer: number | null = null;
  private _active = false;
  private statusEl: HTMLElement;
  private scoreEl: HTMLElement;
  private linesEl: HTMLElement;
  private levelEl: HTMLElement;
  private comboEl: HTMLElement;
  private b2bEl: HTMLElement;
  private pendingGarbage = 0;
  private onGameOver: ((winner: string) => void) | null = null;

  constructor(
    client: OnlineClient,
    renderer: CanvasRenderer,
    statusEl: HTMLElement,
    scoreEl: HTMLElement,
    linesEl: HTMLElement,
    levelEl: HTMLElement,
    comboEl: HTMLElement,
    b2bEl: HTMLElement,
  ) {
    this.client = client;
    this.renderer = renderer;
    this.statusEl = statusEl;
    this.scoreEl = scoreEl;
    this.linesEl = linesEl;
    this.levelEl = levelEl;
    this.comboEl = comboEl;
    this.b2bEl = b2bEl;
    this.bindEvents();
  }

  get active(): boolean { return this._active; }

  setOnGameOver(cb: (winner: string) => void): void { this.onGameOver = cb; }

  /** 启动联机游戏 */
  start(): void {
    this._active = true;
    this.pendingGarbage = 0;
    this.mode = new EndlessMode();
    this.mode.bag = new Bag(5);
    this.statusEl.textContent = '游戏开始！';
    this.render();
    this.startTimer();
  }

  /** 停止联机游戏 */
  stop(): void {
    this._active = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  /** 处理用户动作 */
  handleAction(action: string): void {
    if (!this._active || !this.mode || this.mode.gameOver) return;
    if (action === 'pause') return;

    const result = this.mode.handleAction(action);

    // 硬降时通知服务端
    if (action === 'hardDrop' && result) {
      this.reportLock(result);
    }

    // 检测 game over
    if (this.mode.gameOver) {
      this.stop();
      this.statusEl.textContent = '💀 你被顶出了！';
      this.client.send('game:topped', {});
    }

    this.updateStats();
    this.render();
  }

  /** 自然下落 tick */
  private tick(): void {
    if (!this._active || !this.mode || this.mode.gameOver || this.mode.paused) return;

    const result = this.mode.tick();

    if (result) {
      this.reportLock(result);
    }

    if (this.mode.gameOver) {
      this.stop();
      this.statusEl.textContent = '💀 你被顶出了！';
      this.client.send('game:topped', {});
    }

    this.updateStats();
    this.render();

    if (this.timer && this.mode) {
      clearInterval(this.timer);
      this.startTimer();
    }
  }

  /** 向服务端报告锁定 */
  private reportLock(result: ClearResult): void {
    // 应用待处理垃圾行
    if (this.pendingGarbage > 0 && this.mode) {
      this.mode.garbage.receive(this.pendingGarbage);
      this.pendingGarbage = 0;
    }

    const tspin = result.type.includes('tspin')
      ? (result.type.includes('mini') ? 'mini' : 'full')
      : 'none';

    this.client.send('game:lock', {
      linesCleared: result.linesCleared,
      tspin,
    });

    if (result.totalAttack > 0) {
      this.statusEl.textContent = `⚔️ 发送 ${result.totalAttack} 行攻击！`;
    }
  }

  private render(): void {
    if (!this.mode) return;
    this.renderer.render(this.mode.getState(), this.mode.getGhostY());
  }

  private updateStats(): void {
    if (!this.mode) return;
    this.scoreEl.textContent = String(this.mode.score);
    this.linesEl.textContent = String(this.mode.lines);
    this.levelEl.textContent = String(this.mode.level);
    this.comboEl.textContent = String(this.mode.combo);
    this.b2bEl.textContent = String(this.mode.b2b);
  }

  private startTimer(): void {
    if (this.timer) clearInterval(this.timer);
    const interval = this.mode?.getDropInterval() ?? 800;
    this.timer = window.setInterval(() => this.tick(), interval);
  }

  private bindEvents(): void {
    this.client.on('game:started', (data: unknown) => {
      if (!this._active) return;
      const d = data as { bag: number[] };
      if (this.mode) {
        this.mode.bag.resetWithSeed(d.bag);
        this.mode.board.reset();
        // 重新 spawn 一个块 - 通过读取 bag 第一个
        const type = this.mode.bag.next();
        this.mode.current = this.mode.createPiece(type);
        this.mode.next = this.mode.bag.peek(5);
        this.mode.hold = null;
        this.mode.canHold = true;
        this.mode.gameOver = false;
        this.mode.score = 0;
        this.mode.lines = 0;
        this.mode.level = 1;
        this.mode.combo = 0;
        this.mode.b2b = 0;
        this.render();
      }
    });

    this.client.on('game:next_bag', (data: unknown) => {
      if (!this._active || !this.mode) return;
      const d = data as { bag: number[] };
      this.mode.bag.appendSeed(d.bag);
      this.mode.next = this.mode.bag.peek(5);
    });

    this.client.on('game:garbage_received', (data: unknown) => {
      if (!this._active || !this.mode) return;
      const d = data as { lines: number };
      this.pendingGarbage += d.lines;
      this.statusEl.textContent = `⚠️ 收到 ${d.lines} 行垃圾！`;
    });

    this.client.on('game:opponent_topped', () => {
      if (!this._active) return;
      this.statusEl.textContent = '🎉 对手被顶出！你赢了！';
    });

    this.client.on('game:over', (data: unknown) => {
      if (!this._active) return;
      const d = data as { winner: string };
      this.stop();
      this.onGameOver?.(d.winner);
    });

    this.client.on('room:opponent_left', () => {
      if (!this._active) return;
      this.statusEl.textContent = '⚠️ 对手已离开';
    });
  }
}
