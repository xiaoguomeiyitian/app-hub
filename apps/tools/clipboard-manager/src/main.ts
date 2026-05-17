import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';

const APP_NAME = 'Clipboard Manager';
const APP_VERSION = '1.3.0';
const APP_DESC = '剪贴板历史管理器，支持分类和固定';

interface Clip { id: string; text: string; type: string; pinned: boolean; time: number; }

let theme: 'light' | 'dark' = (localStorage.getItem('clip_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('clip_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有剪贴板记录吗？此操作不可撤销。')) return;
  clips = [];
  localStorage.clear();
  localStorage.setItem('clip_theme', theme);
  save(clips).then(() => render());
}

function exportData(): void {
  const data = { clips, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clipboard-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.clips && Array.isArray(data.clips)) {
        clips = data.clips;
        save(clips).then(() => render());
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

const STORAGE_DB = 'clipboard-manager-db';
const store = createIdbStore(STORAGE_DB, 'kv');

async function load(): Promise<Clip[]> {
  try {
    const raw = await store.get('clips');
    return raw ?? [];
  } catch { return []; }
}

async function save(c: Clip[]): Promise<void> {
  await store.set('clips', c);
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function classify(text: string): string { if (/^https?:\/\//.test(text)) return 'URL'; if (/[{}<>;]/.test(text) && /[()]/.test(text)) return 'Code'; return 'Text'; }

let clips: Clip[] = [];
let searchQuery = '';

function render(): void {
  applyTheme();
  let filtered = clips;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c => c.text.toLowerCase().includes(q));
  }

  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📋</span><span class="title">Clipboard Manager</span>
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
        <input type="text" id="search" class="search" placeholder="搜索剪贴板..." value="${searchQuery}"/>
        <button class="btn-sm" id="clear-all">清空全部</button>
      </div>
      <div class="clip-list">
        ${filtered.map(c => `
          <div class="clip-item ${c.pinned ? 'pinned' : ''}">
            <div class="clip-type">${c.type}</div>
            <div class="clip-text">${c.text.slice(0, 100)}${c.text.length > 100 ? '...' : ''}</div>
            <div class="clip-actions">
              <button class="pin-btn" data-id="${c.id}">${c.pinned ? '📌' : '📍'}</button>
              <button class="copy-clip" data-text="${c.text.replace(/"/g, '&quot;')}">📋</button>
              <button class="del-clip" data-id="${c.id}">×</button>
            </div>
          </div>
        `).join('')}
        ${filtered.length === 0 ? '<p class="text-muted">暂无剪贴板记录</p>' : ''}
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
  document.getElementById('clear-all')?.addEventListener('click', () => {
    clips = [];
    save(clips).then(() => render());
  });

  document.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      const clip = clips.find(c => c.id === id);
      if (clip) { clip.pinned = !clip.pinned; save(clips).then(() => render()); }
    });
  });

  document.querySelectorAll('.copy-clip').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = (btn as HTMLElement).dataset.text || '';
      navigator.clipboard.writeText(text);
    });
  });

  document.querySelectorAll('.del-clip').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      clips = clips.filter(c => c.id !== id);
      save(clips).then(() => render());
    });
  });
}

// 初始化
(async () => {
  clips = await load();
  render();
})();
