import express, { type Express } from 'express';
import { existsSync, readFileSync, statSync } from 'fs';
import { NAV_BAR } from './static-ui.js';
import { STATIC_ROOT, HOME_URL } from './config.js';

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

  app.use((req, res, next) => {
    const routePath = req.path || req.url || '';
    if (!routePath || routePath === '/' || routePath.startsWith('/api') || routePath.startsWith('/health') || routePath.includes('.')) {
      return next();
    }
    const accept = String(req.headers.accept || '');
    if (!accept.includes('text/html')) return next();
    const file = `${STATIC_ROOT}${routePath.endsWith('/') ? routePath : `${routePath}/`}index.html`;
    if (!existsSync(file)) return next();
    try {
      const statInfo = statSync(file); // 需要导入 statSync
      const mtime = statInfo.mtime.toUTCString();
      const etag = `"${statInfo.size}-${Math.floor(statInfo.mtime.getTime() / 1000)}"`;
      let html = readFileSync(file, 'utf-8');
      if (!html.includes('oc-nav-bar')) {
        // 1) 确保 <body> 有顶部内边距（避免被 fixed 导航栏遮挡）
        html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
          void match;
          const hasPadding = /padding-top\s*:/.test(attrs);
          const style = hasPadding ? attrs : `${attrs}${attrs ? ';' : ''}${NAV_PADDING_STYLE}`;
          return `<body${style}>`;
        });
        // 2) 如果页面缺少 CSRF token meta，注入 csrf-token（全局可用）
        if (!html.includes('name="csrf-token"')) {
          const csrfToken = res.locals.csrfToken || '';
          if (csrfToken) {
            const csrfMeta = `<meta name="csrf-token" content="${csrfToken}">`;
            html = html.replace(/<\/head>/, `${csrfMeta}<\/head>`);
          }
        }
        // 3) 在 </body> 前安全注入导航栏（静态模板）
        html = html.replace(/<\/body>/, `${NAV_BAR}<\/body>`);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', mtime);
      res.send(html);
      return;
    } catch {
      return next();
    }
  });

  app.use('/app-lobby', express.static('/root/projects/app-hub/static/app-lobby', { index: 'index.html', extensions: ['html', 'js'], redirect: false }));

  app.use(express.static(STATIC_ROOT, { index: 'index.html', extensions: ['html'], redirect: false }));

  app.get('/', (_req, res) => {
    const indexPath = `${STATIC_ROOT}/index.html`;
    if (existsSync(indexPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.sendFile(indexPath);
      return;
    }
    res.status(404).send('Home not found');
  });
}
