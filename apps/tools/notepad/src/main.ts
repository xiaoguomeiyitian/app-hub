import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';

const APP_NAME = 'Notepad';
const APP_VERSION = '1.3.0';
const APP_DESC = '支持 Markdown 的多功能笔记应用，带文件夹和标签管理';

interface Note { id: string; title: string; content: string; folder: string; tags: string[]; updated: number; }

const STORAGE_DB = 'notepad-db';
const store = createIdbStore(STORAGE_DB, 'kv');

let notes: Note[] = [];
let selectedId: string | null = null;
let searchQuery = '';
let activeFolder = '';
let showSidebar = true;
let theme: 'light' | 'dark' = (localStorage.getItem('notepad_theme') as 'light' | 'dark') || 'light';
let showFind = false;
let findQuery = '';
let replaceQuery = '';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('notepad_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有笔记吗？此操作不可撤销。')) return;
  notes = []; selectedId = null; searchQuery = ''; activeFolder = '';
  localStorage.clear();
  store.set('notes', []).then(() => { applyTheme(); render(); });
}

// JSON 导入/导出
function exportJSON(): void {
  const data = { notes, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'notepad-data.json'; a.click();
}

function importJSON(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.notes && Array.isArray(data.notes)) {
        notes = data.notes;
        store.set('notes', notes).then(() => render());
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

// 查找替换功能
function findInNote(): void {
  if (!findQuery || !selectedId) return;
  const sel = notes.find(n => n.id === selectedId);
  if (!sel) return;
  const idx = sel.content.indexOf(findQuery);
  if (idx >= 0) {
    const textarea = document.getElementById('note-content') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(idx, idx + findQuery.length);
  } else { alert('未找到匹配内容'); }
}

function replaceInNote(): void {
  if (!findQuery || !selectedId) return;
  const sel = notes.find(n => n.id === selectedId);
  if (!sel) return;
  sel.content = sel.content.split(findQuery).join(replaceQuery);
  sel.updated = Date.now();
  store.set('notes', notes).then(() => render());
}

async function load(): Promise<Note[]> {
  try {
    const raw = await store.get('notes');
    return raw ?? [];
  } catch (e) {
    console.error('Load failed', e);
    return [];
  }
}

async function save(n: Note[]): Promise<void> {
  await store.set('notes', n);
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function getFolders(): string[] { return [...new Set(notes.map(n => n.folder).filter(Boolean))]; }
function getTags(): string[] { return [...new Set(notes.flatMap(n => n.tags))]; }

function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n/g, '<br/>');
}

function render(): void {
  applyTheme();
  let filtered = notes;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q)));
  }
  if (activeFolder) filtered = filtered.filter(n => n.folder === activeFolder);
  filtered.sort((a, b) => b.updated - a.updated);

  const sel = notes.find(n => n.id === selectedId);
  const folders = getFolders();
  const app = document.getElementById('app')!;

  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📓</span><span class="title">Notepad</span>
      <button class="btn-sm" id="toggle-sidebar">${showSidebar ? '◀' : '▶'}</button>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="find-btn">🔍 查找</button>
        <button class="btn-sm" id="export-json-btn">📤 JSON</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-json-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
        <input type="text" id="search" class="search" placeholder="Search..." value="${searchQuery}" />
        <button class="btn-sm" id="export-btn">📥 Export</button>
      </div>
    </header>
    <main class="main">
      ${showSidebar ? `
      <div class="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-header"><span>Folders</span><button class="btn-xs" id="add-folder">+</button></div>
          <div class="folder-list">
            <div class="folder-item ${!activeFolder ? 'active' : ''}" data-folder="">All Notes (${notes.length})</div>
            ${folders.map(f => `<div class="folder-item ${f === activeFolder ? 'active' : ''}" data-folder="${f}">📁 ${f} (${notes.filter(n => n.folder === f).length})</div>`).join('')}
          </div>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-header"><span>Notes</span><button class="btn-xs" id="add-note">+</button></div>
          <div class="note-list">
            ${filtered.map(n => `
              <div class="note-item ${n.id === selectedId ? 'active' : ''}" data-id="${n.id}">
                <div class="note-title">${n.title || 'Untitled'}</div>
                <div class="note-meta">${new Date(n.updated).toLocaleDateString()} · ${n.content.slice(0, 40)}</div>
                <button class="del-note" data-del="${n.id}">×</button>
              </div>
            `).join('')}
            ${filtered.length === 0 ? '<p class="text-muted">No notes</p>' : ''}
          </div>
        </div>
      </div>` : ''}
      <div class="editor-area">
        ${sel ? `
          <input type="text" id="note-title" class="note-title-input" value="${sel.title}" placeholder="Title..." />
          <div class="tags-row">
            ${sel.tags.map((t, i) => `<span class="tag">${t} <span class="tag-del" data-tidx="${i}">×</span></span>`).join('')}
            <input type="text" id="add-tag" class="tag-input" placeholder="+ Tag" />
          </div>
          ${showFind ? `
            <div class="find-bar">
              <input type="text" id="find-input" class="find-input" placeholder="查找..." value="${findQuery}" />
              <input type="text" id="replace-input" class="find-input" placeholder="替换为..." value="${replaceQuery}" />
              <button class="btn-xs" id="find-btn-exec">查找</button>
              <button class="btn-xs" id="replace-btn-exec">替换全部</button>
              <button class="btn-xs" id="find-close">✕</button>
            </div>
          ` : ''}
          <div class="editor-tabs">
            <button class="tab-btn active" data-tab="edit">Edit</button>
            <button class="tab-btn" data-tab="preview">Preview</button>
          </div>
          <textarea id="note-content" class="note-editor" placeholder="Write in Markdown...">${sel.content}</textarea>
          <div id="note-preview" class="note-preview" style="display:none">${mdToHtml(sel.content)}</div>
        ` : '<div class="empty-state"><span>📝</span><p>Create a new note to get started</p></div>'}
      </div>
    </main>
  </div>`;
  bindEvents();
}

function bindEvents(): void {
  document.getElementById('toggle-sidebar')?.addEventListener('click', () => { showSidebar = !showSidebar; render(); });
  document.getElementById('search')?.addEventListener('input', (e) => { searchQuery = (e.target as HTMLInputElement).value; render(); });

  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-json-btn')?.addEventListener('click', () => { exportJSON(); });
  document.getElementById('import-json-input')?.addEventListener('change', (e) => { importJSON(e); });
  document.getElementById('find-btn')?.addEventListener('click', () => { showFind = !showFind; render(); });

  document.getElementById('find-btn-exec')?.addEventListener('click', () => {
    findQuery = (document.getElementById('find-input') as HTMLInputElement)?.value || '';
    findInNote();
  });
  document.getElementById('replace-btn-exec')?.addEventListener('click', () => {
    findQuery = (document.getElementById('find-input') as HTMLInputElement)?.value || '';
    replaceQuery = (document.getElementById('replace-input') as HTMLInputElement)?.value || '';
    replaceInNote();
  });
  document.getElementById('find-close')?.addEventListener('click', () => { showFind = false; render(); });

  document.getElementById('add-note')?.addEventListener('click', () => {
    const n: Note = { id: uid(), title: '', content: '', folder: activeFolder || '', tags: [], updated: Date.now() };
    notes.unshift(n); selectedId = n.id; save(notes).then(render);
  });

  document.querySelectorAll('.note-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('del-note')) return;
      selectedId = (item as HTMLElement).dataset.id!; render();
    });
  });

  document.querySelectorAll('.del-note').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.del;
      notes = notes.filter(n => n.id !== id);
      if (selectedId === id) selectedId = notes[0]?.id || null;
      save(notes).then(render);
    });
  });

  document.querySelectorAll('.folder-item').forEach(item => {
    item.addEventListener('click', () => { activeFolder = (item as HTMLElement).dataset.folder!; render(); });
  });

  document.getElementById('add-folder')?.addEventListener('click', () => {
    const name = prompt('Folder name:');
    if (name) { if (notes.length) notes[0].folder = name; save(notes).then(render); }
  });

  const sel = notes.find(n => n.id === selectedId);
  if (!sel) return;

  const updateAndSave = () => { sel.updated = Date.now(); save(notes); };
  document.getElementById('note-title')?.addEventListener('input', (e) => { sel.title = (e.target as HTMLInputElement).value; updateAndSave(); });
  document.getElementById('note-content')?.addEventListener('input', (e) => { sel.content = (e.target as HTMLTextAreaElement).value; updateAndSave(); });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = (btn as HTMLElement).dataset.tab;
      const editor = document.getElementById('note-content')!;
      const preview = document.getElementById('note-preview')!;
      if (tab === 'edit') { editor.style.display = ''; preview.style.display = 'none'; }
      else { editor.style.display = 'none'; preview.style.display = ''; preview.innerHTML = mdToHtml(sel.content); }
    });
  });

  document.querySelectorAll('.tag-del').forEach(btn => {
    btn.addEventListener('click', () => { sel.tags.splice(+(btn as HTMLElement).dataset.tidx!, 1); save(notes).then(render); });
  });

  document.getElementById('add-tag')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = (e.target as HTMLInputElement).value.trim();
      if (val && !sel.tags.includes(val)) { sel.tags.push(val); save(notes).then(render); }
    }
  });

  document.getElementById('export-btn')?.addEventListener('click', () => {
    if (!sel) return;
    const blob = new Blob([`# ${sel.title}\n\n${sel.content}`], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${sel.title || 'note'}.md`; a.click();
  });
}

// 初始化
(async () => {
  notes = await load();
  if (notes.length > 0 && !selectedId) selectedId = notes[0].id;
  render();
})();
