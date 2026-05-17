import { OnlineClient } from '../online/OnlineClient.js';

/**
 * 联机大厅 UI（2048）
 */
export class OnlineLobby {
  private container: HTMLElement;
  private client: OnlineClient;
  private onStartGame: (() => void) | null = null;
  private lobbyEl: HTMLElement | null = null;
  private matchingEl: HTMLElement | null = null;
  private roomEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;

  constructor(container: HTMLElement, client: OnlineClient) {
    this.container = container;
    this.client = client;
    this.buildUI();
    this.bindEvents();
  }

  setOnStartGame(cb: () => void): void { this.onStartGame = cb; }

  show(): void {
    this.lobbyEl?.classList.remove('hidden');
    this.matchingEl?.classList.add('hidden');
    this.roomEl?.classList.add('hidden');
    this.updateConnectionStatus();
  }

  hide(): void {
    this.lobbyEl?.classList.add('hidden');
    this.matchingEl?.classList.add('hidden');
    this.roomEl?.classList.add('hidden');
  }

  setStatus(text: string): void { if (this.statusEl) this.statusEl.textContent = text; }

  private buildUI(): void {
    const div = document.createElement('div');
    div.id = 'g2048-online-lobby';
    div.className = 'g2048-online-lobby hidden';
    div.innerHTML = `
      <h2>🌐 联机对战</h2>
      <div id="g2048-conn" class="g2048-conn-status">🔴 未连接</div>
      <div class="g2048-lobby-btns">
        <button id="g2048-btn-match" class="g2048-btn primary">⚡ 快速匹配</button>
        <button id="g2048-btn-create" class="g2048-btn">🏠 创建房间</button>
        <div class="g2048-join-row">
          <input id="g2048-room-input" placeholder="房间号" maxlength="6" />
          <button id="g2048-btn-join" class="g2048-btn">加入</button>
        </div>
      </div>
      <div id="g2048-matching" class="g2048-matching hidden">
        <div class="g2048-spinner"></div>
        <p>匹配中...</p>
        <button id="g2048-btn-cancel" class="g2048-btn">取消</button>
      </div>
      <div id="g2048-room" class="g2048-room hidden">
        <p>房间号：<strong id="g2048-room-code"></strong> <button id="g2048-btn-copy" class="g2048-btn small">复制</button></p>
        <div id="g2048-player-list" class="g2048-player-list"></div>
        <button id="g2048-btn-room-start" class="g2048-btn primary hidden">开始游戏</button>
        <button id="g2048-btn-room-leave" class="g2048-btn">离开房间</button>
      </div>
      <div id="g2048-online-msg" class="g2048-online-msg"></div>
    `;
    this.container.appendChild(div);
    this.lobbyEl = div;
    this.matchingEl = document.getElementById('g2048-matching')!;
    this.roomEl = document.getElementById('g2048-room')!;
    this.statusEl = document.getElementById('g2048-online-msg')!;
  }

  private bindEvents(): void {
    document.getElementById('g2048-btn-match')?.addEventListener('click', () => {
      this.client.send('match:join');
      this.matchingEl?.classList.remove('hidden');
    });
    document.getElementById('g2048-btn-cancel')?.addEventListener('click', () => {
      this.client.send('match:cancel');
      this.matchingEl?.classList.add('hidden');
    });
    document.getElementById('g2048-btn-create')?.addEventListener('click', () => { this.client.send('room:create'); });
    document.getElementById('g2048-btn-join')?.addEventListener('click', () => {
      const input = document.getElementById('g2048-room-input') as HTMLInputElement;
      const roomId = input.value.trim();
      if (roomId) this.client.send('room:join', { roomId });
    });
    document.getElementById('g2048-btn-copy')?.addEventListener('click', () => {
      const code = document.getElementById('g2048-room-code')?.textContent;
      if (code) { navigator.clipboard.writeText(code).catch(() => {}); this.setStatus('已复制'); }
    });
    document.getElementById('g2048-btn-room-start')?.addEventListener('click', () => { this.client.send('room:start'); });
    document.getElementById('g2048-btn-room-leave')?.addEventListener('click', () => {
      this.client.send('room:leave');
      this.show();
    });

    this.client.on('connected', () => this.updateConnectionStatus());
    this.client.on('disconnected', () => this.updateConnectionStatus());
    this.client.on('match:found', () => { this.hide(); this.onStartGame?.(); });
    this.client.on('game:started', () => { this.hide(); this.onStartGame?.(); });

    this.client.on('room:created', (data: unknown) => {
      const d = data as { roomId: string };
      this.showRoomPanel(d.roomId);
      this.updatePlayerList([{ socketId: 'me', name: '你', connected: true }]);
      document.getElementById('g2048-btn-room-start')?.classList.remove('hidden');
    });
    this.client.on('room:joined', (data: unknown) => {
      const d = data as { roomId: string; players: Array<{ socketId: string; name: string; connected: boolean }> };
      this.showRoomPanel(d.roomId);
      this.updatePlayerList(d.players);
    });
    this.client.on('room:update', (data: unknown) => {
      const d = data as { players: Array<{ socketId: string; name: string; connected: boolean }> };
      this.updatePlayerList(d.players);
    });

    this.client.on('room:opponent_left', () => { this.setStatus('对手已离开'); });
    this.client.on('error', (data: unknown) => { const d = data as { code: string; message?: string }; this.setStatus(d.message || d.code); });
    this.client.on('match:queued', () => { this.setStatus('等待对手...'); });
    this.client.on('match:cancelled', () => { this.matchingEl?.classList.add('hidden'); this.setStatus('已取消'); });
  }

  private showRoomPanel(roomId: string): void {
    this.lobbyEl?.classList.remove('hidden');
    this.matchingEl?.classList.add('hidden');
    this.roomEl?.classList.remove('hidden');
    const codeEl = document.getElementById('g2048-room-code');
    if (codeEl) codeEl.textContent = roomId;
  }

  private updatePlayerList(players: Array<{ socketId?: string; name: string; connected?: boolean }>): void {
    const list = document.getElementById('g2048-player-list');
    if (!list) return;
    list.innerHTML = players.map(p => `<div class="g2048-player-item">🎮 ${p.name}</div>`).join('');
    if (players.length >= 2) document.getElementById('g2048-btn-room-start')?.classList.remove('hidden');
  }

  private updateConnectionStatus(): void {
    const el = document.getElementById('g2048-conn');
    if (!el) return;
    el.textContent = this.client.isConnected ? '🟢 已连接' : '🔴 未连接';
  }
}
