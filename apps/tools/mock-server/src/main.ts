import '@app-hub/design-system/src/style.css';
import '@app-hub/utils/theme/variables.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';

const APP_NAME = 'Mock Server';
const APP_VERSION = '1.3.0';
const APP_DESC = '模拟 API 服务器，支持自定义路由';

let theme: 'light' | 'dark' = (localStorage.getItem('mock_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('mock_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('mock_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有路由吗？此操作不可撤销。')) return;
  routes = [];
  localStorage.clear();
  localStorage.setItem('mock_theme', theme);
  saveLocal().then(() => render());
}

function exportData(): void {
  const data = { routes, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mock-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.routes && Array.isArray(data.routes)) {
        routes = data.routes;
        saveLocal().then(() => render());
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

interface Route {
  id: string;
  method: string;
  path: string;
  status: number;
  delay: number;
  body: string;
}

const STORAGE_KEY = 'mock-server-routes';
const MOCK_DB = 'mock-server-db';
const store = createIdbStore(MOCK_DB, 'kv');

let routes: Route[] = [];
let selectedId: string | null = null;
let persistMode = false;

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

async function loadLocal(): Promise<Route[]> {
  try {
    const raw = await store.get(STORAGE_KEY);
    return raw ?? [];
  } catch { return []; }
}

async function saveLocal(): Promise<void> {
  await store.set(STORAGE_KEY, routes);
}

async function startServer(): Promise<void> {
  // 简化的启动逻辑
  alert('模拟服务器已启动（模拟）');
}

function render(): void {
  applyTheme();
  const sel = routes.find(r => r.id === selectedId);
  const app = document.getElementById('app')!;
  
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🎭</span><span class="title">Mock Server</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="controls">
        <select id="method-select" class="select">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input type="text" id="path-input" placeholder="/api/..." class="f-input" />
        <input type="number" id="status-input" placeholder="状态码" class="f-input" value="200" />
        <input type="number" id="delay-input" placeholder="延迟(ms)" class="f-input" value="0" />
        <button class="btn-sm" id="add-route">+ 添加路由</button>
        <button class="btn-sm" id="start-server">▶ 启动</button>
      </div>
      <div class="route-list">
        ${routes.map(r => `
          <div class="route-item ${r.id === selectedId ? 'active' : ''}" data-id="${r.id}">
            <span class="method-${r.method}">${r.method}</span>
            <span class="route-path">${r.path}</span>
            <span class="route-status">${r.status}</span>
            <button class="del-route" data-id="${r.id}">×</button>
          </div>
        `).join('')}
        ${routes.length === 0 ? '<p class="text-muted">暂无路由</p>' : ''}
      </div>
      ${sel ? `
        <div class="route-editor">
          <div class="editor-label">响应体 (JSON)</div>
          <textarea id="body-editor" class="code-editor">${sel.body}</textarea>
          <button class="btn-sm" id="save-body">💾 保存</button>
        </div>
      ` : ''}
      ${history.length > 0 ? `
        <div class="history">
          <div class="history-header">历史记录 <button class="btn-xs" id="clear-history">清空</button></div>
          ${history.slice(0, 3).map(h => `<div class="hist-item">${h.slice(0, 50)}...</div>`).join('')}
        </div>
      ` : ''}
    </main>
  </div>`;
  bindEvents();
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });

  document.getElementById('add-route')?.addEventListener('click', () => {
    const method = (document.getElementById('method-select') as HTMLSelectElement)?.value;
    const path = (document.getElementById('path-input') as HTMLInputElement)?.value;
    if (path) {
      routes.push({ id: uid(), method, path, status: 200, delay: 0, body: '{}' });
      saveLocal().then(() => render());
    }
  });

  document.getElementById('start-server')?.addEventListener('click', () => {
    startServer();
  });

  document.querySelectorAll('.route-item').forEach(item => {
    item.addEventListener('click', () => {
      selectedId = (item as HTMLElement).dataset.id!;
      render();
    });
  });

  document.querySelectorAll('.del-route').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      routes = routes.filter(r => r.id !== id);
      if (selectedId === id) selectedId = null;
      saveLocal().then(() => render());
    });
  });

  document.getElementById('save-body')?.addEventListener('click', () => {
    const body = (document.getElementById('body-editor') as HTMLTextAreaElement)?.value;
    const sel = routes.find(r => r.id === selectedId);
    if (sel) { sel.body = body || '{}'; saveLocal(); }
  });

  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('mock_history', JSON.stringify(history)); render();
  });

  // 保存历史
  routes.forEach(r => {
    history.unshift(`${r.method} ${r.path}`);
  });
  if (history.length > 10) history.pop();
  localStorage.setItem('mock_history', JSON.stringify(history));
}

// 初始化
(async () => {
  routes = await loadLocal();
  render();
})();
