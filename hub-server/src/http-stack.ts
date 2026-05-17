import { log, LogLevel } from './logger.js';
import express, { type Express } from 'express';
import type { Server as HttpServer } from 'http';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { PORT } from './config.js';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'crypto';
import { buildCategories, getMergedProjects, resetStaticDiscoveryCache } from './project-catalog.js';
import { getLoadedProjects, rescanAndLoad } from './router.js';
import { registerStaticSite } from './static-site.js';
import { buildLobbyFoundationSnapshot, buildLobbyOnboardingSnapshot } from './lobby-snapshot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function ensureAnalyticsTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      project TEXT NOT NULL,
      event_type TEXT NOT NULL,
      duration_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_events_project ON events(project);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
  `);
}

function getAnalyticsDb(): Database.Database {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const dbPath = join(DATA_DIR, 'analytics.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  
  ensureAnalyticsTables(db);
  
  return db;
}

const analyticsDb = getAnalyticsDb();

let clickCountsCache: Map<string, number> | null = null;
let clickCountsCacheTime = 0;
let clickCountsCachePromise: Promise<Map<string, number>> | null = null;
const CLICK_COUNTS_CACHE_TTL_MS = 30_000; // 30 秒缓存

/**
 * 加载点击统计（带单flight模式防止缓存击穿）
 */
async function loadClickCounts(): Promise<Map<string, number>> {
  const now = Date.now();
  if (clickCountsCache && (now - clickCountsCacheTime) < CLICK_COUNTS_CACHE_TTL_MS) {
    return clickCountsCache;
  }
  
  // 如果已有请求在进行中，返回同一个 promise（防止缓存击穿）
  if (clickCountsCachePromise) {
    return clickCountsCachePromise;
  }
  
  clickCountsCachePromise = (async () => {
    try {
      const rows = analyticsDb.prepare(`SELECT project, COUNT(*) AS pv FROM events GROUP BY project`).all() as Array<{ project: string; pv: number }>;
      clickCountsCache = new Map(rows.map((row) => [row.project, Number(row.pv || 0)]));
      clickCountsCacheTime = Date.now();
      return clickCountsCache;
    } catch (err) {
      log(LogLevel.ERROR, '❌ 读取统计失败:', err);
      return new Map();
    } finally {
      clickCountsCachePromise = null;
    }
  })();
  
  return clickCountsCachePromise;
}

async function attachClickCounts<T extends { name: string; clickCount?: number }>(projects: T[]): Promise<Array<T & { clickCount: number }>> {
  const counts = await loadClickCounts();
  return projects.map((project) => ({ ...project, clickCount: counts.get(project.name) ?? 0 }));
}

// 轻量级 CSRF Token 生成与验证（替代已废弃的 csurf）
function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

function csrfMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // 安全方法不需要 CSRF 验证
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    // 为每个会话生成/刷新 CSRF Token
    if (!req.cookies['csrf-token']) {
      const token = generateCsrfToken();
      res.cookie('csrf-token', token, { httpOnly: false, sameSite: 'strict', secure: true });
      res.locals.csrfToken = token;
    } else {
      res.locals.csrfToken = req.cookies['csrf-token'];
    }
    return next();
  }

  // 非安全方法验证 CSRF Token
  const cookieToken = req.cookies['csrf-token'];
  const bodyToken = req.body?._csrf;
  const headerToken = req.headers['x-csrf-token'];

  const submittedToken = bodyToken || headerToken;

  if (!cookieToken || !submittedToken || cookieToken !== submittedToken) {
    log(LogLevel.WARN, '❌ CSRF 验证失败', { path: req.path, ip: req.ip });
    res.status(403).json({ error: 'csrf_validation_failed' });
    return;
  }

  next();
}

export function registerHttpStack(app: Express): void {
  // 解析 Cookie
  app.use(cookieParser());

  // 解析请求体（必须在 CSRF 中间件之前，否则 req.body 为 undefined）
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // CSRF 防护中间件
  app.use(csrfMiddleware);

  // 速率限制：API 接口 100 次/分钟/IP
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 分钟
    max: 100,
    message: { error: '请求过于频繁（速率限制）' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter);

  app.use((req, _res, next) => {
    if (req.method === 'OPTIONS') return next();
    next();
  });
  registerStaticSite(app);
}

// 管理员 API Key 认证中间件
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!ADMIN_API_KEY) {
    // 未配置 API Key 时拒绝所有管理请求
    res.status(401).json({ error: 'admin_api_key_not_configured' });
    return;
  }
  const apiKey = req.headers['x-admin-api-key'] || req.query.apiKey;
  if (apiKey !== ADMIN_API_KEY) {
    log(LogLevel.WARN, `⚠️ 未授权的管理接口访问: ${req.method} ${req.path} from ${req.ip}`);
    res.status(403).json({ error: 'unauthorized' });
    return;
  }
  next();
}

export function registerApiRoutes(app: Express, httpServer: HttpServer): void {
  app.get('/health', async (_req, res) => {
    const projects = await attachClickCounts(getMergedProjects(getLoadedProjects()));
    res.json({
      status: 'ok',
      port: PORT,
      projects: projects.map((p) => ({ name: p.name, label_zh: p.label_zh, category: p.category, clickCount: p.clickCount })),
      uptime: process.uptime(),
    });
  });

  app.get('/api', async (_req, res) => {
    const projects = await attachClickCounts(getMergedProjects(getLoadedProjects()));
    res.json({ status: 'ok', projects, categories: buildCategories(projects) });
  });

  app.get('/api/projects', async (_req, res) => {
    const projects = await attachClickCounts(getMergedProjects(getLoadedProjects()));
    res.json({ status: 'ok', projects, categories: buildCategories(projects) });
  });

  app.get('/api/foundation', (_req, res) => {
    const projects = getMergedProjects(getLoadedProjects());
    res.json({ status: 'ok', snapshot: buildLobbyFoundationSnapshot(projects) });
  });

  app.get('/api/onboarding', (_req, res) => {
    const projects = getMergedProjects(getLoadedProjects());
    res.json({ status: 'ok', snapshot: buildLobbyOnboardingSnapshot(projects), categories: buildCategories(projects) });
  });


  app.post('/api/click', (req, res) => {
    const { project } = req.body;
    if (!project || typeof project !== 'string') {
      return res.status(400).json({ error: 'project is required' });
    }
    try {
      analyticsDb.prepare(`INSERT INTO events (user_id, project, event_type, duration_ms) VALUES ('lobby', ?, 'click', 0)`).run(project);
      const row = analyticsDb.prepare(`SELECT COUNT(*) AS pv FROM events WHERE project = ? AND event_type = 'click'`).get(project) as { pv: number };
      res.json({ project, clickCount: Number(row.pv || 0) });
    } catch (err) {
      res.status(500).json({ error: 'database error' });
    }
  });

  app.post('/api/_rescan', adminAuth, async (_req, res) => {
    try {
      resetStaticDiscoveryCache();
      const result = await rescanAndLoad(app, httpServer);
      const projects = await attachClickCounts(getMergedProjects(getLoadedProjects()));
      res.json({
        status: 'ok',
        message: result.newProjects.length > 0
          ? `新加载项目: ${result.newProjects.join(', ')}`
          : '没有新项目需要加载',
        newProjects: result.newProjects,
        allProjects: result.allProjects,
        projects,
        categories: buildCategories(projects),
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: String(err) });
    }
  });

  // 仅在开发环境注册调试路由
  if (process.env.NODE_ENV === 'development') {
    app.get('/debug-query', (req, res) => {
      res.json({
        url: req.url,
        originalUrl: req.originalUrl,
        path: req.path,
        query: req.query,
        rawUrl: (req as { originalUrl?: string }).originalUrl || req.url,
        rawHeaders: req.rawHeaders.filter((_, i) => i % 2 === 0).slice(0, 10),
        headers: {
          host: req.headers.host,
          'x-forwarded-for': req.headers['x-forwarded-for'],
          'x-forwarded-proto': req.headers['x-forwarded-proto'],
          'cf-connecting-ip': req.headers['cf-connecting-ip'],
        },
      });
    });

    app.get('/debug-loaded', (_req, res) => {
      if (process.env.NODE_ENV === 'development') {
        log(LogLevel.INFO, '[DEBUG] /debug-loaded invoked');
      }
      const loaded = getLoadedProjects();
      res.json({ loaded: loaded.map(p => ({ name: p.name, description: p.description, hasRouter: p.hasRouter, hasSocket: p.hasSocket })) });
    });
  }
}

export async function startRouteMonitoring(_app: Express, _httpServer: HttpServer): Promise<void> {
  log(LogLevel.INFO, '👁️  项目目录自动轮询已关闭，改为手动 /api/_rescan 触发');
}
