import type { OnlineMessage } from './OnlineTypes.js';

/**
 * WebSocket 客户端封装（2048）
 */
export class OnlineClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private reconnectTimer: number | null = null;
  private _connected = false;
  private shouldReconnect = false;

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const pathname = window.location.pathname;
    const base = pathname.replace(/\/game-2048\/?$/, '').replace(/\/$/, '');
    const url = `${protocol}//${window.location.host}${base}/api/game-2048-mp/websocket`;
    this.shouldReconnect = true;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => { this._connected = true; };
    this.ws.onmessage = (event) => {
      try { const msg = JSON.parse(event.data) as OnlineMessage; this.dispatch(msg.type, msg.data); } catch { /* ignore */ }
    };
    this.ws.onclose = () => {
      this._connected = false;
      this.dispatch('disconnected', undefined);
      if (this.shouldReconnect) this.scheduleReconnect();
    };
    this.ws.onerror = () => {};
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this._connected = false;
  }

  send(type: string, data?: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  on(type: string, fn: (data: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  off(type: string, fn: (data: unknown) => void): void {
    this.listeners.get(type)?.delete(fn);
  }

  get isConnected(): boolean { return this._connected; }

  private dispatch(type: string, data: unknown): void {
    this.listeners.get(type)?.forEach(fn => fn(data));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = null; this.connect(); }, 2000);
  }
}
