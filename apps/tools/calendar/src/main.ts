import '@app-hub/design-system/src/style.css';
import '@app-hub/utils/theme/variables.css';
import './style.css';

const APP_NAME = 'Calendar';
const APP_VERSION = '1.3.0';
const APP_DESC = '支持事件管理的日历应用，支持月/周/日视图';

interface CalEvent { id: string; title: string; date: string; color: string; reminder?: boolean; repeat?: 'none' | 'daily' | 'weekly' | 'monthly'; }

const STORAGE = 'calendar-events';
let theme: 'light' | 'dark' = (localStorage.getItem('calendar_theme') as 'light' | 'dark') || 'light';
let viewMode: 'month' | 'week' | 'day' = 'month';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('calendar_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有事件吗？此操作不可撤销。')) return;
  events = [];
  localStorage.clear();
  localStorage.setItem('calendar_theme', theme);
  render();
}

function load(): CalEvent[] { 
  try { 
    return JSON.parse(localStorage.getItem(STORAGE) || '[]'); 
  } catch { return []; } 
}

function save(e: CalEvent[]): void { 
  localStorage.setItem(STORAGE, JSON.stringify(e)); 
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// 导入/导出
function exportData(): void {
  const data = { events, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'calendar-data.json'; a.click();
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
        save(events); render();
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

let events = load();
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = new Date().toISOString().slice(0, 10);

function daysInMonth(y: number, m: number): number { return new Date(y, m +1, 0).getDate(); }
function firstDayOfMonth(y: number, m: number): number { return new Date(y, m, 1).getDay(); }

function render(): void {
  applyTheme();
  const today = new Date();
  const days = daysInMonth(currentYear, currentMonth);
  const startDay = firstDayOfMonth(currentYear, currentMonth);
  const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  const dayNames = ['日','一','二','三','四','五','六'];

  const cells: { day: number | null; date: string | null }[] = [];
  for (let i = 0; i < startDay; i++) cells.push({ day: null, date: null });
  for (let d = 1; d <= days; d++) {
    const date = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date });
  }

  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📅</span><span class="title">Calendar</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm ${viewMode === 'month' ? 'active' : ''}" id="view-month">月</button>
        <button class="btn-sm ${viewMode === 'week' ? 'active' : ''}" id="view-week">周</button>
        <button class="btn-sm ${viewMode === 'day' ? 'active' : ''}" id="view-day">日</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="cal-header">
        <button class="nav-btn" id="prev-month">◀</button>
        <span class="month-title">${currentYear}年 ${monthNames[currentMonth]}</span>
        <button class="nav-btn" id="next-month">▶</button>
        <button class="btn-sm today-btn" id="today-btn">今天</button>
      </div>
      <div class="calendar">
        <div class="day-header">${dayNames.map(d => `<div class="day-name">${d}</div>`).join('')}</div>
        <div class="day-grid">
          ${cells.map(cell => {
            const isToday = cell.date === today.toISOString().slice(0, 10);
            const isSelected = cell.date === selectedDate;
            const dayEvents = cell.date ? events.filter(e => e.date === cell.date) : [];
            return `<div class="day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${cell.day ? '' : 'empty'}" data-date="${cell.date || ''}">
              <span class="day-num">${cell.day || ''}</span>
              ${dayEvents.map(e => `<div class="event-dot" style="background:${e.color}" title="${e.title}">${e.title.slice(0, 6)}</div>`).join('')}
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="event-form">
        <input type="text" id="event-title" placeholder="事件标题" class="f-input" />
        <input type="date" id="event-date" class="f-input" value="${selectedDate}" />
        <input type="color" id="event-color" value="#58a6ff" class="f-color" />
        <label><input type="checkbox" id="event-reminder" /> 提醒</label>
        <select id="event-repeat" class="select">
          <option value="none">不重复</option>
          <option value="daily">每天</option>
          <option value="weekly">每周</option>
          <option value="monthly">每月</option>
        </select>
        <button class="btn-sm" id="add-event">+ 添加</button>
      </div>
      <div class="event-list">
        <h4>即将到来的事件</h4>
        ${events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10).map(e => `
          <div class="event-item">
            <span class="ev-dot" style="background:${e.color}"></span>
            <span>${e.date}</span>
            <span class="ev-title">${e.title}</span>
            ${e.reminder ? '<span class="ev-reminder">🔔</span>' : ''}
            ${e.repeat && e.repeat !== 'none' ? `<span class="ev-repeat">↻${e.repeat}</span>` : ''}
            <button class="del-ev" data-del="${e.id}">×</button>
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

  document.getElementById('view-month')?.addEventListener('click', () => { viewMode = 'month'; render(); });
  document.getElementById('view-week')?.addEventListener('click', () => { viewMode = 'week'; render(); });
  document.getElementById('view-day')?.addEventListener('click', () => { viewMode = 'day'; render(); });

  document.getElementById('prev-month')?.addEventListener('click', () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } render(); });
  document.getElementById('next-month')?.addEventListener('click', () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } render(); });
  document.getElementById('today-btn')?.addEventListener('click', () => { currentYear = new Date().getFullYear(); currentMonth = new Date().getMonth(); selectedDate = new Date().toISOString().slice(0, 10); render(); });

  document.querySelectorAll('.day-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const date = (cell as HTMLElement).dataset.date;
      if (date) { selectedDate = date; (document.getElementById('event-date') as HTMLInputElement).value = date; render(); }
    });
  });

  document.getElementById('add-event')?.addEventListener('click', () => {
    const title = (document.getElementById('event-title') as HTMLInputElement).value;
    const date = (document.getElementById('event-date') as HTMLInputElement).value;
    const color = (document.getElementById('event-color') as HTMLInputElement).value;
    const reminder = (document.getElementById('event-reminder') as HTMLInputElement).checked;
    const repeat = (document.getElementById('event-repeat') as HTMLSelectElement).value as 'none' | 'daily' | 'weekly' | 'monthly';
    if (!title || !date) return;
    events.push({ id: uid(), title, date, color, reminder: reminder || undefined, repeat: repeat === 'none' ? undefined : repeat });
    save(events); render();
  });

  document.querySelectorAll('.del-ev').forEach(btn => {
    btn.addEventListener('click', () => { events = events.filter(e => e.id !== (btn as HTMLElement).dataset.del); save(events); render(); });
  });

  // 简单提醒检查
  if (Notification.permission === 'default') {
    setTimeout(() => Notification.requestPermission(), 1000);
  }
  events.forEach(e => {
    if (e.reminder && e.date === new Date().toISOString().slice(0, 10)) {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('📅 事件提醒', { body: e.title });
        }
      }, 2000);
    }
  });
}

render();
