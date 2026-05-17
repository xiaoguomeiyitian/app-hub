import express from 'express';
import { createServer } from 'http';
import { PORT } from './config.js';
import { initAllRoutes } from './router.js';
import { registerApiRoutes, registerHttpStack, startRouteMonitoring } from './http-stack.js';
import { registerAppLobbyIntegration } from './integrations/app-lobby.js';
import { log, LogLevel } from './logger.js';
import { closeAllDatabases } from './db.js';

process.on('uncaughtException', (err) => {
  log(LogLevel.ERROR, '⚠️ 全局未捕获异常，进程即将退出:', err);
  // 给日志输出一点时间后退出
  setTimeout(() => process.exit(1), 1000);
});
process.on('unhandledRejection', (err) => {
  log(LogLevel.ERROR, '⚠️ 全局未处理 Promise 拒绝，进程即将退出:', err);
  setTimeout(() => process.exit(1), 1000);
});

const app = express();
const httpServer = createServer(app);

// 信任代理（Nginx 反向代理），使 X-Forwarded-For 头生效，速率限制能正确识别用户 IP
// 设置为 1 表示只信任第一层代理（Nginx），防止客户端伪造 IP
app.set('trust proxy', 1);

// HttpServer 类型未包含 setMaxListeners，需类型断言
(httpServer as { setMaxListeners(n: number): void }).setMaxListeners(0);

// ==================== App Setup ====================

let startPromise: Promise<void> | null = null;

registerHttpStack(app);  // 内部已包含 registerStaticSite
registerAppLobbyIntegration(app, httpServer);
registerApiRoutes(app, httpServer);

// 统一错误处理中间件（必须注册在所有路由之后）
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log(LogLevel.ERROR,'❌ 请求处理异常:', err);
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({ error: 'internal_error', message: isDev ? err.message : undefined });
});

async function start(): Promise<void> {
  if (startPromise) return startPromise;

  startPromise = (async () => {
    const loaded = await initAllRoutes(app, httpServer);

    log(LogLevel.INFO, `🔧 统一入口服务运行在 0.0.0.0:${PORT}`);
    log(LogLevel.INFO, `   内网: http://localhost:${PORT}/`);
    log(LogLevel.INFO, `   外网: https://97.383636.xyz/code/${PORT}/`);
    log(LogLevel.INFO, `   健康检查: http://localhost:${PORT}/health`);
    log(LogLevel.INFO, `   项目列表: http://localhost:${PORT}/api`);
    log(LogLevel.INFO, `   已加载项目: ${loaded.map((p) => p.name).join(', ') || '(无)'}`);

    await startRouteMonitoring(app, httpServer);
    if (!(globalThis as { __oc_listen_started__?: boolean }).__oc_listen_started__) {
      (globalThis as { __oc_listen_started__?: boolean }).__oc_listen_started__ = true;
      httpServer.listen(PORT, '0.0.0.0');
    }
  })();

  return startPromise;
}

start().catch((err) => {
  log(LogLevel.ERROR, '❌ 服务启动失败，进程退出:', err);
  process.exit(1);
});

// 优雅退出：关闭数据库连接
function gracefulShutdown(signal: string): void {
  log(LogLevel.INFO, `📡 收到 ${signal} 信号，开始优雅退出...`);
  closeAllDatabases();
  httpServer.close(() => {
    log(LogLevel.INFO, '✅ HTTP 服务器已关闭');
    process.exit(0);
  });
  // 强制退出超时
  setTimeout(() => {
    log(LogLevel.ERROR, '⚠️ 强制退出（超时）');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));