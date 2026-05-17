/** 键盘输入处理 + DAS */
export class KeyHandler {
  private onAction: (action: string) => void;
  private das = 100; // ms
  const_arr = 30; // ms
  private timers: Map<string, number> = new Map();
  private pressed: Set<string> = new Set();

  constructor(onAction: (action: string) => void) {
    this.onAction = onAction;
    this.bind();
  }

  private bind(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const key = this.mapKey(e.code);
      if (!key) return;
      e.preventDefault();
      this.pressed.add(key);
      this.handlePress(key);
    });

    window.addEventListener('keyup', (e) => {
      const key = this.mapKey(e.code);
      if (!key) return;
      this.pressed.delete(key);
      this.clearTimer(key);
    });
  }

  private mapKey(code: string): string | null {
    switch (code) {
      case 'ArrowLeft': return 'left';
      case 'ArrowRight': return 'right';
      case 'ArrowDown': return 'softDrop';
      case 'ArrowUp': return 'rotateCW';
      case 'KeyZ': return 'rotateCCW';
      case 'KeyX': return 'rotateCW';
      case 'Space': return 'hardDrop';
      case 'KeyC': case 'ShiftLeft': case 'ShiftRight': return 'hold';
      case 'KeyP': return 'pause';
      default: return null;
    }
  }

  private handlePress(key: string): void {
    // 立即触发一次
    this.onAction(key);

    // DAS: 按住时自动重复
    if (key === 'left' || key === 'right' || key === 'softDrop') {
      this.clearTimer(key);
      const timer = window.setTimeout(() => {
        const repeatTimer = window.setInterval(() => {
          if (this.pressed.has(key)) {
            this.onAction(key);
          } else {
            this.clearTimer(key);
          }
        }, this.const_arr);
        this.timers.set(key, repeatTimer as unknown as number);
      }, this.das);
      this.timers.set(key, timer);
    }
  }

  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      clearInterval(timer);
      this.timers.delete(key);
    }
  }

  destroy(): void {
    for (const [, timer] of this.timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers.clear();
  }
}
