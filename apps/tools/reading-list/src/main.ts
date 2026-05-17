import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';
import { createChart } from '@app-hub/utils/charts';

const APP_NAME = 'Reading List';
const APP_VERSION = '1.3.0';
const APP_DESC = '阅读清单管理，支持状态跟踪';

let theme: 'light' | 'dark' = (localStorage.getItem('reading_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('reading_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('reading_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有阅读清单吗？此操作不可撤销。')) return;
  bookmarks = [];
  history = [];
  localStorage.clear();
  localStorage.setItem('reading_theme', theme);
  save(bookmarks).then(() => render());
}

function exportData(): void {
  const data = { bookmarks, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reading-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.bookmarks && Array.isArray(data.bookmarks)) {
        bookmarks = data.bookmarks;
        save(bookmarks).then(() => render());
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

interface Bookmark { id: string; url: string; title: string; desc: string; tags: string[]; status: 'unread' | 'reading' | 'read'; created: number; }

const STORAGE_DB = 'reading-list-db';
const store = createIdbStore(STORAGE_DB, 'kv');

async function load(): Promise<Bookmark[]> {
  try { const raw = await store.get('bookmarks'); return raw ?? []; }
  catch { return []; }
}
async function save(b: Bookmark[]): Promise<void> { await store.set('bookmarks', b); }

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let bookmarks: Bookmark[] = [];
let filter = 'all', searchQuery = '';

async function render(): Promise<void> {
  applyTheme();
  let filtered = bookmarks;
  if (filter !== 'all') filtered = filtered.filter(b => b.status === filter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(b => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || b.tags.some(t => t.includes(q)));
  }
  const counts = { all: bookmarks.length, unread: bookmarks.filter(b=>b.status==='unread').length, reading: bookmarks.filter(b=>b.status==='reading').length, read: bookmarks.filter(b=>b.status==='read').length };
  
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📚</span><span class="title">Reading List</span>
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
        <input type="text" id="search" class="search" placeholder="搜索..." value="${searchQuery}"/>
        <select id="filter-select" class="select">
          <option value="all" ${filter==='all'?'selected':''}>全部 (${counts.all})</option>
          <option value="unread" ${filter==='unread'?'selected':''}>未读 (${counts.unread})</option>
          <option value="reading" ${filter==='reading'?'selected':''}>在读 (${counts.reading})</option>
          <option value="read" ${filter==='read'?'selected':''}>已读 (${counts.read})</option>
        </select>
        <button class="btn-sm" id="add-bm">+ 添加</button>
      </div>
      <div class="bookmark-list">
        ${filtered.map(b => `
          <div class="bookmark-item status-${b.status}">
            <a href="${b.url}" target="_blank" class="bm-title">${b.title}</a>
            <div class="bm-status">${b.status}</div>
            ${b.tags.map(t => `<span class="tag">${t}</span>`).join('')}
            <button class="del-bm" data-id="${b.id}">×</button>
          </div>
        `).join('')}
        ${filtered.length === 0 ? '<p class="text-muted">暂无书籍</p>' : ''}
      </div>
      ${history.length > 0 ? `
        <div class="history">
          <div class="history-header">历史记录 <button class="btn-xs" id="clear-history">清空</button></div>
          ${history.slice(0, 5).map(h => `<div class="hist-item">${h}</div>`).join('')}
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

  document.getElementById('search')?.addEventListener('input', (e) => { searchQuery = (e.target as HTMLInputElement).value; render(); });
  document.getElementById('filter-select')?.addEventListener('change', (e) => { filter = (e.target as HTMLSelectElement).value; render(); });

  document.getElementById('add-bm')?.addEventListener('click', () => {
    const title = prompt('书名：');
    const url = prompt('URL：');
    if (title && url) {
      bookmarks.push({ id: uid(), url, title, desc: '', tags: [], status: 'unread', created: Date.now() });
      save(bookmarks).then(() => render());
    }
  });

  document.querySelectorAll('.del-bm').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      bookmarks = bookmarks.filter(b => b.id !== id);
      save(bookmarks).then(() => render());
    });
  });

  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('reading_history', JSON.stringify(history)); render();
  });
}

// 初始化
(async () => {
  bookmarks = await load();
  render();
})();
