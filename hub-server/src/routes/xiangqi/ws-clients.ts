import { WebSocket } from 'ws';

/** WebSocket 客户端映射 (socketId → WebSocket) */
export const wsClients = new Map<string, WebSocket>();

/** 向指定客户端发送消息 */
export function sendToSocket(socketId: string, event: string, data?: unknown): void {
  const ws = wsClients.get(socketId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: event, data }));
  }
}
