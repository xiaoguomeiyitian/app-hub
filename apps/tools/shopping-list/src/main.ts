import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';

const APP_NAME = 'Shopping List';
const APP_VERSION = '1.3.0';
const APP_DESC = '购物清单管理，支持分类和统计';

let theme: 'light' | 'dark' = (localStorage.getItem('shopping_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('shopping_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('shopping_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有购物清单吗？此操作不可撤销。')) return;
  items = [];
  history = [];
  localStorage.clear();
  localStorage.setItem('shopping_theme', theme);
  save(items).then(() => render());
}

function exportData(): void {
  const data = { items, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'shopping-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.items && Array.isArray(data.items)) {
        items = data.items;
        save(items).then(() => render());
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

interface Item { id: string; name: string; qty: number; category: string; checked: boolean; price: number; }
const CATEGORIES = ['蔬果','肉类','乳制品','零食','饮料','日用品','其他'];

const STORAGE_DB = 'shopping-list-db';
const store = createIdbStore(STORAGE_DB, 'kv');

async function load(): Promise<Item[]> {
  try {
    const raw = await store.get('items');
    return raw ?? [];
  } catch { return []; }
}

async function save(i: Item[]): Promise<void> {
  await store.set('items', i);
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let items: Item[] = [];

function render(): void {
  applyTheme();
  const grouped: Record<string, Item[]> = {};
  items.forEach(i => { (grouped[i.category] = grouped[i.category] || []).push(i); });
  
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🛒</span><span class="title">Shopping List</span>
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
        <input type="text" id="item-name" placeholder="商品名称" class="f-input" />
        <input type="number" id="item-qty" placeholder="数量" class="f-input" value="1" />
        <select id="item-category" class="select">
          ${CATEGORIES.map(c => `<option>${c}</option>`).join('')}
        </select>
        <input type="number" id="item-price" placeholder="单价" class="f-input" value="0" />
        <button class="btn-sm" id="add-item">+ 添加</button>
      </div>
      <div class="total-bar">总计：<strong>${items.reduce((s, i) => s + (i.checked ? 0 : i.price * i.qty), 0)}</strong> 元</div>
      ${Object.entries(grouped).map(([cat, items]) => `
        <div class="category-group">
          <div class="cat-header">${cat} (${items.length})</div>
          ${items.map(i => `
            <div class="item-row ${i.checked ? 'checked' : ''}">
              <input type="checkbox" class="item-check" data-id="${i.id}" ${i.checked ? 'checked' : ''}/>
              <span class="item-name">${i.name}</span>
              <span class="item-qty">×${i.qty}</span>
              <span class="item-price">${(i.price * i.qty).toFixed(2)}</span>
              <button class="del-item" data-id="${i.id}">×</button>
            </div>
          `).join('')}
        </div>
      `).join('')}
      ${items.length === 0 ? '<p class="text-muted">暂无商品，添加一个吧！</p>' : ''}
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

  document.getElementById('add-item')?.addEventListener('click', () => {
    const name = (document.getElementById('item-name') as HTMLInputElement)?.value;
    const qty = +(document.getElementById('item-qty') as HTMLInputElement)?.value || 1;
    const category = (document.getElementById('item-category') as HTMLSelectElement)?.value;
    const price = +(document.getElementById('item-price') as HTMLInputElement)?.value || 0;
    if (name) {
      items.push({ id: uid(), name, qty, category, checked: false, price });
      save(items).then(() => render());
    }
  });

  document.querySelectorAll('.item-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = (cb as HTMLElement).dataset.id!;
      const item = items.find(i => i.id === id);
      if (item) { item.checked = !item.checked; save(items).then(() => render()); }
    });
  });

  document.querySelectorAll('.del-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      items = items.filter(i => i.id !== id);
      save(items).then(() => render());
    });
  });

  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('shopping_history', JSON.stringify(history)); render();
  });

  // 保存到历史
  items.forEach(i => {
    if (!i.checked) {
      history.unshift(`${i.name} ×${i.qty}`);
      if (history.length > 20) history.pop();
    }
  });
  localStorage.setItem('shopping_history', JSON.stringify(history));
}

(async () => {
  items = await load();
  render();
})();
