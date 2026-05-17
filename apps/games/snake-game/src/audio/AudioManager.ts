/** 音效管理器 — HTMLAudioElement + Web Audio API 音阶 */

type SoundName = 'eat' | 'collision' | 'special' | 'bomb' | 'bgm';

const SOUND_FILES: Record<SoundName, string> = {
  eat: '/assets/sounds/eat.mp3',
  collision: '/assets/sounds/collision.mp3',
  special: '/assets/sounds/special.mp3',
  bomb: '/assets/sounds/bomb.mp3',
  bgm: '/assets/sounds/bgm.mp3',
};

// Phase 9: 音阶频率 (C D E F G A B C5)
const NOTE_FREQS: Record<string, number> = {
  C: 261.63, D: 293.66, E: 329.63, F: 349.23,
  G: 392.00, A: 440.00, B: 493.88, C5: 523.25,
};
const SCALE = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C5'];

export class AudioManager {
  private sounds: Partial<Record<SoundName, HTMLAudioElement>> = {};
  muted = false;
  private audioCtx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxVolume = 0.5;
  private bgmVolume = 0.3;

  constructor() {
    for (const [name, src] of Object.entries(SOUND_FILES) as [SoundName, string][]) {
      try {
        const audio = new Audio();
        audio.src = src;
        audio.preload = 'auto';
        audio.volume = name === 'bgm' ? 0.3 : 0.5;
        if (name === 'bgm') audio.loop = true;
        audio.addEventListener('error', () => { /* ignore */ });
        this.sounds[name] = audio;
      } catch {
        /* ignore */
      }
    }
  }

  /** 初始化 Web Audio API（需用户交互后调用） */
  private initAudioCtx(): void {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sfxGain = this.audioCtx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.audioCtx.destination);
      this.bgmGain = this.audioCtx.createGain();
      this.bgmGain.gain.value = this.bgmVolume;
      this.bgmGain.connect(this.audioCtx.destination);
    } catch {
      /* ignore */
    }
  }

  play(name: SoundName): void {
    if (this.muted) return;
    this.initAudioCtx();
    // Phase 9: 吃食物用音阶
    if (name === 'eat') {
      this.playEatNote();
      return;
    }
    const audio = this.sounds[name];
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play().catch(() => { /* ignore */ });
    } catch {
      /* ignore */
    }
  }

  /** Phase 9: 播放碰撞低沉音 */
  playCollision(): void {
    if (this.muted) return;
    this.initAudioCtx();
    if (!this.audioCtx || !this.sfxGain) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.4);
    } catch { /* ignore */ }
  }

  /** Phase 9: 播放音阶音符（随分数升高） */
  private eatNoteIndex = 0;

  playEatNote(): void {
    if (!this.audioCtx || !this.sfxGain) return;
    try {
      const note = SCALE[this.eatNoteIndex % SCALE.length];
      this.eatNoteIndex++;
      const freq = NOTE_FREQS[note];
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.15);
    } catch { /* ignore */ }
  }

  /** Phase 9: 技能魔法音效 */
  playSkillSound(): void {
    if (this.muted) return;
    this.initAudioCtx();
    if (!this.audioCtx || !this.sfxGain) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1047, this.audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.3);
    } catch { /* ignore */ }
  }

  /** 重置音阶索引 */
  resetNoteIndex(): void {
    this.eatNoteIndex = 0;
  }

  stop(name: SoundName): void {
    const audio = this.sounds[name];
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.muted) {
      this.stop('bgm');
      if (this.sfxGain) this.sfxGain.gain.value = 0;
      if (this.bgmGain) this.bgmGain.gain.value = 0;
    } else {
      if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
      if (this.bgmGain) this.bgmGain.gain.value = this.bgmVolume;
    }
  }

  /** Phase 14: 设置音量 */
  setVolume(type: 'sfx' | 'bgm', volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (type === 'sfx') {
      this.sfxVolume = clamped * 0.5;
      if (this.sfxGain && !this.muted) this.sfxGain.gain.value = this.sfxVolume;
      for (const [name, audio] of Object.entries(this.sounds)) {
        if (audio && name !== 'bgm') audio.volume = this.sfxVolume;
      }
    } else {
      this.bgmVolume = clamped * 0.3;
      if (this.bgmGain && !this.muted) this.bgmGain.gain.value = this.bgmVolume;
      const bgm = this.sounds.bgm;
      if (bgm) bgm.volume = this.bgmVolume;
    }
  }
}
