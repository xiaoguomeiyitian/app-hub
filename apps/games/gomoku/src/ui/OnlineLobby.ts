import { OnlineClient } from '../online/OnlineClient.js';
import { RoomStore } from '../online/RoomStore.js';

/**
 * 联机大厅 UI
 * 快速匹配 / 创建房间 / 加入房间
 */
export class OnlineLobby {
  private container: HTMLElement;
  private client: OnlineClient;
  private store: RoomStore;
  private onStartGame: (() => void) | null = null;
  private lobbyEl: HTMLElement | null = null;
  private matchingEl: HTMLElement | null = null;
  private roomEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;

  constructor(container: HTMLElement, client: OnlineClient, store: RoomStore) {
    this.container = container;
    this.client = client;
    this.store = store;
    this.buildUI();
    this.bindEvents();
  }

  /** 设置开始游戏回调 */
  setOnStartGame(cb: () => void): void {
    this.onStartGame = cb;
  }

  /** 显示大厅 */
  show(): void {
    this.lobbyEl?.classList.remove('hidden');
    this.matchingEl?.classList.add('hidden');
    this.roomEl?.classList.add('hidden');
    this.updateConnectionStatus();
  }

  /** 隐藏大厅 */
  hide(): void {
    this.lobbyEl?.classList.add('hidden');
    this.matchingEl?.classList.add('hidden');
    this.roomEl?.classList.add('hidden');
  }

  /** 更新状态提示 */
  setStatus(text: string): void {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  private buildUI(): void {
    const div = document.createElement('div');
    div.id = 'online-lobby';
    div.className = 'online-lobby hidden';
    div.innerHTML = `
      <h2>🌐 联机对战</h2>
      <div id="online-conn-status" class="online-conn-status">🔴 未连接</div>
      <div class="online-lobby-buttons">
        <button id="btn-quick-match" class="gomoku-btn primary">⚡ 快速匹配</button>
        <button id="btn-create-room" class="gomoku-btn">🏠 创建房间</button>
        <div class="online-join-room">
          <input id="room-id-input" placeholder="输入房间号" maxlength="6" />
          <button id="btn-join-room" class="gomoku-btn">加入</button>
        </div>
      </div>

      <div id="online-matching" class="online-matching hidden">
        <div class="online-spinner"></div>
        <p>匹配中...</p>
        <button id="btn-cancel-match" class="gomoku-btn">取消匹配</button>
      </div>

      <div id="online-room" class="online-room hidden">
        <p>房间号：<strong id="room-code"></strong> <button id="btn-copy-room" class="gomoku-btn small">复制</button></p>
        <div id="player-list" class="online-player-list"></div>
        <button id="btn-room-start" class="gomoku-btn primary hidden">开始游戏</button>
        <button id="btn-room-leave" class="gomoku-btn">离开房间</button>
      </div>

      <div id="online-status-msg" class="online-status-msg"></div>
    `;

    this.container.appendChild(div);

    this.lobbyEl = div;
    this.matchingEl = document.getElementById('online-matching')!;
    this.roomEl = document.getElementById('online-room')!;
    this.statusEl = document.getElementById('online-status-msg')!;
  }

  private bindEvents(): void {
    // 快速匹配
    document.getElementById('btn-quick-match')?.addEventListener('click', () => {
      this.client.send('match:join');
      this.matchingEl?.classList.remove('hidden');
    });

    // 取消匹配
    document.getElementById('btn-cancel-match')?.addEventListener('click', () => {
      this.client.send('match:cancel');
      this.matchingEl?.classList.add('hidden');
    });

    // 创建房间
    document.getElementById('btn-create-room')?.addEventListener('click', () => {
      this.client.send('room:create', { roomType: 'private' });
    });

    // 加入房间
    document.getElementById('btn-join-room')?.addEventListener('click', () => {
      const input = document.getElementById('room-id-input') as HTMLInputElement;
      const roomId = input.value.trim();
      if (roomId) {
        this.client.send('room:join', { roomId });
      }
    });

    // 复制房间号
    document.getElementById('btn-copy-room')?.addEventListener('click', () => {
      const code = document.getElementById('room-code')?.textContent;
      if (code) {
        navigator.clipboard.writeText(code).catch(() => {});
        this.setStatus('已复制房间号');
      }
    });

    // 房主开始
    document.getElementById('btn-room-start')?.addEventListener('click', () => {
      this.client.send('room:start');
    });

    // 离开房间
    document.getElementById('btn-room-leave')?.addEventListener('click', () => {
      this.client.send('room:leave');
      this.show();
    });

    // 返回大厅
    const backBtn = document.createElement('button') as HTMLButtonElement;
    backBtn.id = 'btn-back-to-entry';
    backBtn.className = 'gomoku-btn';
    backBtn.textContent = '🏠 返回大厅';
    backBtn.style.marginTop = '12px';
    backBtn.addEventListener('click', () => {
      this.client.send('room:leave');
      this.hide();
      this.container.dispatchEvent(new CustomEvent('gm-back-to-entry'));
    });
    this.lobbyEl?.appendChild(backBtn);

    // 连接状态
    this.client.on('connected', () => this.updateConnectionStatus());
    this.client.on('disconnected', () => this.updateConnectionStatus());

    // 匹配成功 → 通知外部启动游戏
    this.client.on('match:found', (data) => {
      const d = data as { roomId: string; yourColor: 'black' | 'white'; opponent: { name: string } };
      this.store.setMatchFound(d.roomId, d.yourColor, d.opponent.name);
      this.hide();
      this.onStartGame?.();
    });

    // 房间创建
    this.client.on('room:created', (data) => {
      const d = data as { roomId: string };
      this.store.setRoomCreated(d.roomId);
      this.showRoomPanel(d.roomId);
      this.updatePlayerList([{ socketId: 'me', name: this.store.myName, color: 'black', connected: true }]);
      // 显示开始按钮（房主）
      document.getElementById('btn-room-start')?.classList.remove('hidden');
    });

    // 加入房间
    this.client.on('room:joined', (data) => {
      const d = data as { roomId: string; players: Array<{ socketId: string; name: string; color: 'black' | 'white'; connected: boolean }> };
      this.store.setRoomJoined(d.roomId, d.players);
      this.showRoomPanel(d.roomId);
      this.updatePlayerList(d.players);
    });

    // 房间更新
    this.client.on('room:update', (data) => {
      const d = data as { players: Array<{ socketId: string; name: string; color: 'black' | 'white'; connected: boolean }>; status: string };
      this.store.setRoomUpdate(d.players, d.status);
      this.updatePlayerList(d.players);
    });

    // 游戏开始
    this.client.on('game:started', () => {
      this.hide();
      this.onStartGame?.();
    });

    // 对手离开
    this.client.on('room:opponent_left', () => {
      this.setStatus('对手已离开房间');
    });

    // 错误
    this.client.on('error', (data) => {
      const d = data as { code: string; message?: string };
      this.setStatus(d.message || d.code);
    });

    // 匹配队列
    this.client.on('match:queued', () => {
      this.setStatus('已加入匹配队列，等待对手...');
    });

    // 取消匹配
    this.client.on('match:cancelled', () => {
      this.matchingEl?.classList.add('hidden');
      this.setStatus('已取消匹配');
    });
  }

  private showRoomPanel(roomId: string): void {
    this.lobbyEl?.classList.remove('hidden');
    this.matchingEl?.classList.add('hidden');
    this.roomEl?.classList.remove('hidden');
    const codeEl = document.getElementById('room-code');
    if (codeEl) codeEl.textContent = roomId;
  }

  private updatePlayerList(players: Array<{ socketId?: string; name: string; color: string; connected?: boolean }>): void {
    const list = document.getElementById('player-list');
    if (!list) return;
    list.innerHTML = players.map(p =>
      `<div class="online-player">${p.color === 'black' ? '⚫' : '⚪'} ${p.name}</div>`
    ).join('');
    // 两个人时可以开始
    if (players.length >= 2) {
      document.getElementById('btn-room-start')?.classList.remove('hidden');
    }
  }

  private updateConnectionStatus(): void {
    const el = document.getElementById('online-conn-status');
    if (!el) return;
    el.textContent = this.client.isConnected ? '🟢 已连接' : '🔴 未连接';
  }
}
