import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'World Clocks';
const APP_VERSION = '1.3.0';
const APP_DESC = '世界时钟，支持多时区显示';

let theme: 'light' | 'dark' = (localStorage.getItem('world_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('world_history') || '[]');

interface City { name: string; zone: string; label: string }
const cities: City[] = [
  { name: '北京', zone: 'Asia/Shanghai', label: 'Beijing' },
  { name: '东京', zone: 'Asia/Tokyo', label: 'Tokyo' },
  { name: '首尔', zone: 'Asia/Seoul', label: 'Seoul' },
  { name: '新加坡', zone: 'Asia/Singapore', label: 'Singapore' },
  { name: '曼谷', zone: 'Asia/Bangkok', label: 'Bangkok' },
  { name: '孟买', zone: 'Asia/Kolkata', label: 'Mumbai' },
  { name: '迪拜', zone: 'Asia/Dubai', label: 'Dubai' },
  { name: '莫斯科', zone: 'Europe/Moscow', label: 'Moscow' },
  { name: '柏林', zone: 'Europe/Berlin', label: 'Berlin' },
  { name: '巴黎', zone: 'Europe/Paris', label: 'Paris' },
  { name: '伦敦', zone: 'Europe/London', label: 'London' },
  { name: '开罗', zone: 'Africa/Cairo', label: 'Cairo' },
  { name: '纽约', zone: 'America/New_York', label: 'New York' },
  { name: '华盛顿', zone: 'America/New_York', label: 'Washington DC' },
  { name: '芝加哥', zone: 'America/Chicago', label: 'Chicago' },
  { name: '洛杉矶', zone: 'America/Los_Angeles', label: 'Los Angeles' },
  { name: '西雅图', zone: 'America/Los_Angeles', label: 'Seattle' },
  { name: '圣保罗', zone: 'America/Sao_Paulo', label: 'São Paulo' },
  { name: '悉尼', zone: 'Australia/Sydney', label: 'Sydney' },
  { name: '奥克兰', zone: 'Pacific/Auckland', label: 'Auckland' },
  { name: '夏威夷', zone: 'Pacific/Honolulu', label: 'Hawaii' },
  { name: '雅加达', zone: 'Asia/Jakarta', label: 'Jakarta' },
  { name: '开普敦', zone: 'Africa/Johannesburg', label: 'Cape Town' },
  { name: '伊斯坦布尔', zone: 'Europe/Istanbul', label: 'Istanbul' },
];

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('world_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有设置吗？此操作不可撤销。')) return;
  history = [];
  localStorage.clear();
  localStorage.setItem('world_theme', theme);
  render();
}

function exportData(): void {
  const data = { cities, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'world-clocks-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.cities) { /* 可以加载自定义城市列表 */ }
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

function getTime(zone: string): string {
  try {
    const now = new Date();
    return now.toLocaleString('zh-CN', { timeZone: zone, hour12: false });
  } catch {
    return new Date().toLocaleString();
  }
}

function render(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🌍</span><span class="title">World Clocks</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="clocks-grid">
        ${cities.map(c => `
          <div class="clock-card">
            <div class="city-name">${c.name}</div>
            <div class="city-label">${c.label}</div>
            <div class="clock-time" id="clock-${c.zone.replace(/\//g, '-')}">${getTime(c.zone)}</div>
          </div>
        `).join('')}
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
  
  // 更新时钟
  setInterval(() => {
    cities.forEach(c => {
      const el = document.getElementById(`clock-${c.zone.replace(/\//g, '-')}`);
      if (el) el.textContent = getTime(c.zone);
    });
  }, 1000);
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });
  
  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('world_history', JSON.stringify(history)); render();
  });
  
  // 保存到历史
  cities.forEach(c => {
    history.unshift(`${c.name}: ${getTime(c.zone)}`);
  });
  if (history.length > 20) history.pop();
  localStorage.setItem('world_history', JSON.stringify(history));
}

render();
