import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';
import { createChart } from '@app-hub/utils/charts';

const APP_NAME = 'Expense Tracker';
const APP_VERSION = '1.3.0';
const APP_DESC = '收支记录与统计工具';

let theme: 'light' | 'dark' = (localStorage.getItem('expense_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('expense_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  records = [];
  localStorage.clear();
  localStorage.setItem('expense_theme', theme);
  save(records).then(() => render());
}

function exportData(): void {
  const data = { records, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'expense-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.records && Array.isArray(data.records)) {
        records = data.records;
        save(records).then(() => render());
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

interface ExpenseRecord { id: string; type: 'income' | 'expense'; amount: number; category: string; note: string; date: string; }
const CATEGORIES = { expense: ['餐饮','交通','购物','娱乐','居住','医疗','教育','其他'], income: ['工资','兼职','投资','礼金','其他'] };

const STORAGE_DB = 'expense-tracker-db';
const store = createIdbStore(STORAGE_DB, 'kv');

async function load(): Promise<ExpenseRecord[]> {
  try {
    const raw = await store.get('records');
    return raw ?? [];
  } catch { return []; }
}

async function save(r: ExpenseRecord[]): Promise<void> {
  await store.set('records', r);
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let records: ExpenseRecord[] = [];
let tab: 'list' | 'stats' = 'list';

function render(): void {
  applyTheme();
  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = records.filter(r => r.date === today);
  const totalIncome = todayRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = todayRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">💰</span><span class="title">Expense Tracker</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="summary">
        <div class="summary-item">今日收入: <strong>${totalIncome}</strong> 元</div>
        <div class="summary-item">今日支出: <strong>${totalExpense}</strong> 元</div>
      </div>
      <div class="controls">
        <button class="btn-sm ${tab === 'list' ? 'active' : ''}" id="tab-list">列表</button>
        <button class="btn-sm ${tab === 'stats' ? 'active' : ''}" id="tab-stats">统计</button>
        <select id="type-select" class="select">
          <option value="expense">支出</option>
          <option value="income">收入</option>
        </select>
        <select id="category-select" class="select"></select>
        <input type="number" id="amount-input" placeholder="金额" class="f-input" />
        <input type="text" id="note-input" placeholder="备注" class="f-input" />
        <input type="date" id="date-input" value="${today}" class="f-input" />
        <button class="btn-sm" id="add-record">+ 添加</button>
      </div>
      ${tab === 'list' ? `
        <div class="record-list">
          ${records.slice(0, 10).map(r => `
            <div class="record-item ${r.type}">
              <span class="record-type">${r.type === 'income' ? '↑' : '↓'}</span>
              <span class="record-category">${r.category}</span>
              <span class="record-amount">${r.amount} 元</span>
              <span class="record-note">${r.note}</span>
              <button class="del-record" data-id="${r.id}">×</button>
            </div>
          `).join('')}
          ${records.length === 0 ? '<p class="text-muted">暂无记录</p>' : ''}
        </div>
      ` : '<div id="chart-container"></div>'}
    </main>
  </div>`;
  bindEvents();
  if (tab === 'stats') drawChart();
}

function drawChart(): void {
  const canvas = document.getElementById('chart-container') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  canvas.width = canvas.offsetWidth;
  canvas.height = 200;
  // 简易图表
  const monthRecords = records.filter(r => r.date.startsWith(new Date().toISOString().slice(0, 7)));
  const income = monthRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expense = monthRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  
  ctx.fillStyle = '#3fb950';
  ctx.fillRect(50, 150 - income, 50, income);
  ctx.fillStyle = '#f85149';
  ctx.fillRect(150, 150 - expense, 50, expense);
  ctx.fillStyle = '#000';
  ctx.fillText('收入', 50, 170);
  ctx.fillText('支出', 150, 170);
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });

  document.getElementById('tab-list')?.addEventListener('click', () => { tab = 'list'; render(); });
  document.getElementById('tab-stats')?.addEventListener('click', () => { tab = 'stats'; render(); });

  document.getElementById('type-select')?.addEventListener('change', () => {
    updateCategoryOptions();
  });

  function updateCategoryOptions(): void {
    const type = (document.getElementById('type-select') as HTMLSelectElement)?.value as 'income' | 'expense';
    const select = document.getElementById('category-select') as HTMLSelectElement;
    if (select) {
      select.innerHTML = CATEGORIES[type].map(c => `<option>${c}</option>`).join('');
    }
  }
  updateCategoryOptions();

  document.getElementById('add-record')?.addEventListener('click', () => {
    const type = (document.getElementById('type-select') as HTMLSelectElement)?.value as 'income' | 'expense';
    const category = (document.getElementById('category-select') as HTMLSelectElement)?.value;
    const amount = +(document.getElementById('amount-input') as HTMLInputElement)?.value;
    const note = (document.getElementById('note-input') as HTMLInputElement)?.value;
    const date = (document.getElementById('date-input') as HTMLInputElement)?.value;
    if (amount && date) {
      records.push({ id: uid(), type, amount, category, note, date });
      save(records).then(() => render());
    }
  });

  document.querySelectorAll('.del-record').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      records = records.filter(r => r.id !== id);
      save(records).then(() => render());
    });
  });
}

(async () => {
  records = await load();
  render();
})();
