import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'UUID Generator';
const APP_VERSION = '1.3.0';
const APP_DESC = 'UUID 生成器，支持多种格式';

let theme: 'light' | 'dark' = (localStorage.getItem('uuid_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('uuid_history') || '[]');

// UUID v4
function uuidv4(): string {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

// UUID v1 (simplified timestamp-based)
function uuidv1(): string {
  const now = Date.now();
  const t = now.toString(16).padStart(12, '0');
  const r = () => Math.floor(Math.random() * 16).toString(16);
  return `${t.slice(8, 12)}${t.slice(4, 8)}-1${t.slice(1, 4)}-${r()}${r()}${r()}-${r()}${r()}${r()}-${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}`;
}

// ULID
function ulid(): string {
  const CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const time = Date.now();
  let str = '';
  for (let i = 9; i >= 0; i--) {
    str += CHARS[Math.floor(time / Math.pow(32, i)) % 32];
  }
  for (let i = 0; i < 16; i++) {
    str += CHARS[crypto.getRandomValues(new Uint8Array(1))[0] % 32];
  }
  return str;
}

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('uuid_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  history = [];
  localStorage.clear();
  localStorage.setItem('uuid_theme', theme);
  render();
}

function exportData(): void {
  const data = { history, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'uuid-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.history) { history = data.history; localStorage.setItem('uuid_history', JSON.stringify(history)); }
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

function render(): void {
  applyTheme();
  const uuid4 = uuidv4();
  const uuid1 = uuidv1();
  const ulid = ulid();
  
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🆔</span><span class="title">UUID Generator</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="output-box">
        <div class="output-label">UUID v4</div>
        <div class="output" id="uuid4-output">${uuid4}</div>
        <button class="copy-btn" data-text="${uuid4}">📋 复制</button>
      </div>
      <div class="output-box">
        <div class="output-label">UUID v1 (简化)</div>
        <div class="output" id="uuid1-output">${uuid1}</div>
        <button class="copy-btn" data-text="${uuid1}">📋 复制</button>
      </div>
      <div class="output-box">
        <div class="output-label">ULID</div>
        <div class="output" id="ulid-output">${ulid}</div>
        <button class="copy-btn" data-text="${ulid}">📋 复制</button>
      </div>
      <button class="btn-sm" id="gen-btn">🔄 重新生成</button>
      ${history.length > 0 ? `
        <div class="history">
          <div class="history-header">历史记录 <button class="btn-xs" id="clear-history">清空</button></div>
          ${history.slice(0, 5).map(h => `<div class="hist-item">${h.slice(0, 50)}...</div>`).join('')}
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

  document.getElementById('gen-btn')?.addEventListener('click', () => { render(); });

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = (btn as HTMLElement).dataset.text || '';
      navigator.clipboard.writeText(text);
    });
  });

  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('uuid_history', JSON.stringify(history)); render();
  });

  // 保存到历史
  history.unshift(uuid4);
  if (history.length > 20) history.pop();
  localStorage.setItem('uuid_history', JSON.stringify(history));
}

render();
