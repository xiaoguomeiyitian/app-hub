import type { Board, Color, Position, Move, Piece } from './types.js';
import { createInitialBoard } from './board-setup.js';
import { isLegalMove, makeMove, getLegalMoves } from './logic.js';
import { BoardRenderer } from './board.js';
import { DEFAULT_TIME_TIER, TIME_TIERS, type TimeTierKey } from './time-tiers.js';

// ===== WebSocket 协议类型 =====
interface RoomState {
  id: string;
  red: { socketId: string; nickname: string; elo: number; color: Color };
  black: { socketId: string; nickname: string; elo: number; color: Color };
  board: Board;
  currentTurn: Color;
  status: 'playing' | 'finished';
  winner: Color | null;
  winReason: string;
  moveCount: number;
  createdAt: number;
  timeTier?: TimeTierKey;
}

interface TimeState {
  red: { remaining: number; stepRemaining: number };
  black: { remaining: number; stepRemaining: number };
}

// ===== 获取 WebSocket 连接地址 =====
const RECONNECT_SOCKET_ID_KEY = 'xiangqi:reconnectSocketId';
const RECONNECT_REFRESH_FLAG_KEY = 'xiangqi:reconnectRefreshFlag';
const RECONNECT_SOURCE_KEY = 'xiangqi:reconnectSource';
const RECONNECT_SOURCE_REFRESH = 'refresh';

type MatchTierKey = TimeTierKey;

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Bug #7: 防御性 URL 处理 - 去掉 query/hash，确保包含 /xiangqi
  const fullPath = window.location.pathname + window.location.search + window.location.hash;
  const pathname = fullPath.split('?')[0].split('#')[0];
  const apiBase = pathname.replace(/\/xiangqi\/?$/, '').replace(/\/$/, '');
  return `${protocol}//${window.location.host}${apiBase}/api/xiangqi/websocket`;
}

function getTimeTierConfig(key: MatchTierKey): { label: string; description: string } {
  const tier = TIME_TIERS.find((item) => item.key === key) ?? TIME_TIERS.find((item) => item.key === DEFAULT_TIME_TIER)!;
  return { label: tier.label, description: tier.description };
}

// ===== 在线对战类 =====
export class OnlineGame {
  private ws: WebSocket | null = null;
  private mySocketId: string | null = null;
  private container: HTMLElement;
  private renderer: BoardRenderer | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // 游戏状态
  private board: Board = createInitialBoard();
  private myColor: Color = 'red';
  private currentTurn: Color = 'red';
  private status: 'idle' | 'queue' | 'playing' | 'gameover' = 'idle';
  private selected: Position | null = null;
  private legalMoves: Position[] = [];
  private lastMove: Move | null = null;
  private opponentName: string = '';
  private chatMessages: Array<{ id?: string; socketId?: string; nickname: string; color: Color | 'system'; text: string; time: number }> = [];
  private timeTier: MatchTierKey = DEFAULT_TIME_TIER;

  // 断线重连状态
  private myOldSocketId: string | null = null;
  private reconnecting = false;
  private reconnectInterval: ReturnType<typeof setInterval> | null = null;
  private restoredSocketId: string | null = null;

  // 心跳
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // UI 回调
  private onBackToLobby: () => void;

  constructor(container: HTMLElement, onBackToLobby: () => void) {
    this.container = container;
    this.onBackToLobby = onBackToLobby;
    this.restoredSocketId = window.sessionStorage.getItem(RECONNECT_SOCKET_ID_KEY);
    const source = window.sessionStorage.getItem(RECONNECT_SOURCE_KEY);
    if (source !== RECONNECT_SOURCE_REFRESH) {
      window.sessionStorage.removeItem(RECONNECT_REFRESH_FLAG_KEY);
    }
  }

  // ===== 连接 + 匹配 =====
  private connecting = false;
  private matchAfterConnect = false;

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connecting) return;
    this.connecting = false;
    this.matchAfterConnect = false;
    this.doConnect();
  }

  connectAndMatch(): void {
    const storedSocketId = this.restoredSocketId || window.sessionStorage.getItem(RECONNECT_SOCKET_ID_KEY);

    if (this.ws?.readyState === WebSocket.OPEN) {
      if (storedSocketId) {
        this.tryReconnectWithSocketId(storedSocketId);
      } else {
        this.joinMatch();
      }
      return;
    }
    if (this.connecting) return;
    this.matchAfterConnect = true;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connecting) return;
    this.connecting = true;

    const url = getWsUrl();
    console.log('[OnlineGame] 连接:', url);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[OnlineGame] 已连接');
      this.connecting = false;
      this.startPing();
      if (this.reconnecting && this.myOldSocketId) {
        this.send('game:reconnect', { oldSocketId: this.myOldSocketId });
      } else if (this.restoredSocketId) {
        this.tryReconnectWithSocketId(this.restoredSocketId);
      } else if (this.matchAfterConnect) {
        this.matchAfterConnect = false;
        this.joinMatch();
      } else if (this.createRoomAfterConnect || this.joinRoomCodeAfterConnect) {
        this.handleFriendRoomOnConnect();
      } else if (this.spectateAfterConnect || this.spectateListAfterConnect) {
        this.handleSpectateOnConnect();
      }
    };

    this.ws.onclose = () => {
      console.log('[OnlineGame] 断开');
      this.connecting = false;
      this.matchAfterConnect = false;
      this.stopPing();
      if (this.status === 'playing') {
        this.myOldSocketId = this.mySocketId;
        this.reconnecting = true;
        if (this.myOldSocketId) {
          window.sessionStorage.setItem(RECONNECT_SOCKET_ID_KEY, this.myOldSocketId);
          window.sessionStorage.setItem(RECONNECT_SOURCE_KEY, RECONNECT_SOURCE_REFRESH);
        }
        this.showReconnectOverlay();
        this.startReconnectCountdown();
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error('[OnlineGame] 连接错误:', err);
      this.connecting = false;
      this.matchAfterConnect = false;
      this.updateQueueUI('连接失败，正在重试...');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; data?: unknown };
        this.handleMessage(msg.type, msg.data);
      } catch (e) {
        console.error('[OnlineGame] 消息解析错误:', e);
      }
    };
  }

  disconnect(): void {
    this.stopPing();
    this.clearReconnectCountdown();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private send(type: string, data?: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.send('ping');
    }, 20000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private tryReconnectWithSocketId(socketId: string): void {
    if (!socketId) return;
    this.reconnecting = true;
    this.myOldSocketId = socketId;
    this.send('game:reconnect', { oldSocketId: socketId });
  }

  private clearReconnectState(): void {
    this.reconnecting = false;
    this.myOldSocketId = null;
    this.restoredSocketId = null;
    window.sessionStorage.removeItem(RECONNECT_SOCKET_ID_KEY);
    window.sessionStorage.removeItem(RECONNECT_REFRESH_FLAG_KEY);
    window.sessionStorage.removeItem(RECONNECT_SOURCE_KEY);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.reconnecting) {
        console.log('[OnlineGame] 尝试重连...');
        this.doConnect();
      }
    }, 1000);
  }

  private handleMessage(type: string, data: unknown): void {
    // 好友房间消息优先处理
    if (this.handleFriendRoomMessage(type, data)) return;
    // 观战消息优先处理
    if (this.handleSpectateMessage(type, data)) return;

    switch (type) {
      case 'connected':
        this.mySocketId = (data as { socketId: string }).socketId;
        break;
      case 'match:waiting':
        if (this.status === 'playing' || this.status === 'gameover') break;
        this.status = 'queue';
        this.showQueueUI();
        break;
      case 'match:found': {
        const d = data as { roomId: string; color: Color; opponent: string; timeTier?: MatchTierKey; isBot?: boolean };
        console.log('[OnlineGame] 匹配成功:', d);
        this.myColor = d.color;
        this.opponentName = d.opponent;
        this.timeTier = d.timeTier ?? this.timeTier;
        this.status = 'playing';
        this.chatMessages = [];
        this.board = createInitialBoard();
        this.currentTurn = 'red';
        this.selected = null;
        this.legalMoves = [];
        this.lastMove = null;
        if (d.isBot) this.showNotification(`🤖 已匹配到 AI 对手：${d.opponent}`);
        if (this.mySocketId) window.sessionStorage.setItem(RECONNECT_SOCKET_ID_KEY, this.mySocketId);
        this.showGameUI();
        this.render();
        this.updateTurnUI();
        break;
      }
      case 'match:timeout':
        this.status = 'idle';
        this.clearReconnectState();
        this.showNotification('匹配超时，请重试');
        this.showModeSelect();
        break;
      case 'match:cancelled':
        this.status = 'idle';
        this.clearReconnectState();
        this.showModeSelect();
        break;
      case 'game:state': {
        const state = data as RoomState;
        console.log('[OnlineGame] 游戏状态:', state);
        this.board = state.board;
        this.currentTurn = state.currentTurn;
        if (state.timeTier) this.timeTier = state.timeTier;
        if (this.reconnecting) {
          this.reconnecting = false;
          this.myOldSocketId = null;
          this.hideReconnectOverlay();
          this.clearReconnectCountdown();
          this.showNotification('已重新连接');
          window.sessionStorage.removeItem(RECONNECT_REFRESH_FLAG_KEY);
          window.sessionStorage.removeItem(RECONNECT_SOURCE_KEY);
        }
        this.myColor = state.red.socketId === this.mySocketId ? 'red' : 'black';
        this.opponentName = this.myColor === 'red' ? state.black.nickname : state.red.nickname;
        this.status = state.status === 'finished' ? 'gameover' : 'playing';
        if (this.mySocketId) window.sessionStorage.setItem(RECONNECT_SOCKET_ID_KEY, this.mySocketId);
        this.showGameUI();
        this.render();
        this.updateTurnUI();
        break;
      }
      case 'game:move': {
        const d = data as { from: Position; to: Position; board: Board; currentTurn: Color; moveCount: number };
        // 观战模式使用专门的更新逻辑
        if (this.spectating) {
          this.handleSpectateMove(d);
          break;
        }
        this.board = d.board;
        this.currentTurn = d.currentTurn;
        this.lastMove = { from: d.from, to: d.to };
        this.selected = null;
        this.legalMoves = [];
        this.render();
        this.updateTurnUI();
        break;
      }
      case 'game:over': {
        const d = data as { winner: Color | null; reason: string };
        // 观战模式
        if (this.spectating) {
          this.handleSpectateGameOver(d);
          break;
        }
        this.status = 'gameover';
        this.clearReconnectState();
        const winnerText = d.winner === null ? '和棋' : (d.winner === this.myColor ? '你赢了！' : '你输了');
        this.showGameOverOverlay(winnerText, d.reason);
        break;
      }
      case 'game:check': {
        const d = data as { color: Color };
        const text = d.color === this.myColor ? '你被将军！' : '将军对手！';
        this.showNotification(text);
        break;
      }
      case 'game:draw_offered':
        this.showDrawOfferOverlay();
        break;
      case 'game:draw_accepted':
        this.showNotification('和棋达成');
        break;
      case 'game:draw_declined':
        this.showNotification('对手拒绝和棋');
        break;
      case 'game:opponent_disconnected':
        this.showNotification('对手已断线');
        break;
      case 'game:opponent_reconnected':
        this.showNotification('对手已重连');
        break;
      case 'chat:message': {
        const d = data as { clientMessageId?: string; socketId?: string; nickname?: string; color?: Color | 'system'; text?: string; time?: number };
        const text = String(d?.text ?? '').trim();
        if (!text) break;
        const clientMessageId = d.clientMessageId;
        if (clientMessageId && this.chatMessages.some((msg) => msg.id === clientMessageId)) break;
        this.chatMessages.push({
          id: clientMessageId,
          socketId: d.socketId,
          nickname: d.nickname ? d.nickname : '玩家',
          color: d.color ?? 'system',
          text,
          time: typeof d.time === 'number' ? d.time : Date.now(),
        });
        this.renderChatMessages();
        break;
      }
      case 'game:time':
        this.updateTimers(data as TimeState);
        break;
      case 'error': {
        const message = (data as { message: string }).message || '发生错误';
        if (message.includes('没有找到可重连的对局') || message.includes('对局已结束')) {
          this.clearReconnectState();
          this.showNotification('重连失败，已切换为普通匹配');
          if (this.status === 'queue' || this.status === 'idle') {
            this.restoredSocketId = null;
            this.joinMatch();
          }
          break;
        }
        this.showNotification(message);
        break;
      }
      case 'pong':
        break;
      default:
        console.log('[OnlineGame] 未知事件:', type);
    }
  }

  joinMatch(): void {
    this.send('match:join', { nickname: undefined, elo: 1200, timeTier: this.timeTier });
  }

  setTimeTier(timeTier: MatchTierKey): void {
    this.timeTier = timeTier;
  }

  cancelMatch(): void {
    this.send('match:cancel');
  }

  sendMove(from: Position, to: Position): void {
    this.send('game:move', { from, to });
  }

  resign(): void {
    this.send('game:resign');
  }

  offerDraw(): void {
    this.send('game:draw_offer');
    this.showNotification('已发送和棋提议');
  }

  respondDraw(accept: boolean): void {
    this.send('game:draw_response', { accept });
  }

  leaveRoom(): void {
    this.send('room:leave');
    this.status = 'idle';
    this.chatMessages = [];
    this.myOldSocketId = null;
    this.reconnecting = false;
    this.restoredSocketId = window.sessionStorage.getItem(RECONNECT_SOCKET_ID_KEY);
    this.onBackToLobby();
  }

  private showModeSelect(): void {
    this.container.classList.remove('game-active');
    this.status = 'idle';
    this.container.innerHTML = `
      <div class="lobby single-lobby">
        <h1>♟ 中国象棋</h1>
        <p class="lobby-note">选择游戏模式</p>
        <div class="lobby-form">
          <button id="btn-single" class="btn btn-primary-action">🎮 单机对战</button>
          <button id="btn-online" class="btn btn-primary-action online-btn">🌐 在线匹配</button>
        </div>
        <p class="lobby-note" style="margin-top:20px;font-size:0.8rem;">
          在线模式支持实时匹配对战
        </p>
      </div>
    `;

    document.getElementById('btn-single')?.addEventListener('click', () => {
      this.onBackToLobby();
    });

    document.getElementById('btn-online')?.addEventListener('click', () => {
      const storedSocketId = this.restoredSocketId || window.sessionStorage.getItem(RECONNECT_SOCKET_ID_KEY);
      if (storedSocketId) {
        this.restoredSocketId = storedSocketId;
        this.connectAndMatch();
      } else {
        this.connectAndMatch();
      }
    });
  }

  private showQueueUI(): void {
    this.container.classList.remove('game-active');
    const tier = getTimeTierConfig(this.timeTier);
    this.container.innerHTML = `
      <div class="lobby single-lobby">
        <h1>🔍 匹配中...</h1>
        <p class="queue-status" id="queue-status">正在寻找 ${tier.label} 对手，请稍候...</p>
        <div class="queue-spinner"></div>
        <div class="queue-tier-card">
          <div class="queue-tier-name">当前档位：${tier.label}</div>
          <div class="queue-tier-desc">${tier.description}</div>
        </div>
        <button id="btn-cancel" class="btn btn-secondary" style="margin-top:20px;">取消匹配</button>
      </div>
    `;

    document.getElementById('btn-cancel')?.addEventListener('click', () => {
      this.cancelMatch();
      this.status = 'idle';
      this.showModeSelect();
    });
  }

  private updateQueueUI(msg: string): void {
    const el = document.getElementById('queue-status');
    if (el) el.textContent = msg;
  }

  private showGameUI(): void {
    this.container.classList.add('game-active');
    const myColorLabel = this.myColor === 'red' ? '🔴 红方' : '⚫ 黑方';
    const oppColorLabel = this.myColor === 'red' ? '⚫ 黑方' : '🔴 红方';
    const tier = getTimeTierConfig(this.timeTier);

    this.container.innerHTML = `
      <div class="game">
        <div class="game-header">
          <div class="turn-pill" id="turn-indicator">红方走棋</div>
          <div class="game-difficulty-badge">在线对战 · ${tier.label}</div>
        </div>

        <div class="game-layout">
          <div class="board-column">
            <!-- 对方计时器 -->
            <div class="timer" id="opponent-timer">
              <div class="timer-player">${this.escapeHtml(this.opponentName)} ${oppColorLabel}</div>
              <div class="timer-display">
                <span class="timer-total" id="opp-total">20:00</span>
                <span class="timer-step" id="opp-step">90</span>
              </div>
            </div>

            <div class="board-shell" id="canvas-wrapper">
              <canvas id="game-canvas"></canvas>
              <div id="board-input-layer" class="board-input-layer" aria-hidden="true"></div>
            </div>

            <!-- 己方计时器 -->
            <div class="timer" id="my-timer">
              <div class="timer-player">你 ${myColorLabel}</div>
              <div class="timer-display">
                <span class="timer-total" id="my-total">20:00</span>
                <span class="timer-step" id="my-step">90</span>
              </div>
            </div>
          </div>

          <aside class="game-sidebar" aria-label="对局信息">
            <div class="sidebar-card">
              <div class="sidebar-title">对局信息</div>
              <div class="game-color-badge" id="my-color-label">你执：${myColorLabel}</div>
              <div class="game-placement-tip">对手：${this.escapeHtml(this.opponentName)} ${oppColorLabel}</div>
              <div class="game-placement-tip">当前档位：${tier.label}</div>
            </div>

            <div class="sidebar-card">
              <div class="sidebar-title">操作</div>
              <div class="control-actions">
                <button id="btn-draw" class="btn btn-secondary btn-mini">和棋</button>
                <button id="btn-resign" class="btn btn-danger btn-mini">认输</button>
                <button id="btn-leave" class="btn btn-secondary btn-mini">离开</button>
              </div>
            </div>

            <div class="sidebar-card chat-card">
              <div class="sidebar-title">聊天</div>
              <div id="chat-list" class="chat-list" aria-live="polite"></div>
              <div class="chat-input-row">
                <input id="chat-input" class="chat-input" type="text" maxlength="120" placeholder="输入聊天内容，Enter 发送" />
                <button id="btn-chat-send" class="btn btn-primary-action btn-mini">发送</button>
              </div>
              <div class="chat-tip">仅对局双方可见</div>
            </div>

            <div class="sidebar-card">
              <div class="sidebar-title">提示</div>
              <div class="game-info">
                <span id="status-hint">等待对方走棋...</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new BoardRenderer(canvas);
    this.renderer.setPerspective(this.myColor);

    document.getElementById('btn-draw')?.addEventListener('click', () => this.offerDraw());
    document.getElementById('btn-resign')?.addEventListener('click', () => {
      if (confirm('确定要认输吗？')) this.resign();
    });
    document.getElementById('btn-leave')?.addEventListener('click', () => {
      if (confirm('确定要离开吗？离开将判负。')) this.leaveRoom();
    });

    this.bindCanvasEvents(canvas);
    this.bindChatEvents();
    this.renderChatMessages();
    window.setTimeout(() => {
      const input = document.getElementById('chat-input') as HTMLInputElement | null;
      input?.focus();
    }, 0);

    window.addEventListener('beforeunload', () => {
      if (this.status === 'playing' && this.mySocketId) {
        window.sessionStorage.setItem(RECONNECT_SOCKET_ID_KEY, this.mySocketId);
        window.sessionStorage.setItem(RECONNECT_REFRESH_FLAG_KEY, '1');
        window.sessionStorage.setItem(RECONNECT_SOURCE_KEY, RECONNECT_SOURCE_REFRESH);
      }
    });

    requestAnimationFrame(() => { if (this.renderer) { this.renderer.resize(); this.render(); } });
    window.addEventListener('resize', () => {
      if (this.renderer) {
        this.renderer.resize();
        this.render();
      }
    });
  }

  private bindChatEvents(): void {
    const input = document.getElementById('chat-input') as HTMLInputElement | null;
    const btn = document.getElementById('btn-chat-send') as HTMLButtonElement | null;
    if (!input || !btn) return;

    const sendChat = () => {
      const text = input.value.trim();
      if (!text) return;
      if (text.length > 120) {
        this.showNotification('聊天内容不能超过120个字符');
        return;
      }
      const clientMessageId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.chatMessages.push({
        id: clientMessageId,
        socketId: this.mySocketId ?? undefined,
        nickname: this.myColor === 'red' ? '你（红方）' : '你（黑方）',
        color: this.myColor,
        text,
        time: Date.now(),
      });
      this.renderChatMessages();
      this.send('chat:send', { text, clientMessageId });
      input.value = '';
    };

    btn.addEventListener('click', sendChat);
    input.addEventListener('keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        sendChat();
      }
    });
  }

  private renderChatMessages(): void {
    const list = document.getElementById('chat-list');
    if (!list) return;
    const escape = (text: string) => this.escapeHtml(text);
    const isMine = (msg: { id?: string; socketId?: string; color: Color | 'system' }) => !!this.mySocketId && msg.socketId === this.mySocketId;
    list.innerHTML = this.chatMessages.slice(-50).map((msg) => {
      const time = new Date(msg.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const colorClass = msg.color === 'red' ? 'chat-red' : msg.color === 'black' ? 'chat-black' : 'chat-system';
      const mineClass = msg.color === 'system' ? 'chat-system-msg' : (isMine(msg) ? 'chat-mine' : 'chat-opp');
      const nick = escape(msg.nickname);
      const text = escape(msg.text);
      const body = '<div class="chat-bubble ' + colorClass + ' ' + mineClass + '">'
        + '<div class="chat-meta">' + nick + ' · ' + time + '</div>'
        + '<div class="chat-text">' + text + '</div>'
        + '</div>';
      return '<div class="chat-row ' + mineClass + '">' + body + '</div>';
    }).join('');
    list.scrollTop = list.scrollHeight;
  }

  private bindCanvasEvents(canvas: HTMLCanvasElement): void {
    const boardLayer = document.getElementById('board-input-layer') as HTMLDivElement | null;

    const handleBoardInput = (clientX: number, clientY: number): void => {
      if (this.status !== 'playing') return;
      if (this.currentTurn !== this.myColor) return;

      const wrapper = canvas.parentElement?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
      const boardRect = canvas.getBoundingClientRect();
      if (clientX < wrapper.left || clientX > wrapper.right || clientY < wrapper.top || clientY > wrapper.bottom) return;

      const point = { x: clientX - boardRect.left, y: clientY - boardRect.top };
      const pos = this.renderer!.pixelToBoard(point.x, point.y);
      if (!pos) return;

      if (this.selected) {
        if (pos.col === this.selected.col && pos.row === this.selected.row) {
          this.selected = null;
          this.legalMoves = [];
          this.render();
          return;
        }

        const move: Move = { from: this.selected, to: pos };
        if (isLegalMove(this.board, move, this.myColor)) {
          this.sendMove(this.selected, pos);
          this.board = makeMove(this.board, move);
          this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
          this.lastMove = move;
          this.selected = null;
          this.legalMoves = [];
          this.render();
          this.updateTurnUI();
          return;
        }

        const piece = this.getPieceAt(pos);
        if (piece && piece.color === this.myColor) {
          this.selected = pos;
          this.legalMoves = getLegalMoves(this.board, pos.col, pos.row);
          this.render();
          return;
        }
      } else {
        const piece = this.getPieceAt(pos);
        if (piece && piece.color === this.myColor) {
          this.selected = pos;
          this.legalMoves = getLegalMoves(this.board, pos.col, pos.row);
          this.render();
        }
      }
    };

    canvas.style.touchAction = 'none';
    canvas.style.setProperty('-webkit-touch-callout', 'none');
    canvas.style.setProperty('-webkit-user-select', 'none');
    canvas.style.userSelect = 'none';
    canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');
    if (boardLayer) { boardLayer.style.touchAction = 'none'; boardLayer.style.pointerEvents = 'auto'; }

    const onPointerInput = (clientX: number, clientY: number): void => {
      handleBoardInput(clientX, clientY);
    };

    const target = boardLayer ?? canvas;
    target.style.pointerEvents = 'auto';
    target.addEventListener('pointerdown', (evt: Event) => {
      const e = evt as PointerEvent;
      if (e.pointerType === 'mouse' || e.pointerType === 'pen' || e.pointerType === 'touch') {
        e.preventDefault();
        onPointerInput(e.clientX, e.clientY);
      }
    });
  }

  private getPieceAt(pos: Position): Piece | null {
    return this.board[pos.row]?.[pos.col] ?? null;
  }

  private render(): void {
    if (!this.renderer) return;
    this.renderer.drawBoard();
    this.renderer.drawPieces(this.board, this.selected, this.legalMoves, this.lastMove);
  }

  private updateTurnUI(): void {
    const el = document.getElementById('turn-indicator');
    if (el) {
      const turnText = this.currentTurn === 'red' ? '红方走棋' : '黑方走棋';
      const isMyTurn = this.currentTurn === this.myColor;
      el.textContent = isMyTurn ? '轮到你了' : turnText;
      el.className = `turn-pill ${this.currentTurn} ${isMyTurn ? 'my-turn' : ''}`;
    }

    const hint = document.getElementById('status-hint');
    if (hint) {
      hint.textContent = this.currentTurn === this.myColor ? '轮到你了，点击棋子走棋' : '等待对方走棋...';
    }
  }

  private showGameOverOverlay(winner: string, reason: string): void {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>游戏结束</h2>
        <p class="winner">${this.escapeHtml(winner)}</p>
        <p class="reason">${this.escapeHtml(reason)}</p>
        <button class="btn btn-primary-action" id="btn-back-lobby-online">返回大厅</button>
      </div>
    `;
    this.container.appendChild(overlay);
    document.getElementById('btn-back-lobby-online')?.addEventListener('click', () => {
      this.leaveRoom();
    });
  }

  private showDrawOfferOverlay(): void {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>和棋提议</h2>
        <p>对方提议和棋，是否接受？</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;">
          <button class="btn btn-primary-action" id="btn-accept-draw">接受</button>
          <button class="btn btn-secondary" id="btn-decline-draw">拒绝</button>
        </div>
      </div>
    `;
    this.container.appendChild(overlay);
    document.getElementById('btn-accept-draw')?.addEventListener('click', () => {
      overlay.remove();
      this.respondDraw(true);
    });
    document.getElementById('btn-decline-draw')?.addEventListener('click', () => {
      overlay.remove();
      this.respondDraw(false);
    });
  }

  private showNotification(msg: string): void {
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  private updateTimers(data: TimeState): void {
    const myTime = data[this.myColor];
    const oppTime = data[this.myColor === 'red' ? 'black' : 'red'];
    const isMyTurn = this.currentTurn === this.myColor;

    this.updateTimerDisplay('my', myTime, isMyTurn);
    this.updateTimerDisplay('opp', oppTime, !isMyTurn);
  }

  private updateTimerDisplay(
    prefix: string,
    time: { remaining: number; stepRemaining: number },
    isActive: boolean
  ): void {
    const totalEl = document.getElementById(`${prefix}-total`);
    const stepEl = document.getElementById(`${prefix}-step`);
    const container = document.getElementById(`${prefix === 'my' ? 'my-timer' : 'opponent-timer'}`);

    if (totalEl) {
      const mins = Math.floor(time.remaining / 60000);
      const secs = Math.floor((time.remaining % 60000) / 1000);
      totalEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    if (stepEl) {
      const stepSecs = Math.ceil(time.stepRemaining / 1000);
      stepEl.textContent = stepSecs.toString();
    }

    if (container) {
      container.classList.toggle('active', isActive);
      container.classList.toggle('step-warning', isActive && time.stepRemaining <= 10000);
    }
  }

  private showReconnectOverlay(): void {
    this.hideReconnectOverlay();

    const overlay = document.createElement('div');
    overlay.className = 'overlay reconnect-overlay';
    overlay.id = 'reconnect-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>⚠️ 连接断开</h2>
        <p>正在尝试重新连接...</p>
        <div class="reconnect-timer" id="reconnect-timer">60</div>
        <p class="reconnect-hint">秒后将判负</p>
      </div>
    `;
    this.container.appendChild(overlay);
  }

  private hideReconnectOverlay(): void {
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) overlay.remove();
  }

  private startReconnectCountdown(): void {
    this.clearReconnectCountdown();
    let remaining = 60;
    this.reconnectInterval = setInterval(() => {
      remaining--;
      const el = document.getElementById('reconnect-timer');
      if (el) el.textContent = remaining.toString();
      if (remaining <= 0) {
        this.clearReconnectCountdown();
      }
    }, 1000);
  }

  private clearReconnectCountdown(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== 好友房间 =====
  private createRoomAfterConnect = false;
  private joinRoomCodeAfterConnect: string | null = null;
  private onCreateRoomCb: ((code: string) => void) | null = null;

  public onCreateRoom(cb: (code: string) => void): void {
    this.onCreateRoomCb = cb;
  }

  connectAndCreateRoom(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send('room:create', { timeTier: this.timeTier });
      return;
    }
    if (this.connecting) return;
    this.createRoomAfterConnect = true;
    this.doConnect();
  }

  connectAndJoinRoom(code: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send('room:join', { code });
      return;
    }
    if (this.connecting) return;
    this.joinRoomCodeAfterConnect = code;
    this.doConnect();
  }

  /** 拦截 onopen 中的 room 操作 */
  private handleFriendRoomOnConnect(): void {
    if (this.createRoomAfterConnect) {
      this.createRoomAfterConnect = false;
      this.send('room:create', { timeTier: this.timeTier });
    } else if (this.joinRoomCodeAfterConnect) {
      const code = this.joinRoomCodeAfterConnect;
      this.joinRoomCodeAfterConnect = null;
      this.send('room:join', { code });
    }
  }

  /** 拦截消息中的 room 事件 */
  private handleFriendRoomMessage(type: string, data: unknown): boolean {
    if (type === 'room:created') {
      const d = data as { code: string };
      this.onCreateRoomCb?.(d.code);
      return true;
    }
    if (type === 'room:error') {
      const d = data as { message: string };
      const errEl = document.getElementById('join-error');
      if (errEl) { errEl.textContent = d.message; errEl.style.display = 'block'; }
      return true;
    }
    if (type === 'room:cancelled') {
      return true;
    }
    return false;
  }

  // ===== 观战模式 =====
  private spectating = false;
  private spectateAfterConnect = false;
  private spectateListAfterConnect = false;
  private onSpectateCountCb: ((count: number) => void) | null = null;
  

  public onSpectateCount(cb: (count: number) => void): void { this.onSpectateCountCb = cb; }
  

  connectAndSpectate(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send('spectate:join', {});
      return;
    }
    if (this.connecting) return;
    this.spectateAfterConnect = true;
    this.doConnect();
  }

  connectAndSpectateList(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send('spectate:list', {});
      return;
    }
    if (this.connecting) return;
    this.spectateListAfterConnect = true;
    this.doConnect();
  }

  private handleSpectateOnConnect(): void {
    if (this.spectateAfterConnect) {
      this.spectateAfterConnect = false;
      this.send('spectate:join', {});
    } else if (this.spectateListAfterConnect) {
      this.spectateListAfterConnect = false;
      this.send('spectate:list', {});
    }
  }

  private handleSpectateMessage(type: string, data: unknown): boolean {
    switch (type) {
      case 'spectate:count': {
        const d = data as { count: number };
        this.onSpectateCountCb?.(d.count);
        // 断开连接，只是查询
        if (this.spectateListAfterConnect === false) {
          setTimeout(() => this.disconnect(), 100);
        }
        return true;
      }
      case 'spectate:no_games':
        this.container.innerHTML = `
          <div class="lobby single-lobby">
            <h1>👁 观战</h1>
            <p class="lobby-note">当前没有进行中的对局</p>
            <button class="btn btn-secondary" id="btn-back-spectate">返回</button>
          </div>
        `;
        document.getElementById('btn-back-spectate')?.addEventListener('click', () => {
          this.disconnect();
          this.onBackToLobby?.();
        });
        return true;
      case 'spectate:full':
        this.container.innerHTML = `
          <div class="lobby single-lobby">
            <h1>👁 观战</h1>
            <p class="lobby-note">观战人数已满</p>
            <button class="btn btn-secondary" id="btn-back-spectate">返回</button>
          </div>
        `;
        document.getElementById('btn-back-spectate')?.addEventListener('click', () => {
          this.disconnect();
          this.onBackToLobby?.();
        });
        return true;
      case 'spectate:joined': {
        const d = data as { roomId: string; red: string; black: string; board: Board; currentTurn: Color; moveCount: number; spectatorCount: number };
        this.spectating = true;
        this.status = 'playing';
        this.board = d.board;
        this.currentTurn = d.currentTurn;
        this.myColor = 'red'; // 任意，观战不需要
        this.showSpectateUI(d);
        return true;
      }
      case 'spectate:count_update': {
        const d = data as { count: number };
        const el = document.getElementById('spectator-count-badge');
        if (el) el.textContent = `👁 ${d.count}`;
        return true;
      }
    }
    return false;
  }

  private showSpectateUI(data: { red: string; black: string; board: Board; currentTurn: Color; moveCount: number; spectatorCount: number }): void {
    this.container.innerHTML = `
      <div class="game">
        <div class="game-header">
          <div class="spectate-badge" id="spectator-count-badge">👁 ${data.spectatorCount}</div>
          <div class="turn-pill ${data.currentTurn}" id="turn-indicator">${data.currentTurn === 'red' ? '红方走棋' : '黑方走棋'}</div>
          <div class="game-difficulty-badge">观战中 · 第 ${data.moveCount} 步</div>
        </div>
        <div class="game-layout">
          <div class="board-column">
            <div class="board-shell" id="canvas-wrapper">
              <canvas id="game-canvas"></canvas>
            </div>
          </div>
          <aside class="game-sidebar">
            <div class="sidebar-card">
              <div class="sidebar-title">对局信息</div>
              <div class="game-info">🔴 ${data.red} vs ⚫ ${data.black}</div>
            </div>
            <div class="sidebar-card game-actions-card">
              <div class="sidebar-title">操作</div>
              <div class="control-actions">
                <button id="btn-leave-spectate" class="btn btn-secondary btn-mini">退出观战</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;

    this.renderer = new BoardRenderer(document.getElementById('game-canvas') as HTMLCanvasElement);
    this.render();

    document.getElementById('btn-leave-spectate')?.addEventListener('click', () => {
      this.send('spectate:leave', {});
      this.spectating = false;
      this.disconnect();
      this.onBackToLobby?.();
    });

    window.addEventListener('resize', () => {
      if (this.renderer) { this.renderer.resize(); this.render(); }
    });
    requestAnimationFrame(() => { if (this.renderer) { this.renderer.resize(); this.render(); } });
  }

  /** 观战模式下的走棋更新 */
  private handleSpectateMove(data: { board: Board; currentTurn: Color; moveCount: number }): void {
    if (!this.spectating) return;
    this.board = data.board;
    this.currentTurn = data.currentTurn;
    this.render();

    const turnEl = document.getElementById('turn-indicator');
    if (turnEl) {
      turnEl.textContent = data.currentTurn === 'red' ? '红方走棋' : '黑方走棋';
      turnEl.className = `turn-pill ${data.currentTurn}`;
    }
    const badgeEl = document.querySelector('.game-difficulty-badge');
    if (badgeEl) badgeEl.textContent = `观战中 · 第 ${data.moveCount} 步`;
  }

  private handleSpectateGameOver(data: { winner: Color | null; reason: string }): void {
    if (!this.spectating) return;
    this.spectating = false;
    this.status = 'gameover';
    const winnerText = data.winner === null ? '和棋' : (data.winner === 'red' ? '红方胜' : '黑方胜');
    this.container.innerHTML = `
      <div class="lobby single-lobby">
        <h1>👁 观战结束</h1>
        <p class="winner">${winnerText}</p>
        <p class="reason">${data.reason}</p>
        <button class="btn btn-secondary" id="btn-back-spectate-end">返回</button>
      </div>
    `;
    document.getElementById('btn-back-spectate-end')?.addEventListener('click', () => {
      this.disconnect();
      this.onBackToLobby?.();
    });
  }
}
