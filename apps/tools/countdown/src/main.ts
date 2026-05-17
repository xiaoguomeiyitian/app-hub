import '@app-hub/design-system/src/style.css';
import '@app-hub/utils/theme/variables.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';

const APP_NAME = 'Countdown';
const APP_VERSION = '1.3.0';
const APP_DESC = '重要日倒计时工具';

let theme: 'light' | 'dark' = (localStorage.getItem('countdown_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('countdown_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有倒计时吗？此操作不可撤销。')) return;
  events = [];
  localStorage.clear();
  localStorage.setItem('countdown_theme', theme);
  save(events).then(() => render());
}

function exportData(): void {
  const data = { events, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'countdown-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.events && Array.isArray(data.events)) {
        events = data.events;
        save(events).then(() => render());
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

interface Event { id: string; name: string; date: string; emoji: string; }
const STORAGE_DB = 'countdown-db';
const store = createIdbStore(STORAGE_DB, 'kv');

async function load(): Promise<Event[]> {
  try {
    const raw = await store.get('events');
    return raw ?? [];
  } catch { return []; }
}

async function save(e: Event[]): Promise<void> {
  await store.set('events', e);
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let events: Event[] = [];

function diffString(target: Date): { text: string; past: boolean } {
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  const past = diff < 0;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  return { text: `${days}天 ${hours}小时`, past };
}

function render(): void {
  applyTheme();
  const now = new Date();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">⏳</span><span class="title">Countdown</span>
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
        <input type="text" id="event-name" placeholder="事件名称" class="f-input" />
        <input type="date" id="event-date" class="f-input" />
        <input type="text" id="event-emoji" placeholder="emoji" class="f-input" style="width:80px" />
        <button class="btn-sm" id="add-event">+ 添加</button>
      </div>
      <div class="event-list">
        ${events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(e => {
          const target = new Date(e.date);
          const diff = diffString(target);
          return `
            <div class="event-item ${diff.past ? 'past' : ''}">
              <span class="event-emoji">${e.emoji || '📅'}</span>
              <div class="event-info">
                <div class="event-name">${e.name}</div>
                <div class="event-date">${e.date}</div>
              </div>
              <div class="event-countdown">
                ${diff.past ? '已过去' : '还剩'} <strong>${diff.text}</strong>
              </div>
              <button class="del-event" data-id="${e.id}">×</button>
            </div>
          `;
        }).join('')}
        ${events.length === 0 ? '<p class="text-muted">暂无倒计时事件</p>' : ''}
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

  document.getElementById('add-event')?.addEventListener('click', () => {
    const name = (document.getElementById('event-name') as HTMLInputElement)?.value;
    const date = (document.getElementById('event-date') as HTMLInputElement)?.value;
    const emoji = (document.getElementById('event-emoji') as HTMLInputElement)?.value || '📅';
    if (name && date) {
      events.push({ id: uid(), name, date, emoji });
      save(events).then(() => render());
    }
  });

  document.querySelectorAll('.del-event').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      events = events.filter(e => e.id !== id);
      save(events).then(() => render());
    });
  });
}

(async () => {
  events = await load();
  render();
})();
