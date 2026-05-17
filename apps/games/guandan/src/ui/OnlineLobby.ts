import { OnlineClient } from '../online/OnlineClient.js';

export class OnlineLobby {
  private app: HTMLElement;
  private client: OnlineClient;
  private onStartGame: ((data: unknown) => void) | null = null;

  constructor(app: HTMLElement, client: OnlineClient) {
    this.app = app;
    this.client = client;
  }

  setOnStartGame(cb: (data: unknown) => void): void { this.onStartGame = cb; }

  show(): void {
    this.app.innerHTML = `
      <div class="entry-bg">
        <div class="entry-logo">
          <span class="logo-cards">🂡 🂱 🃁 🃑</span>
          <h1>掼蛋联机</h1>
        </div>
        <div id="gd-online-conn" class="gd-online-conn" style="text-align:center;padding:8px;color:#aaa">
          ${this.client.isConnected ? '🟢 已连接' : '🔴 连接中...'}
        </div>
        <div class="entry-actions" style="max-width:400px;margin:0 auto">
          <button id="gd-btn-match" class="entry-btn primary">
            <span class="btn-icon">⚡</span>
            <span class="btn-text-wrap">
              <span class="btn-text">快速匹配</span>
              <span class="btn-desc">自动凑4人开局</span>
            </span>
          </button>
          <button id="gd-btn-create" class="entry-btn">
            <span class="btn-icon">🏠</span>
            <span class="btn-text-wrap">
              <span class="btn-text">创建房间</span>
              <span class="btn-desc">邀请好友加入</span>
            </span>
          </button>
          <div style="display:flex;gap:8px;padding:0 16px">
            <input id="gd-room-input" placeholder="输入房间号" maxlength="6"
              style="flex:1;padding:10px;border:1px solid #444;border-radius:8px;font-size:1rem;
              background:rgba(255,255,255,0.1);color:#fff;text-align:center;letter-spacing:4px" />
            <button id="gd-btn-join" class="entry-btn" style="padding:10px 16px">加入</button>
          </div>
        </div>
        <div id="gd-matching-panel" style="display:none;text-align:center;padding:20px">
          <div class="online-spinner" style="margin:0 auto 12px"></div>
          <p style="color:#fff;margin-bottom:8px">匹配中... <span id="gd-match-count"></span></p>
          <button id="gd-btn-cancel" class="entry-btn">取消匹配</button>
        </div>
        <div id="gd-room-panel" style="display:none;text-align:center;padding:20px">
          <p style="color:#aaa">房间号</p>
          <strong id="gd-room-code" style="color:#f5c542;font-size:1.5rem;letter-spacing:6px"></strong>
          <div id="gd-room-players" style="margin:12px 0"></div>
          <button id="gd-room-start" class="entry-btn primary" style="display:none">开始游戏</button>
          <button id="gd-room-leave" class="entry-btn" style="margin-top:8px">离开房间</button>
        </div>
        <div id="gd-online-msg" style="text-align:center;color:#f5c542;min-height:1.2em;padding:8px"></div>
        <div style="text-align:center;padding:16px">
          <button id="gd-back-entry" class="entry-sub-btn">← 返回大厅</button>
        </div>
      </div>
    `;

    this.bindEvents();
    if (!this.client.isConnected) this.client.connect();
  }

  hide(): void {}

  private bindEvents(): void {
    document.getElementById('gd-btn-match')?.addEventListener('click', () => {
      this.client.send('match:join');
      this.showMatching();
    });

    document.getElementById('gd-btn-cancel')?.addEventListener('click', () => {
      this.client.send('match:cancel');
      this.hideMatching();
    });

    document.getElementById('gd-btn-create')?.addEventListener('click', () => {
      this.client.send('room:create', { roomType: 'private' });
    });

    document.getElementById('gd-btn-join')?.addEventListener('click', () => {
      const input = document.getElementById('gd-room-input') as HTMLInputElement;
      const roomId = input.value.trim();
      if (roomId) this.client.send('room:join', { roomId });
    });

    document.getElementById('gd-room-start')?.addEventListener('click', () => {
      this.client.send('room:start');
    });

    document.getElementById('gd-room-leave')?.addEventListener('click', () => {
      this.client.send('room:leave');
      this.hideRoom();
    });

    document.getElementById('gd-back-entry')?.addEventListener('click', () => {
      this.client.disconnect();
      // Will be handled by main.ts
      this.app.dispatchEvent(new CustomEvent('gd-back-to-entry'));
    });

    this.client.on('connected', () => {
      const el = document.getElementById('gd-online-conn');
      if (el) el.textContent = '🟢 已连接';
    });

    this.client.on('disconnected', () => {
      const el = document.getElementById('gd-online-conn');
      if (el) el.textContent = '🔴 连接断开';
    });

    this.client.on('match:queued', (data: unknown) => {
      const d = data as { position?: number };
      const el = document.getElementById('gd-match-count');
      if (el && d.position) el.textContent = `(${d.position}/4)`;
    });

    this.client.on('match:found', (data: unknown) => {
      this.onStartGame?.(data);
    });

    this.client.on('game:started', (data: unknown) => {
      this.onStartGame?.(data);
    });

    this.client.on('room:created', (data: unknown) => {
      const d = data as { roomId: string };
      this.showRoom(d.roomId);
      this.updateRoomPlayers([{ name: '你（房主）' }]);
    });

    this.client.on('room:joined', (data: unknown) => {
      const d = data as { roomId: string; seat: string };
      this.showRoom(d.roomId);
      this.updateRoomPlayers([{ name: `你 (${d.seat})` }]);
    });

    this.client.on('room:update', (data: unknown) => {
      const d = data as { seats: Record<string, { name: string; isBot: boolean }> };
      const players = Object.values(d.seats).filter(s => !s.isBot).map(s => ({ name: s.name }));
      this.updateRoomPlayers(players);
    });

    this.client.on('error', (data: unknown) => {
      const d = data as { code: string; message?: string };
      const el = document.getElementById('gd-online-msg');
      if (el) el.textContent = d.message || d.code;
    });

    this.client.on('match:cancelled', () => {
      this.hideMatching();
      const el = document.getElementById('gd-online-msg');
      if (el) el.textContent = '已取消匹配';
    });
  }

  private showMatching(): void {
    const el = document.getElementById('gd-matching-panel');
    if (el) el.style.display = '';
  }

  private hideMatching(): void {
    const el = document.getElementById('gd-matching-panel');
    if (el) el.style.display = 'none';
  }

  private showRoom(roomId: string): void {
    this.hideMatching();
    const panel = document.getElementById('gd-room-panel');
    if (panel) panel.style.display = '';
    const code = document.getElementById('gd-room-code');
    if (code) code.textContent = roomId;
  }

  private hideRoom(): void {
    const panel = document.getElementById('gd-room-panel');
    if (panel) panel.style.display = 'none';
  }

  private updateRoomPlayers(players: Array<{ name: string }>): void {
    const el = document.getElementById('gd-room-players');
    if (!el) return;
    el.innerHTML = players.map(p => `<div style="padding:6px;background:rgba(255,255,255,0.1);border-radius:6px;margin:4px 0;color:#fff">${p.name}</div>`).join('');
    if (players.length >= 2) {
      const btn = document.getElementById('gd-room-start');
      if (btn) btn.style.display = '';
    }
  }
}
