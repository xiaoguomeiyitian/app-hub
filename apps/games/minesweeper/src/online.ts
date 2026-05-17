// WebSocket 联机客户端
export type WSHandler = (type: string, data: unknown) => void;

export class OnlineClient {
  private ws: WebSocket | null = null;
  private handlers: WSHandler[] = [];
  private pingTimer: number | null = null;
  private _isConnected = false;

  isConnected(): boolean { return this._isConnected; }

  private getWsUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const pathname = window.location.pathname;
    const apiBase = pathname.replace(/\/minesweeper\/?$/, '').replace(/\/$/, '');
    return `${protocol}//${window.location.host}${apiBase}/api/minesweeper/websocket`;
  }

  connect(): void {
    if (this.ws && this.ws.readyState < 2) return;
    this._isConnected = false;
    const url = this.getWsUrl();
    this.ws = new WebSocket(url);
    this.ws.onopen = () => { this._isConnected = true; };
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; data?: unknown };
        this.handlers.forEach(h => h(msg.type, msg.data));
      } catch { /* ignore */ }
    };
    this.ws.onclose = () => {
      this._isConnected = false;
      this.stopPing();
    };
    this.ws.onerror = () => { this._isConnected = false; };
  }

  disconnect(): void {
    this.stopPing();
    if (this.ws) { this.ws.close(); this.ws = null; }
    this._isConnected = false;
  }

  on(handler: WSHandler): void { this.handlers.push(handler); }
  off(handler: WSHandler): void { this.handlers = this.handlers.filter(h => h !== handler); }

  send(type: string, data?: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  startPing(): void {
    this.stopPing();
    this.pingTimer = window.setInterval(() => this.send('ping'), 20000);
  }

  private stopPing(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }
}
