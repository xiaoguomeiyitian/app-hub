/**
 * app-lobby — 入口层壳
 * 
 * v3.3 架构：app-lobby 只负责前端页面服务与导航栏注入。
 * 数据、统计、收藏等平台能力由 shared-backend 统一提供。
 * 已移除旧版 Socket.IO 兼容代理，统一使用原生 WebSocket。
 * 
 * 默认不监听端口，仅在显式开启 standalone 时才启动。
 */

import express from 'express';
import { createServer } from 'http';
import { createStaticRouter } from './static';
import { registerWebSocketProxy } from './ws-proxy';

export const APP_LOBBY_PORT = parseInt(process.env.PORT || '20008', 10);

// CORS 白名单，通过环境变量配置，逗号分隔多个域名
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'https://97.383636.xyz,https://97.testgame.online')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export function attachAppLobby(app: express.Express, httpServer: ReturnType<typeof createServer>): void {
  app.use((_req, res, next) => {
    // 限制为应用大厅域名
    const allowedOrigins = CORS_ORIGINS;
    const origin = _req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    } else {
      res.set('Access-Control-Allow-Origin', allowedOrigins[0]);
    }
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  registerWebSocketProxy(app, httpServer);
  app.use(createStaticRouter());
}

export function createAppLobbyStandalone(): { httpServer: ReturnType<typeof createServer> } {
  const app = express();
  const httpServer = createServer(app);
  attachAppLobby(app, httpServer);
  return { httpServer };
}

export async function startAppLobbyStandalone(): Promise<void> {
  const { httpServer } = createAppLobbyStandalone();
  httpServer.listen(APP_LOBBY_PORT, '0.0.0.0', () => {
    console.log(`🎮 app-lobby standalone listening on ${APP_LOBBY_PORT}`);
  });
}

if (process.env.OC_APP_LOBBY_STANDALONE === '1') {
  void startAppLobbyStandalone();
}
