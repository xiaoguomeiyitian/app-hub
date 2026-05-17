/**
 * 原生 WebSocket 反向代理
 *
 * 将前端客户端连接代理到后端的原生 WebSocket 端点。
 * 路径规则：/sio/<project>/websocket → 后端 /api/<project>/websocket
 */

import type { Express } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const BACKEND_HOST = process.env.BACKEND_HOST || '97.383636.xyz';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '20008', 10);

export function registerWebSocketProxy(_app: Express, httpServer: HttpServer): void {
  httpServer.on('upgrade', (req, socket, head) => {
    const url = req.url || '';
    const match = url.match(/^\/sio\/([^/]+)\/websocket(?:\/([^/?]+))?/);
    if (!match) return;

    const project = match[1];
    const optionalSid = match[2];
    const wss = new WebSocketServer({ noServer: true });

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const backendUrl = `ws://${BACKEND_HOST}:${BACKEND_PORT}/api/${project}/websocket${optionalSid ? `?sid=${optionalSid}` : ''}`;
      const backendWs = new WebSocket(backendUrl, {
        headers: { host: `${BACKEND_HOST}:${BACKEND_PORT}` },
      });

      clientWs.on('message', (data) => {
        if (backendWs.readyState === WebSocket.OPEN) backendWs.send(data);
      });
      backendWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
      });
      clientWs.on('close', () => {
        if (backendWs.readyState === WebSocket.OPEN) backendWs.close();
      });
      backendWs.on('close', () => {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
      });
      clientWs.on('error', () => {
        if (backendWs.readyState === WebSocket.OPEN) backendWs.close();
      });
      backendWs.on('error', () => {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
      });
    });
  });

  console.log('🔌 WebSocket 代理已注册: /sio/<project>/websocket');
}
