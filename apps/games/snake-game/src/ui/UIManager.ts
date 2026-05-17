import type { GameMode, ActiveEffect, SkillCard, ActiveSkill } from '../types';
import { SKILL_CONFIG } from '../config/constants';

export class UIManager {
  private scoreEl: HTMLElement | null;
  private highScoreEl: HTMLElement | null;
  private speedEl: HTMLElement | null;
  private overlay: HTMLElement | null;
  private menuMessage: HTMLElement | null;
  private startBtn: HTMLButtonElement | null;
  private finalScoreWrap: HTMLElement | null;
  private finalScoreValue: HTMLElement | null;
  private pauseOverlay: HTMLElement | null;
  private effectIndicator: HTMLElement | null;
  private muteBtn: HTMLButtonElement | null;
  private modeBtns: Map<GameMode, HTMLButtonElement | null>;
  private skillSlotsEl: HTMLElement | null;
  private dualScoreEl: HTMLElement | null;
  private onlineStatusEl: HTMLElement | null;
  private onlineRoomInfoEl: HTMLElement | null;
  private onlinePanelEl: HTMLElement | null;
  private modeTimerEl: HTMLElement | null;
  private modeBorderEl: HTMLElement | null;

  constructor() {
    this.scoreEl = document.getElementById('score');
    this.highScoreEl = document.getElementById('high-score');
    this.speedEl = document.getElementById('speed');
    this.overlay = document.getElementById('overlay');
    this.menuMessage = document.getElementById('menu-message');
    this.startBtn = document.getElementById('start-btn') as HTMLButtonElement | null;
    this.finalScoreWrap = document.getElementById('final-score');
    this.finalScoreValue = document.getElementById('final-score-value');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.effectIndicator = document.getElementById('effect-indicator');
    this.muteBtn = document.getElementById('mute-btn') as HTMLButtonElement | null;
    this.skillSlotsEl = document.getElementById('skill-slots');
    this.dualScoreEl = document.getElementById('dual-score');
    this.onlineStatusEl = document.getElementById('online-status');
    this.onlineRoomInfoEl = document.getElementById('online-room-info');
    this.onlinePanelEl = document.getElementById('online-panel');
    this.modeTimerEl = document.getElementById('mode-timer');
    this.modeBorderEl = document.getElementById('mode-border');

    this.modeBtns = new Map();
    for (const mode of ['classic', 'maze', 'trail', 'dual', 'timelimit', 'survival', 'royale'] as GameMode[]) {
      this.modeBtns.set(mode, document.getElementById(`mode-${mode}`) as HTMLButtonElement | null);
    }
  }

  updateScore(score: number): void {
    if (this.scoreEl) this.scoreEl.textContent = String(score);
  }

  updateDualScore(primary: number, secondary?: number): void {
    if (!this.dualScoreEl) return;
    if (secondary != null) {
      this.dualScoreEl.textContent = `蛇1: ${primary}  蛇2: ${secondary}  总分: ${primary + secondary}`;
      this.dualScoreEl.classList.remove('hidden');
    } else {
      this.dualScoreEl.classList.add('hidden');
    }
  }

  updateHighScore(high: number): void {
    if (this.highScoreEl) this.highScoreEl.textContent = String(high);
  }

  updateSpeed(level: number): void {
    if (this.speedEl) this.speedEl.textContent = String(level);
  }

  updateEffects(effects: ActiveEffect[]): void {
    if (!this.effectIndicator) return;
    const texts: string[] = [];
    for (const e of effects) {
      if (e.type === 'frozen') texts.push('❄️ 冰冻减速中');
      if (e.type === 'lightning') texts.push('⚡ 闪电加速中');
    }
    this.effectIndicator.textContent = texts.join('  ');
  }

  updateSkillSlots(cards: SkillCard[], activeSkills: ActiveSkill[]): void {
    if (!this.skillSlotsEl) return;
    const now = Date.now();
    const parts: string[] = [];
    for (let i = 0; i < 3; i++) {
      if (cards[i]) {
        const cfg = SKILL_CONFIG[cards[i].type];
        parts.push(`<span class="skill-slot filled" title="${cfg.description}">${cfg.emoji} [${i + 1}] ${cfg.name}</span>`);
      } else {
        parts.push(`<span class="skill-slot empty">[${i + 1}] 空</span>`);
      }
    }
    for (const sk of activeSkills) {
      const cfg = SKILL_CONFIG[sk.type];
      const remaining = Math.max(0, Math.ceil((sk.expiresAt - now) / 1000));
      parts.push(`<span class="skill-active">${cfg.emoji} ${cfg.name} ${remaining}s</span>`);
    }
    this.skillSlotsEl.innerHTML = parts.join('');
  }

  setActiveMode(mode: GameMode): void {
    for (const [m, btn] of this.modeBtns) {
      btn?.classList.toggle('active', m === mode);
    }
  }

  setMuted(muted: boolean): void {
    if (this.muteBtn) this.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  setOnlineStatus(text: string): void {
    if (this.onlineStatusEl) this.onlineStatusEl.textContent = text;
  }

  setOnlineRoomInfo(text: string): void {
    if (!this.onlineRoomInfoEl) return;
    this.onlineRoomInfoEl.textContent = text;
    this.onlineRoomInfoEl.classList.remove('hidden');
  }

  showOnlinePanel(): void {
    this.onlinePanelEl?.classList.remove('hidden');
  }

  hideOnlinePanel(): void {
    this.onlinePanelEl?.classList.add('hidden');
  }

  showMenu(message?: string, finalScore?: number): void {
    this.overlay?.classList.add('visible');
    this.pauseOverlay?.classList.add('hidden');
    if (message && this.menuMessage) this.menuMessage.textContent = message;
    if (finalScore != null) {
      this.finalScoreWrap?.classList.remove('hidden');
      if (this.finalScoreValue) this.finalScoreValue.textContent = String(finalScore);
      if (this.startBtn) this.startBtn.textContent = '重新开始';
    } else {
      this.finalScoreWrap?.classList.add('hidden');
      if (this.startBtn) this.startBtn.textContent = '开始游戏';
    }
  }

  hideMenu(): void { this.overlay?.classList.remove('visible'); }
  showPause(): void { this.pauseOverlay?.classList.remove('hidden'); }
  hidePause(): void { this.pauseOverlay?.classList.add('hidden'); }

  /** Phase 2: 显示自定义覆盖层内容 */
  showCustomOverlay(html: string): void {
    if (!this.overlay) return;
    // Replace the inner content of overlay
    this.overlay.innerHTML = `<div id="menu">${html}</div>`;
    this.overlay.classList.add('visible');
    this.pauseOverlay?.classList.add('hidden');
  }

  onStart(cb: () => void): void {
    if (!this.startBtn) return;
    let handled = false;
    const handler = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (handled) return;
      handled = true;
      cb();
      window.setTimeout(() => {
        handled = false;
      }, 250);
    };
    this.startBtn.addEventListener('click', handler);
    this.startBtn.addEventListener('pointerup', handler);
    this.startBtn.addEventListener('touchend', handler, { passive: false });
  }

  onModeChange(cb: (mode: GameMode) => void): void {
    for (const [mode, btn] of this.modeBtns) {
      btn?.addEventListener('click', () => cb(mode));
    }
  }

  onMuteToggle(cb: () => void): void {
    this.muteBtn?.addEventListener('click', cb);
  }

  /** Phase 20: 限时模式倒计时 */
  updateTimer(remainingSec: number): void {
    if (!this.modeTimerEl) return;
    this.modeTimerEl.textContent = `⏱️ ${remainingSec}s`;
    this.modeTimerEl.classList.toggle('timer-warn', remainingSec <= 10);
    this.modeTimerEl.classList.remove('hidden');
  }

  hideTimer(): void {
    this.modeTimerEl?.classList.add('hidden');
  }

  /** Phase 20: 大逃杀边界 */
  updateBorder(border: number): void {
    if (!this.modeBorderEl) return;
    if (border > 0) {
      this.modeBorderEl.textContent = `⚔️ 边界 -${border}`;
      this.modeBorderEl.classList.remove('hidden');
    } else {
      this.modeBorderEl.classList.add('hidden');
    }
  }

  hideBorder(): void {
    this.modeBorderEl?.classList.add('hidden');
  }
}
