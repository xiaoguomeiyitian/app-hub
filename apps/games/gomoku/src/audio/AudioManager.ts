/**
 * 音效管理器
 * 使用 Web Audio API，加载失败时静默失败
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private enabled = true;

  /** 初始化 AudioContext（需用户交互后调用） */
  init(): void {
    try {
      this.context = new AudioContext();
    } catch {
      this.enabled = false;
    }
  }

  /** 加载音效文件 */
  async load(name: string, url: string): Promise<void> {
    if (!this.context || !this.enabled) return;
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.sounds.set(name, audioBuffer);
    } catch {
      // 静默失败
    }
  }

  /** 播放音效 */
  play(name: string): void {
    if (!this.context || !this.enabled) return;
    const buffer = this.sounds.get(name);
    if (!buffer) return;

    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.start();
    } catch {
      // 静默失败
    }
  }

  /** 销毁 */
  dispose(): void {
    this.context?.close();
    this.context = null;
    this.sounds.clear();
  }
}
