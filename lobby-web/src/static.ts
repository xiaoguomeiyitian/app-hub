/** 静态文件服务 + 导航栏注入 */
import { Router, type Request, type Response } from 'express';
import { createReadStream, existsSync, statSync, readFileSync, realpathSync } from 'fs';
import { join, extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NAV_BAR } from './navbar';

const __dirname = dirname(fileURLToPath(import.meta.url));

function injectNavBarAndCsrf(html: string, res: Response): string {
  // 如果已包含导航栏标记，则不再注入
  if (html.includes('oc-nav-bar')) return html;

  // 注入 CSRF token meta（如果尚未存在）
  if (!html.includes('name="csrf-token"')) {
    const csrfToken = (res.locals as any).csrfToken || '';
    if (csrfToken) {
      const csrfMeta = `<meta name="csrf-token" content="${csrfToken}">`;
      html = html.replace(/<\/head>/, `${csrfMeta}<\/head>`);
    }
  }

  // 注入导航栏
  if (html.includes('<\/body>')) {
    html = html.replace(/<\/body>/, `${NAV_BAR}<\/body>`);
  } else {
    html += NAV_BAR;
  }
  return html;
}

const STATIC_ROOT = resolve(__dirname, '..', '..', 'static');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
};

function resolveFilePath(urlPath: string): string | null {
  const fullPath = resolve(STATIC_ROOT, urlPath.replace(/^\//, ''));
  // 路径遍历防护：使用 realpath 解析符号链接
  try {
    const realPath = realpathSync(fullPath);
    if (!realPath.startsWith(STATIC_ROOT)) return null;
  } catch {
    return null;
  }
  try { if (statSync(fullPath).isFile()) return fullPath; } catch {}
  try {
    if (statSync(fullPath).isDirectory()) {
      const indexPath = join(fullPath, 'index.html');
      if (existsSync(indexPath)) return indexPath;
    }
  } catch {}
  if (!extname(fullPath)) {
    const htmlPath = `${fullPath}.html`;
    if (existsSync(htmlPath)) return htmlPath;
  }
  return null;
}

export function createStaticRouter(): Router {
  const router = Router();

  router.get('*', (req: Request, res: Response) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);

    if (urlPath === '/' || urlPath === '/index.html') {
      try {
        const indexPath = resolve(STATIC_ROOT, 'index.html');
        if (!existsSync(indexPath)) {
          res.status(404).send('Not Found');
          return;
        }
        const rawHtml = readFileSync(indexPath, 'utf-8');
        const html = injectNavBarAndCsrf(rawHtml, res);
        res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.send(html);
        return;
      } catch (e) {
        console.error('❌ 首页渲染失败:', e);
        res.status(500).send('Home render error');
        return;
      }
    }

    const filePath = resolveFilePath(urlPath);
    if (!filePath) {
      res.status(404).send('Not Found');
      return;
    }

    const ext = extname(filePath);
    if (ext === '.html' && isSubProject(urlPath)) {
      try {
        const statInfo = statSync(filePath);
        const mtime = statInfo.mtime.toUTCString();
        const etag = `"${statInfo.size}-${Math.floor(statInfo.mtime.getTime() / 1000)}"`;
        const content = readFileSync(filePath, 'utf-8');
        const injected = content.includes('</body>')
          ? content.replace(/<\/body>/, `${NAV_BAR}</body>`)
          : content + NAV_BAR;
        res.set({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          'ETag': etag,
          'Last-Modified': mtime,
        });
        res.send(injected);
        return;
      } catch {
        res.status(500).send('Read Error');
        return;
      }
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const cacheControl = ext === '.html' ? 'no-cache' : 'public, max-age=31536000';
    res.set({ 'Content-Type': contentType, 'Cache-Control': cacheControl });
    createReadStream(filePath).pipe(res);
  });

  return router;
}

function isSubProject(urlPath: string): boolean {
  if (urlPath === '/' || urlPath === '/index.html') return false;
  const first = urlPath.split('/').filter(Boolean)[0];
  return !!first && first !== 'assets' && first !== 'favicon.ico';
}

console.log('🛠️ static router initialized (v3.2 — pure frontend shell, data from /api)');
