import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';
import { createChart } from '@app-hub/utils/charts';

const APP_NAME = 'Habit Tracker';
const APP_VERSION = '1.3.0';
const APP_DESC = '习惯追踪器，支持打卡和统计';

let theme: 'light' | 'dark' = (localStorage.getItem('habit_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('habit_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有习惯数据吗？此操作不可撤销。')) return;
  habits = [];
  localStorage.clear();
  localStorage.setItem('habit_theme', theme);
  save(habits).then(() => render());
}

function exportData(): void {
  const data = { habits, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'habit-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.habits && Array.isArray(data.habits)) {
        habits = data.habits;
        save(habits).then(() => render());
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

interface Habit { id: string; name: string; emoji: string; checks: Record<string, boolean>; }
const STORAGE_DB = 'habit-tracker-db';
const store = createIdbStore(STORAGE_DB, 'kv');

async function load(): Promise<Habit[]> {
  try {
    const raw = await store.get('habits');
    return raw ?? [];
  } catch { return []; }
}

async function save(h: Habit[]): Promise<void> {
  await store.set('habits', h);
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function dateKey(d: Date): string { return d.toISOString().slice(0, 10); }

let habits: Habit[] = [];
let viewDays = 14;

function render(): void {
  applyTheme();
  const today = dateKey(new Date());
  const app = document.getElementById('app')!;
  
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">✅</span><span class="title">Habit Tracker</span>
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
        <input type="text" id="habit-name" placeholder="习惯名称" class="f-input" />
        <input type="text" id="habit-emoji" placeholder="emoji" class="f-input" style="width:80px" />
        <button class="btn-sm" id="add-habit">+ 添加习惯</button>
      </div>
      <div class="habit-list">
        ${habits.map(h => `
          <div class="habit-item">
            <div class="habit-header">
              <span class="habit-emoji">${h.emoji || '📝'}</span>
              <span class="habit-name">${h.name}</span>
              <button class="del-habit" data-id="${h.id}">×</button>
            </div>
            <div class="habit-checks">
              ${Array.from({length: viewDays}, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - i);
                const key = dateKey(d);
                const checked = h.checks[key];
                return `<button class="check-btn ${checked ? 'checked' : ''}" data-habit="${h.id}" data-date="${key}">${d.getDate()}</button>`;
              }).join('')}
            </div>
          </div>
        `).join('')}
        ${habits.length === 0 ? '<p class="text-muted">暂无习惯，添加一个吧！</p>' : ''}
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

  document.getElementById('add-habit')?.addEventListener('click', () => {
    const name = (document.getElementById('habit-name') as HTMLInputElement)?.value;
    const emoji = (document.getElementById('habit-emoji') as HTMLInputElement)?.value || '📝';
    if (name) {
      habits.push({ id: uid(), name, emoji, checks: {} });
      save(habits).then(() => render());
    }
  });

  document.querySelectorAll('.check-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const habitId = (btn as HTMLElement).dataset.habit!;
      const date = (btn as HTMLElement).dataset.date!;
      const habit = habits.find(h => h.id === habitId);
      if (habit) {
        habit.checks[date] = !habit.checks[date];
        save(habits).then(() => render());
      }
    });
  });

  document.querySelectorAll('.del-habit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      habits = habits.filter(h => h.id !== id);
      save(habits).then(() => render());
    });
  });
}

(async () => {
  habits = await load();
  render();
})();
