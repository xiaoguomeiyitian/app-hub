import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'Timestamp Tool';
const APP_VERSION = '1.3.0';
const APP_DESC = '时间戳转换工具';

let theme: 'light' | 'dark' = (localStorage.getItem('timestamp_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('timestamp_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('timestamp_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  history = [];
  localStorage.clear();
  localStorage.setItem('timestamp_theme', theme);
  render();
}

function exportData(): void {
  const ts = (document.getElementById('ts-input') as HTMLInputElement)?.value || '';
  const dateStr = (document.getElementById('date-input') as HTMLInputElement)?.value || '';
  const data = { ts, date: dateStr, history, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'timestamp-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.ts) (document.getElementById('ts-input') as HTMLInputElement).value = data.ts;
      if (data.date) (document.getElementById('date-input') as HTMLInputElement).value = data.date;
      if (data.history) { history = data.history; localStorage.setItem('timestamp_history', JSON.stringify(history)); }
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

type TsUnit = 's' | 'ms' | 'us';
type Zone =
  | 'UTC'
  | 'Etc/GMT+12'
  | 'Etc/GMT+11'
  | 'Pacific/Honolulu'
  | 'America/Anchorage'
  | 'Etc/GMT+9'
  | 'America/Los_Angeles'
  | 'America/Denver'
  | 'America/Chicago'
  | 'America/New_York'
  | 'America/Halifax'
  | 'America/Toronto'
  | 'America/Mexico_City'
  | 'America/Bogota'
  | 'America/Lima'
  | 'America/Sao_Paulo'
  | 'America/Buenos_Aires'
  | 'Atlantic/South_Georgia'
  | 'Europe/London'
  | 'Europe/Paris'
  | 'Europe/Berlin'
  | 'Europe/Rome'
  | 'Europe/Moscow'
  | 'Africa/Cairo'
  | 'Africa/Johannesburg'
  | 'Africa/Nairobi';

function render(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🕒</span><span class="title">Timestamp Tool</span>
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
        <input type="text" id="ts-input" class="f-input" placeholder="时间戳 (秒/毫秒)" />
        <select id="unit-select" class="select">
          <option value="s">秒</option>
          <option value="ms">毫秒</option>
          <option value="us">微秒</option>
        </select>
        <button class="btn-sm" id="to-date">→ 转日期</button>
      </div>
      <div class="controls">
        <input type="datetime-local" id="date-input" class="f-input" />
        <select id="zone-select" class="select">
          <option value="UTC">UTC</option>
          <option value="Asia/Shanghai">Asia/Shanghai</option>
          <option value="America/New_York">America/New_York</option>
        </select>
        <button class="btn-sm" id="to-ts">→ 转时间戳</button>
      </div>
      <div class="output" id="output"></div>
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

  document.getElementById('to-date')?.addEventListener('click', () => {
    const ts = +(document.getElementById('ts-input') as HTMLInputElement)?.value || 0;
    const unit = (document.getElementById('unit-select') as HTMLSelectElement)?.value as TsUnit;
    const ms = unit === 's' ? ts * 1000 : unit === 'ms' ? ts : ts / 1000;
    const date = new Date(ms);
    const output = document.getElementById('output')!;
    output.textContent = date.toISOString();
    // 保存历史
    history.unshift(`TS ${ts} (${unit}) → ${date.toISOString()}`);
    if (history.length > 20) history.pop();
    localStorage.setItem('timestamp_history', JSON.stringify(history));
  });

  document.getElementById('to-ts')?.addEventListener('click', () => {
    const dateStr = (document.getElementById('date-input') as HTMLInputElement)?.value;
    if (!dateStr) return;
    const date = new Date(dateStr);
    const ms = date.getTime();
    const output = document.getElementById('output')!;
    output.textContent = `秒: ${Math.floor(ms/1000)}\n毫秒: ${ms}\n微秒: ${ms * 1000}`;
    // 保存历史
    history.unshift(`${dateStr} → ${Math.floor(ms/1000)}`);
    if (history.length > 20) history.pop();
    localStorage.setItem('timestamp_history', JSON.stringify(history));
  });

  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('timestamp_history', JSON.stringify(history)); render();
  });
}

render();
