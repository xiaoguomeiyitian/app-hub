import { OnlineClient } from '../online/OnlineClient.js';

/**
 * 联机大厅 UI（俄罗斯方块）
 */
export class OnlineLobby {
  private container: HTMLElement;
  private client: OnlineClient;
  private onStartGame: (() => void) | null = null;
  private lobbyEl: HTMLElement | null = null;
  private matchingEl: HTMLElement | null = null;
  private roomEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private opponentName = '';

  constructor(container: HTMLElement, client: OnlineClient) {
    this.container = container;
    this.client = client;
    this.buildUI();
    this.bindEvents();
  }

  setOnStartGame(cb: () => void): void { this.onStartGame = cb; }

  getOpponentName(): string { return this.opponentName; }

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

  setStatus(text: string): void {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  private buildUI(): void {
    const div = document.createElement('div');
    div.id = 'tetris-online-lobby';
    div.className = 'tetris-online-lobby hidden';
    div.innerHTML = `
      <h2>🌐 联机对战</h2>
      <div id="tetris-conn-status" class="tetris-conn-status">🔴 未连接</div>
      <div class="tetris-lobby-btns">
        <button id="tetris-btn-quick-match" class="tetris-btn primary">⚡ 快速匹配</button>
        <button id="tetris-btn-create-room" class="tetris-btn">🏠 创建房间</button>
        <div class="tetris-join-row">
          <input id="tetris-room-input" placeholder="房间号" maxlength="6" />
          <button id="tetris-btn-join" class="tetris-btn">加入</button>
        </div>
      </div>
      <div id="tetris-matching" class="tetris-matching hidden">
        <div class="tetris-spinner"></div>
        <p>匹配中...</p>
        <button id="tetris-btn-cancel" class="tetris-btn">取消</button>
      </div>
      <div id="tetris-room" class="tetris-room hidden">
        <p>房间号：<strong id="tetris-room-code"></strong> <button id="tetris-btn-copy" class="tetris-btn small">复制</button></p>
        <div id="tetris-player-list" class="tetris-player-list"></div>
        <button id="tetris-btn-room-start" class="tetris-btn primary hidden">开始游戏</button>
        <button id="tetris-btn-room-leave" class="tetris-btn">离开房间</button>
      </div>
      <div id="tetris-online-msg" class="tetris-online-msg"></div>
    `;
    this.container.appendChild(div);
    this.lobbyEl = div;
    this.matchingEl = document.getElementById('tetris-matching')!;
    this.roomEl = document.getElementById('tetris-room')!;
    this.statusEl = document.getElementById('tetris-online-msg')!;
  }

  private bindEvents(): void {
    document.getElementById('tetris-btn-quick-match')?.addEventListener('click', () => {
      this.client.send('match:join');
      this.matchingEl?.classList.remove('hidden');
    });
    document.getElementById('tetris-btn-cancel')?.addEventListener('click', () => {
      this.client.send('match:cancel');
      this.matchingEl?.classList.add('hidden');
    });
    document.getElementById('tetris-btn-create-room')?.addEventListener('click', () => {
      this.client.send('room:create', { roomType: 'private' });
    });
    document.getElementById('tetris-btn-join')?.addEventListener('click', () => {
      const input = document.getElementById('tetris-room-input') as HTMLInputElement;
      const roomId = input.value.trim();
      if (roomId) this.client.send('room:join', { roomId });
    });
    document.getElementById('tetris-btn-copy')?.addEventListener('click', () => {
      const code = document.getElementById('tetris-room-code')?.textContent;
      if (code) { navigator.clipboard.writeText(code).catch(() => {}); this.setStatus('已复制'); }
    });
    document.getElementById('tetris-btn-room-start')?.addEventListener('click', () => {
      this.client.send('room:start');
    });
    document.getElementById('tetris-btn-room-leave')?.addEventListener('click', () => {
      this.client.send('room:leave');
      this.show();
    });

    this.client.on('connected', () => this.updateConnectionStatus());
    this.client.on('disconnected', () => this.updateConnectionStatus());

    this.client.on('match:found', (data: unknown) => {
      const d = data as { roomId: string; opponent: { name: string } };
      this.opponentName = d.opponent.name;
      this.hide();
      this.onStartGame?.();
    });

    this.client.on('room:created', (data: unknown) => {
      const d = data as { roomId: string };
      this.showRoomPanel(d.roomId);
      this.updatePlayerList([{ socketId: 'me', name: '你', connected: true }]);
      document.getElementById('tetris-btn-room-start')?.classList.remove('hidden');
    });

    this.client.on('room:joined', (data: unknown) => {
      const d = data as { roomId: string; players: Array<{ socketId: string; name: string; connected: boolean }> };
      this.showRoomPanel(d.roomId);
      this.updatePlayerList(d.players);
    });

    this.client.on('room:update', (data: unknown) => {
      const d = data as { players: Array<{ socketId: string; name: string; connected: boolean }>; status: string };
      this.updatePlayerList(d.players);
    });

    this.client.on('game:started', () => {
      this.hide();
      this.onStartGame?.();
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
    const codeEl = document.getElementById('tetris-room-code');
    if (codeEl) codeEl.textContent = roomId;
  }

  private updatePlayerList(players: Array<{ socketId?: string; name: string; connected?: boolean }>): void {
    const list = document.getElementById('tetris-player-list');
    if (!list) return;
    list.innerHTML = players.map(p => `<div class="tetris-player-item">🎮 ${p.name}</div>`).join('');
    if (players.length >= 2) {
      document.getElementById('tetris-btn-room-start')?.classList.remove('hidden');
    }
  }

  private updateConnectionStatus(): void {
    const el = document.getElementById('tetris-conn-status');
    if (!el) return;
    el.textContent = this.client.isConnected ? '🟢 已连接' : '🔴 未连接';
  }
}
