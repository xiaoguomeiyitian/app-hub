import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';

const APP_NAME = 'Kanban';
const APP_VERSION = '1.3.0';
const APP_DESC = '可视化任务管理看板，支持拖拽排序和标签管理';

interface Card { id: string; title: string; desc: string; tag: string; assignee?: string; }
interface Column { id: string; title: string; cards: Card[]; }

const STORAGE_DB = 'kanban-board-db';
const store = createIdbStore(STORAGE_DB, 'kv');

let theme: 'light' | 'dark' = (localStorage.getItem('kanban_theme') as 'light' | 'dark') || 'light';
let selectedTagFilter = '';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('kanban_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有看板数据吗？此操作不可撤销。')) return;
  columns = [
    { id: '1', title: '待办', cards: [] },
    { id: '2', title: '进行中', cards: [] },
    { id: '3', title: '已完成', cards: [] },
  ];
  localStorage.clear();
  save(columns).then(() => render());
}

// 导入/导出
function exportData(): void {
  const data = { columns, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kanban-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.columns && Array.isArray(data.columns)) {
        columns = data.columns;
        save(columns).then(() => render());
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

async function load(): Promise<Column[]> {
  try {
    const raw = await store.get('board');
    if (raw) return raw;
  } catch (e) { console.error('Load failed', e); }
  return [
    { id: '1', title: '待办', cards: [] },
    { id: '2', title: '进行中', cards: [] },
    { id: '3', title: '已完成', cards: [] },
  ];
}

async function save(c: Column[]): Promise<void> {
  await store.set('board', c);
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let columns: Column[] = [];
let dragCard: { colId: string; cardId: string } | null = null;

const TAG_COLORS: Record<string, string> = { 'feature': '#3fb950', 'bug': '#f85149', 'idea': '#d29922', 'urgent': '#f85149' };

function getAllTags(): string[] {
  const tags = new Set<string>();
  columns.forEach(col => col.cards.forEach(card => { if (card.tag) tags.add(card.tag); }));
  return Array.from(tags);
}

function render(): void {
  applyTheme();
  const tags = getAllTags();
  const filteredColumns = selectedTagFilter
    ? columns.map(col => ({
        ...col,
        cards: col.cards.filter(card => !selectedTagFilter || card.tag === selectedTagFilter)
      }))
    : columns;

  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📋</span><span class="title">Kanban</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <select id="tag-filter" class="select">
          <option value="">全部标签</option>
          ${tags.map(t => `<option value="${t}" ${selectedTagFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
        <button class="btn-sm" id="add-col">+ 列</button>
      </div>
    </header>
    <main class="main">
      <div class="board">
        ${filteredColumns.map(col => `
          <div class="column" data-col="${col.id}">
            <div class="col-header">
              <span class="col-title">${col.title} (${col.cards.length})</span>
              <button class="del-col" data-del="${col.id}">×</button>
            </div>
            <div class="card-list" data-col="${col.id}">
              ${col.cards.map(card => `
                <div class="card" draggable="true" data-card="${card.id}" data-col="${col.id}">
                  ${card.tag ? `<span class="card-tag" style="background:${TAG_COLORS[card.tag]||'var(--accent)'}">${card.tag}</span>` : ''}
                  <div class="card-title">${card.title}</div>
                  ${card.desc ? `<div class="card-desc">${card.desc}</div>` : ''}
                  ${card.assignee ? `<div class="card-assignee">👤 ${card.assignee}</div>` : ''}
                  <button class="del-card" data-card="${card.id}" data-col="${col.id}">×</button>
                </div>
              `).join('')}
            </div>
            <button class="add-card-btn" data-col="${col.id}">+ 添加卡片</button>
          </div>
        `).join('')}
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
  document.getElementById('tag-filter')?.addEventListener('change', (e) => {
    selectedTagFilter = (e.target as HTMLSelectElement).value;
    render();
  });

  document.getElementById('add-col')?.addEventListener('click', () => {
    const title = prompt('列标题：');
    if (title) { columns.push({ id: uid(), title, cards: [] }); save(columns).then(render); }
  });
  document.querySelectorAll('.del-col').forEach(btn => {
    btn.addEventListener('click', () => {
      columns = columns.filter(c => c.id !== (btn as HTMLElement).dataset.del);
      save(columns).then(render);
    });
  });
  document.querySelectorAll('.add-card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const colId = (btn as HTMLElement).dataset.col!;
      const title = prompt('卡片标题：');
      if (!title) return;
      const tag = prompt('标签 (feature/bug/idea/urgent)：', '') || '';
      const assignee = prompt('负责人：', '') || '';
      const col = columns.find(c => c.id === colId);
      if (col) { col.cards.push({ id: uid(), title, desc: '', tag, assignee }); save(columns).then(render); }
    });
  });
  document.querySelectorAll('.del-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const colId = (btn as HTMLElement).dataset.col!;
      const cardId = (btn as HTMLElement).dataset.card!;
      const col = columns.find(c => c.id === colId);
      if (col) { col.cards = col.cards.filter(c => c.id !== cardId); save(columns).then(render); }
    });
  });

  // Drag and drop
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      dragCard = { colId: (card as HTMLElement).dataset.col!, cardId: (card as HTMLElement).dataset.card! };
      (card as HTMLElement).style.opacity = '0.4';
    });
    card.addEventListener('dragend', () => { (card as HTMLElement).style.opacity = '1'; });
  });
  document.querySelectorAll('.card-list').forEach(list => {
    list.addEventListener('dragover', (e) => { e.preventDefault(); (list as HTMLElement).style.background = 'rgba(88,166,255,.05)'; });
    list.addEventListener('dragleave', () => { (list as HTMLElement).style.background = ''; });
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      (list as HTMLElement).style.background = '';
      const dc = dragCard; if (!dc) return;
      const newColId = (list as HTMLElement).dataset.col!;
      const fromCol = columns.find(c => c.id === dc.colId);
      const toCol = columns.find(c => c.id === newColId);
      const card = fromCol?.cards.find(c => c.id === dc.cardId);
      if (fromCol && toCol && card) {
        fromCol.cards = fromCol.cards.filter(c => c.id !== dc.cardId);
        toCol.cards.push(card);
        save(columns).then(render);
      }
      dragCard = null;
    });
  });
}

// 初始化
(async () => {
  columns = await load();
  render();
})();
