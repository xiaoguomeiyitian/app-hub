import type { OnlineMessage } from './OnlineTypes.js';

/**
 * WebSocket 客户端封装
 * 管理连接、重连、事件分发
 */
export class OnlineClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private reconnectTimer: number | null = null;
  private _connected = false;
  private shouldReconnect = false;

  /** 建立连接 */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const pathname = window.location.pathname;
    const base = pathname.replace(/\/gomoku\/?$/, '').replace(/\/$/, '');
    const url = `${protocol}//${window.location.host}${base}/api/gomoku-mp/websocket`;

    this.shouldReconnect = true;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._connected = true;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as OnlineMessage;
        this.dispatch(msg.type, msg.data);
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.dispatch('disconnected', undefined);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will follow
    };
  }

  /** 断开连接 */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  /** 发送消息 */
  send(type: string, data?: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  /** 注册事件监听 */
  on(type: string, fn: (data: unknown) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(fn);
  }

  /** 移除事件监听 */
  off(type: string, fn: (data: unknown) => void): void {
    this.listeners.get(type)?.delete(fn);
  }

  /** 是否已连接 */
  get isConnected(): boolean {
    return this._connected;
  }

  /** 事件分发 */
  private dispatch(type: string, data: unknown): void {
    this.listeners.get(type)?.forEach(fn => fn(data));
  }

  /** 自动重连 */
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }
}
