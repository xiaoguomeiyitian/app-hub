import { log, LogLevel } from './logger.js';
import type { Express, NextFunction, Request, Response } from 'express';
import { Router as createRouter, type Router } from 'express';
import type { Server as HttpServer } from 'http';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { registerFallbackHealth } from './route-health.js';
import { createUpgradeAwareServer } from './upgrade-listener-registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXCLUDED_PROJECTS = new Set(['admin', 'auth', 'platform', 'platform-console']);

export interface ProjectRouteModule {
  router?: Router;
  socketSetup?: (httpServer: HttpServer, ioPath: string) => void;
  description?: string;
}

export interface LoadedProject {
  name: string;
  description: string;
  hasRouter: boolean;
  hasSocket: boolean;
}

export interface RouteRegistry {
  has(projectName: string): boolean;
  get(projectName: string): LoadedProject | undefined;
  set(projectName: string, project: LoadedProject): void;
  values(): IterableIterator<LoadedProject>;
  keys(): IterableIterator<string>;
}

function resolveModulePath(projectName: string): string {
  const candidates = [
    join(__dirname, 'routes', projectName, 'index.js'),
    join(__dirname, 'routes', projectName, 'index.ts'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

export async function loadProjectRoute(
  projectName: string,
  app: Express,
  httpServer: HttpServer,
  registry: RouteRegistry,
): Promise<LoadedProject | null> {
  if (EXCLUDED_PROJECTS.has(projectName)) {
    log(LogLevel.INFO, `🚫 项目 "${projectName}" 已被排除，不加载`);
    return null;
  }

  if (registry.has(projectName)) {
    log(LogLevel.INFO, `⏭️  项目 "${projectName}" 已加载，跳过`);
    return registry.get(projectName) ?? null;
  }

  const modulePath = resolveModulePath(projectName);
  const basePath = `/api/${projectName}`;

  try {
    // 使用计数器确保每次热加载 URL 唯一（Date.now() 在快速连续调用时可能重复）
    const moduleUrl = `${pathToFileURL(modulePath).href}?t=${Date.now()}_${process.hrtime.bigint()}`;
    const mod = (await import(moduleUrl)) as { default?: ProjectRouteModule } & ProjectRouteModule;
    const routeModule: ProjectRouteModule = mod.default ?? mod;

    const loaded: LoadedProject = {
      name: projectName,
      description: routeModule.description ?? projectName,
      hasRouter: !!routeModule.router,
      hasSocket: !!routeModule.socketSetup,
    };

    if (routeModule.router) {
      const safeRouter = createRouter();
      safeRouter.use(routeModule.router);
      safeRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        log(LogLevel.ERROR,`❌ 项目 "${projectName}" 请求错误:`, err);
        res.status(500).json({ error: 'internal_error', project: projectName });
      });
      app.use(basePath, safeRouter);
      log(LogLevel.INFO, `📦 路由已注册：${basePath}`);
    }

    if (routeModule.socketSetup) {
      const wsServer = createUpgradeAwareServer(httpServer);
      routeModule.socketSetup(wsServer, basePath);
      log(LogLevel.INFO, `🔌 WebSocket 已注册：${basePath}/websocket/`);
    }

    if (!routeModule.router) {
      registerFallbackHealth(app, basePath, projectName);
    }

    registry.set(projectName, loaded);
    log(LogLevel.INFO, `✅ 项目 "${projectName}" 加载成功`);
    return loaded;
  } catch (err) {
    log(LogLevel.ERROR,`❌ 加载项目 "${projectName}" 失败:`, err);
    return null;
  }
}
