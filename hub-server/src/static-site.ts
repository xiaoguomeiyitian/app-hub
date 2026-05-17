import express, { type Express } from 'express';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { NAV_BAR } from './static-ui.js';
import { STATIC_ROOT, HOME_URL } from './config.js';
import { buildLobbyHtml } from './lobby-page.js';

const NAV_PADDING_STYLE = 'padding-top:56px;';
// 从 HOME_URL 提取基础路径，格式如 /openclaw/20008/
const OPENCLAW_BASE_PREFIX = HOME_URL.replace(/\/+$/, '');

function normalizeStaticUrl(url: string): string {
  if (url.startsWith(OPENCLAW_BASE_PREFIX)) {
    const stripped = url.slice(OPENCLAW_BASE_PREFIX.length) || '/';
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }
  return url;
}

export function registerStaticSite(app: Express): void {
  app.use((req, _res, next) => {
    const originalUrl = req.url || '/';
    const normalizedUrl = normalizeStaticUrl(originalUrl);
    if (normalizedUrl !== originalUrl) {
      req.url = normalizedUrl;
    }
    next();
  });

  // 应用静态文件服务：/<appName>/... → static/<appName>/...
  // 由 sync-static.js 将各应用 dist/ 内容复制到 static/<appName>/
  app.use((req, res, next) => {
    const routePath = req.path || req.url || '';
    if (!routePath || routePath === '/' || routePath.startsWith('/api') || routePath.startsWith('/health')) {
      return next();
    }

    // 提取第一段路径作为应用名
    const segments = routePath.split('/').filter(Boolean);
    if (segments.length === 0) return next();
    const appName = segments[0];

    // 检查 static/<appName>/ 是否存在
    const appStaticDir = join(STATIC_ROOT, appName);
    if (!existsSync(appStaticDir)) return next();

    const remainingPath = segments.slice(1).join('/');
    const filePath = remainingPath ? join(appStaticDir, remainingPath) : appStaticDir;

    // 路径安全检查
    if (!filePath.startsWith(appStaticDir)) return next();

    // 解析文件
    let servePath = filePath;
    try {
      const st = statSync(filePath);
      if (st.isDirectory()) {
        const idx = join(filePath, 'index.html');
        if (existsSync(idx)) {
          servePath = idx;
        } else {
          return next();
        }
      }
    } catch {
      if (!filePath.includes('.')) {
        const htmlPath = filePath + '.html';
        if (existsSync(htmlPath)) {
          servePath = htmlPath;
        } else {
          return next();
        }
      } else {
        return next();
      }
    }

    // 读取 HTML 并注入导航栏 + CSRF
    try {
      const ext = servePath.split('.').pop()?.toLowerCase();
      if (ext === 'html') {
        let html = readFileSync(servePath, 'utf-8');
        if (!html.includes('oc-nav-bar')) {
          html = html.replace(/<body([^>]*)>/i, (_match: string, attrs: string) => {
            const hasPadding = /padding-top\s*:/.test(attrs);
            if (hasPadding) return `<body${attrs}>`;
            const style = attrs ? `${attrs} ${NAV_PADDING_STYLE}` : ` ${NAV_PADDING_STYLE}`;
            return `<body${style}>`;
          });
          if (!html.includes('name="csrf-token"')) {
            const csrfToken = (res.locals as Record<string, string>).csrfToken || '';
            if (csrfToken) {
              const csrfMeta = `<meta name="csrf-token" content="${csrfToken}">`;
              html = html.replace(/<\/head>/, `${csrfMeta}<\/head>`);
            }
          }
          html = html.replace(/<\/body>/, `${NAV_BAR}<\/body>`);
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(html);
      } else {
        // 非 HTML 文件，用 express.static 处理
        next();
      }
    } catch {
      next();
    }
  });

  // 兜底：static 目录下的其他静态资源
  app.use(express.static(STATIC_ROOT, { index: false, extensions: ['html'], redirect: false }));

  // 大厅首页
  app.get('/', (_req, res) => {
    const indexPath = `${STATIC_ROOT}/index.html`;
    if (existsSync(indexPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.sendFile(indexPath);
      return;
    }
    const baseUrl = OPENCLAW_BASE_PREFIX + '/';
    const html = buildLobbyHtml(baseUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  });
}
