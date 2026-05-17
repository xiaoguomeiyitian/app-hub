import type { Direction } from '../types';

type KeyCallback = (dir: Direction) => void;
type ActionCallback = () => void;
type SkillCallback = (slot: number) => void;

export class InputHandler {
  private onDirection?: KeyCallback;
  private onTogglePause?: ActionCallback;
  private onSkill?: SkillCallback;
  private touchStartX = 0;
  private touchStartY = 0;
  private static readonly SWIPE_THRESHOLD = 20; // Phase 3: 降低阈值到 20px

  constructor() {
    window.addEventListener('keydown', this.handleKey.bind(this));
    window.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    window.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.bindDpad();
  }

  bindDirection(cb: KeyCallback): void { this.onDirection = cb; }
  bindPause(cb: ActionCallback): void { this.onTogglePause = cb; }
  bindSkill(cb: SkillCallback): void { this.onSkill = cb; }

  private handleKey(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W':
        e.preventDefault(); this.onDirection?.('UP'); break;
      case 'ArrowDown': case 's': case 'S':
        e.preventDefault(); this.onDirection?.('DOWN'); break;
      case 'ArrowLeft': case 'a': case 'A':
        e.preventDefault(); this.onDirection?.('LEFT'); break;
      case 'ArrowRight': case 'd': case 'D':
        e.preventDefault(); this.onDirection?.('RIGHT'); break;
      case ' ':
        e.preventDefault(); this.onTogglePause?.(); break;
      case '1': e.preventDefault(); this.onSkill?.(0); break;
      case '2': e.preventDefault(); this.onSkill?.(1); break;
      case '3': e.preventDefault(); this.onSkill?.(2); break;
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    // 不阻止任何交互元素的默认行为（按钮、输入框、选择器等）
    const target = e.target;
    if (target instanceof Element && target.closest('button, input, select, a, [role="button"]')) {
      return;
    }
    e.preventDefault();
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (e.changedTouches.length !== 1) return;
    // 不阻止任何交互元素的默认行为
    const target = e.target;
    if (target instanceof Element && target.closest('button, input, select, a, [role="button"]')) {
      return;
    }
    e.preventDefault();
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    // 只处理滑动方向，不处理点击暂停
    if (absDx < InputHandler.SWIPE_THRESHOLD && absDy < InputHandler.SWIPE_THRESHOLD) {
      return;  // 点击不触发任何操作
    }
    if (absDx > absDy) {
      this.onDirection?.(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      this.onDirection?.(dy > 0 ? 'DOWN' : 'UP');
    }
  }

  private bindDpad(): void {
    // 方向按钮
    document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
      const dir = (btn as HTMLElement).dataset.dir as Direction;
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.onDirection?.(dir); }, { passive: false });
      btn.addEventListener('mousedown', () => this.onDirection?.(dir));
    });
    // 暂停按钮
    const pauseBtn = document.getElementById('dpad-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.onTogglePause?.(); }, { passive: false });
      pauseBtn.addEventListener('mousedown', () => this.onTogglePause?.());
    }
    // 技能按钮
    document.querySelectorAll('.skill-btn[data-skill]').forEach(btn => {
      const slot = parseInt((btn as HTMLElement).dataset.skill || '0', 10);
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.onSkill?.(slot); }, { passive: false });
      btn.addEventListener('mousedown', () => this.onSkill?.(slot));
    });
  }
}
