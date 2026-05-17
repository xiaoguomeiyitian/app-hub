import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';

const APP_NAME = 'Bookmark Manager';
const APP_VERSION = '1.3.0';
const APP_DESC = '书签管理工具，支持文件夹和标签';

interface BM { id: string; url: string; title: string; desc: string; folder: string; tags: string[]; }

let theme: 'light' | 'dark' = (localStorage.getItem('bm_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('bm_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有书签吗？此操作不可撤销。')) return;
  bookmarks = [];
  localStorage.clear();
  localStorage.setItem('bm_theme', theme);
  save(bookmarks).then(() => render());
}

function exportData(): void {
  const data = { bookmarks, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bookmarks.json'; a.click();
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

const STORAGE_DB = 'bookmark-manager-db';
const store = createIdbStore(STORAGE_DB, 'kv');

async function load(): Promise<BM[]> {
  try {
    const raw = await store.get('bookmarks');
    return raw ?? [];
  } catch (e) {
    console.error('Load failed', e);
    return [];
  }
}

async function save(b: BM[]): Promise<void> {
  await store.set('bookmarks', b);
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let bookmarks: BM[] = [];
let activeFolder = '';
let searchQuery = '';

function getFolders(): string[] { return [...new Set(bookmarks.map(b => b.folder).filter(Boolean))]; }

function render(): void {
  applyTheme();
  let filtered = bookmarks;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(b => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || b.tags.some(t => t.toLowerCase().includes(q)));
  }
  if (activeFolder) filtered = filtered.filter(b => b.folder === activeFolder);

  const folders = getFolders();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🔖</span><span class="title">Bookmark Manager</span>
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
        <input type="text" id="search" class="search" placeholder="搜索书签..." value="${searchQuery}"/>
        <select id="folder-filter" class="select">
          <option value="">全部文件夹</option>
          ${folders.map(f => `<option value="${f}" ${activeFolder === f ? 'selected' : ''}>${f}</option>`).join('')}
        </select>
        <button class="btn-sm" id="add-bm">+ 添加书签</button>
      </div>
      <div class="bookmark-list">
        ${filtered.map(b => `
          <div class="bookmark-item">
            <a href="${b.url}" target="_blank" class="bm-title">${b.title}</a>
            <div class="bm-url">${b.url}</div>
            ${b.desc ? `<div class="bm-desc">${b.desc}</div>` : ''}
            ${b.tags.map(t => `<span class="tag">${t}</span>`).join('')}
            <button class="del-bm" data-id="${b.id}">×</button>
          </div>
        `).join('')}
        ${filtered.length === 0 ? '<p class="text-muted">暂无书签</p>' : ''}
      </div>
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
  document.getElementById('folder-filter')?.addEventListener('change', (e) => { activeFolder = (e.target as HTMLSelectElement).value; render(); });
  
  document.getElementById('add-bm')?.addEventListener('click', () => {
    const title = prompt('标题：');
    const url = prompt('URL：');
    if (title && url) {
      bookmarks.push({ id: uid(), title, url, desc: '', folder: activeFolder, tags: [] });
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
}

// 初始化
(async () => {
  bookmarks = await load();
  render();
})();
