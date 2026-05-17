import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';

const APP_NAME = 'Expense Split';
const APP_VERSION = '1.3.0';
const APP_DESC = '费用分摊计算工具';

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
  activities = [];
  localStorage.clear();
  localStorage.setItem('expense_theme', theme);
  save(activities).then(() => render());
}

function exportData(): void {
  const data = { activities, exportDate: new Date().toISOString(), version: APP_VERSION };
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
      if (data.activities && Array.isArray(data.activities)) {
        activities = data.activities;
        save(activities).then(() => render());
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

interface Expense { id: string; player: string; amount: number; desc: string; splits: string[]; }
interface Activity { id: string; name: string; members: string[]; expenses: Expense[]; }

const STORAGE_DB = 'expense-split-db';
const store = createIdbStore(STORAGE_DB, 'kv');

async function load(): Promise<Activity[]> {
  try {
    const raw = await store.get('activities');
    return raw ?? [];
  } catch { return []; }
}

async function save(a: Activity[]): Promise<void> {
  await store.set('activities', a);
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let activities: Activity[] = [];
let selectedId: string | null = null;

function calcBalances(act: Activity): Record<string, number> {
  const bal: Record<string, number> = {};
  act.members.forEach(m => bal[m] = 0);
  act.expenses.forEach(exp => {
    const share = exp.amount / exp.splits.length;
    bal[exp.player] += exp.amount;
    exp.splits.forEach(m => { bal[m] -= share; });
  });
  return bal;
}

function render(): void {
  applyTheme();
  const sel = activities.find(a => a.id === selectedId);
  const app = document.getElementById('app')!;
  
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">💰</span><span class="title">Expense Split</span>
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
        <button class="btn-sm" id="add-activity">+ 活动</button>
      </div>
      <div class="activity-list">
        ${activities.map(a => `
          <div class="activity-item ${a.id === selectedId ? 'active' : ''}" data-id="${a.id}">
            <div class="act-name">${a.name}</div>
            <div class="act-members">${a.members.join(', ')}</div>
            <div class="act-total">${a.expenses.reduce((s, e) => s + e.amount, 0)} 元</div>
          </div>
        `).join('')}
        ${activities.length === 0 ? '<p class="text-muted">暂无活动</p>' : ''}
      </div>
      ${sel ? `
        <div class="expense-form">
          <input type="text" id="expense-player" placeholder="付款人" class="f-input" />
          <input type="number" id="expense-amount" placeholder="金额" class="f-input" />
          <input type="text" id="expense-desc" placeholder="说明" class="f-input" />
          <button class="btn-sm" id="add-expense">+ 添加费用</button>
        </div>
        <div class="expense-list">
          ${sel.expenses.map(e => `
            <div class="expense-item">
              <span>${e.player}</span>
              <span>${e.amount} 元</span>
              <span>${e.desc}</span>
            </div>
          `).join('')}
        </div>
        <div class="balance-result">
          <div class="balance-header">结算结果</div>
          ${Object.entries(calcBalances(sel)).map(([m, b]) => `
            <div class="balance-item ${b > 0 ? 'positive' : b < 0 ? 'negative' : ''}">
              ${m}: ${b > 0 ? '应收' : '应付'} ${Math.abs(b).toFixed(2)} 元
            </div>
          `).join('')}
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

  document.getElementById('add-activity')?.addEventListener('click', () => {
    const name = prompt('活动名称：');
    const membersStr = prompt('成员（逗号分隔）：');
    if (name && membersStr) {
      const members = membersStr.split(',').map(m => m.trim()).filter(Boolean);
      activities.push({ id: uid(), name, members, expenses: [] });
      save(activities).then(() => render());
    }
  });

  document.querySelectorAll('.activity-item').forEach(item => {
    item.addEventListener('click', () => {
      if ((item as HTMLElement).classList.contains('active')) return;
      document.querySelectorAll('.activity-item').forEach(i => i.classList.remove('active'));
      (item as HTMLElement).classList.add('active');
      selectedId = (item as HTMLElement).dataset.id!;
      render();
    });
  });

  document.getElementById('add-expense')?.addEventListener('click', () => {
    const player = (document.getElementById('expense-player') as HTMLInputElement)?.value;
    const amount = +(document.getElementById('expense-amount') as HTMLInputElement)?.value;
    const desc = (document.getElementById('expense-desc') as HTMLInputElement)?.value;
    if (player && amount && selectedId) {
      const sel = activities.find(a => a.id === selectedId);
      if (sel) {
        sel.expenses.push({ id: uid(), player, amount, desc, splits: sel.members });
        save(activities).then(() => render());
      }
    }
  });
}

(async () => {
  activities = await load();
  render();
})();
