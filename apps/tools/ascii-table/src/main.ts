import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'ASCII Table';
const APP_VERSION = '1.3.0';
const APP_DESC = 'ASCII 码表查询工具';

let theme: 'light' | 'dark' = (localStorage.getItem('ascii_table_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('ascii_table_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有设置吗？')) return;
  localStorage.clear();
  localStorage.setItem('ascii_table_theme', theme);
  render();
}

function exportData(): void {
  const data = { exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ascii-table-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      JSON.parse(e.target?.result as string);
      alert('导入成功');
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

function render(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  
  const rows = Array.from({length: 128}, (_, i) => {
    const ch = i >= 32 ? String.fromCharCode(i) : 'N/A';
    return `<tr><td>${i}</td><td>0x${i.toString(16).toUpperCase()}</td><td>${ch}</td></tr>`;
  }).join('');
  
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📊</span><span class="title">ASCII Table</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="table-container">
        <table class="ascii-table">
          <thead><tr><th>十进制</th><th>十六进制</th><th>字符</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
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
}

render();
