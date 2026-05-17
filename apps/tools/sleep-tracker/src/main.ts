import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';
import { createChart } from '@app-hub/utils/charts';

const APP_NAME = 'Sleep Tracker';
const APP_VERSION = '1.3.0';
const APP_DESC = '睡眠追踪器，支持统计图表';

let theme: 'light' | 'dark' = (localStorage.getItem('sleep_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('sleep_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('sleep_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有睡眠数据吗？此操作不可撤销。')) return;
  records = [];
  history = [];
  localStorage.clear();
  localStorage.setItem('sleep_theme', theme);
  save(records).then(() => render());
}

function exportData(): void {
  const data = { records, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sleep-data.json'; a.click();
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

interface SleepRecord { id: string; date: string; sleep: string; wake: string; hours: number; quality: number; created: number; }

const STORAGE_DB = 'sleep-tracker-db';
const store = createIdbStore(STORAGE_DB, 'kv');

async function load(): Promise<SleepRecord[]> { try { const raw = await store.get('records'); return raw ?? []; } catch { return []; } }
async function save(r: SleepRecord[]): Promise<void> { await store.set('records', r); }
function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let records: SleepRecord[] = [];
let sleepTime = '23:00', wakeTime = '07:00', quality = 4;

function calcHours(s: string, w: string): number {
  const [sh, sm] = s.split(':').map(Number);
  const [wh, wm] = w.split(':').map(Number);
  let mins = (wh * 60 + wm) - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  return Math.round(mins / 10) / 10;
}

async function render(): Promise<void> {
  applyTheme();
  const app = document.getElementById('app')!;
  const today = new Date().toISOString().slice(0, 10);
  const todayRecord = records.find(r => r.date === today);
  
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">😴</span><span class="title">Sleep Tracker</span>
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
        <input type="time" id="sleep-time" value="${sleepTime}" class="f-input" />
        <input type="time" id="wake-time" value="${wakeTime}" class="f-input" />
        <select id="quality-select" class="select">
          ${[1,2,3,4,5].map(q => `<option value="${q}" ${quality === q ? 'selected' : ''}>${q} 星</option>`).join('')}
        </select>
        <button class="btn-sm" id="add-record">💾 记录</button>
      </div>
      ${todayRecord ? `
        <div class="today-summary">
          <div>昨晚睡眠：${todayRecord.hours} 小时</div>
          <div>质量：${'⭐'.repeat(todayRecord.quality)}</div>
        </div>
      ` : ''}
      <div class="record-list">
        ${records.slice(0, 7).map(r => `
          <div class="record-item">
            <span class="record-date">${r.date}</span>
            <span class="record-hours">${r.hours}h</span>
            <span class="record-quality">${'⭐'.repeat(r.quality)}</span>
            <button class="del-record" data-id="${r.id}">×</button>
          </div>
        `).join('')}
        ${records.length === 0 ? '<p class="text-muted">暂无记录</p>' : ''}
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

  document.getElementById('add-record')?.addEventListener('click', () => {
    const date = new Date().toISOString().slice(0, 10);
    const hours = calcHours(sleepTime, wakeTime);
    records.unshift({ id: uid(), date, sleep: sleepTime, wake: wakeTime, hours, quality, created: Date.now() });
    save(records).then(() => render());
  });

  document.querySelectorAll('.del-record').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      records = records.filter(r => r.id !== id);
      save(records).then(() => render());
    });
  });

  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('sleep_history', JSON.stringify(history)); render();
  });
}

(async () => {
  records = await load();
  render();
})();
