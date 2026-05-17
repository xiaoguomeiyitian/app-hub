// Web Audio API 音效管理器
export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  init(): void {
    if (this.ctx) return;
    try { this.ctx = new AudioContext(); } catch { /* ignore */ }
  }

  toggle(): void { this.enabled = !this.enabled; }
  isEnabled(): boolean { return this.enabled; }

  private beep(freq: number, duration: number, type: OscillatorType = 'square', vol = 0.15): void {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  reveal(): void { this.beep(600, 0.06, 'sine', 0.1); }
  flag(): void { this.beep(440, 0.1, 'triangle', 0.15); }
  mine(): void { this.beep(150, 0.4, 'sawtooth', 0.2); }
  win(): void {
    if (!this.enabled || !this.ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.beep(f, 0.2, 'sine', 0.15), i * 120);
    });
  }
}
