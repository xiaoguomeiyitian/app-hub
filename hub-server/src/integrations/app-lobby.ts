/**
 * app-lobby 集成层
 *
 * v3.3 架构：已移除旧版 Socket.IO 兼容代理（WS-BAN-1）。
 * 所有项目统一使用原生 WebSocket（/api/<project>/websocket）。
 */

import type { Express } from 'express';
import type { Server as HttpServer } from 'http';

export function registerAppLobbyIntegration(_app: Express, _httpServer: HttpServer): void {
  // 旧版 SIO 代理已移除，新项目统一使用原生 WebSocket
}
