import '@app-hub/design-system/src/style.css';
/// <reference types="vite/client" />
import '@app-hub/utils/theme/variables.css';
import './style.css';

const APP_NAME = 'Regex Tester';
const APP_VERSION = '1.3.0';
const APP_DESC = '正则表达式测试工具';

let theme: 'light' | 'dark' = (localStorage.getItem('regex_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('regex_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('regex_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  pattern = '\\b(\\w+)\\b';
  flags = 'g';
  testText = 'Hello world! This is a regex tester. Test your patterns here.';
  replaceWith = '[$1]';
  history = [];
  localStorage.clear();
  localStorage.setItem('regex_theme', theme);
  render();
}

function exportData(): void {
  const data = { pattern, flags, testText, replaceWith, history, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'regex-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.pattern) pattern = data.pattern;
      if (data.flags) flags = data.flags;
      if (data.testText) testText = data.testText;
      if (data.replaceWith) replaceWith = data.replaceWith;
      if (data.history) { history = data.history; localStorage.setItem('regex_history', JSON.stringify(history)); }
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

const TEMPLATES: Record<string, { pattern: string; flags: string; desc: string }> = {
  email: { pattern: '[\\w.-]+@[\\w.-]+\\.\\w{2,}', flags: 'g', desc: '邮箱' },
  url: { pattern: 'https?://[\\w.-]+(?:/[\\w./?%&=-]*)?', flags: 'g', desc: 'URL' },
  phone: { pattern: '1[3-9]\\d{9}', flags: 'g', desc: '手机号' },
  date: { pattern: '\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}', flags: 'g', desc: '日期' },
  ip: { pattern: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}', flags: 'g', desc: 'IPv4' },
};

let pattern = '\\b(\\w+)\\b';
let flags = 'g';
let testText = 'Hello world! This is a regex tester. Test your patterns here. 你好世界！';
let replaceWith = '[$1]';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function render(): void {
  applyTheme();
  let regex: RegExp | null = null;
  let error = '';
  let matches: string[] = [];

  try {
    regex = new RegExp(pattern, flags);
    matches = testText.match(regex) || [];
  } catch (e) {
    error = (e as Error).message;
  }

  const highlighted = error ? escapeHtml(testText) : testText.replace(regex!, (match) => `<mark>${escapeHtml(match)}</mark>`);
  const replaced = error ? '' : testText.replace(regex!, replaceWith);

  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🎲</span><span class="title">Regex Tester</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="templates">
        ${Object.entries(TEMPLATES).map(([name, t]) => `
          <button class="template-btn" data-pattern="${t.pattern}" data-flags="${t.flags}">${t.desc}</button>
        `).join('')}
      </div>
      <div class="controls">
        <input type="text" id="pattern-input" class="f-input" placeholder="正则表达式" value="${pattern}"/>
        <input type="text" id="flags-input" class="f-input" placeholder="g" value="${flags}"/>
        <button class="btn-sm" id="test-btn">测试</button>
      </div>
      ${error ? `<div class="error">错误：${error}</div>` : ''}
      <div class="editor-box">
        <div class="editor-label">测试文本</div>
        <textarea id="test-text" class="code-editor">${testText}</textarea>
      </div>
      <div class="result-box">
        <div class="result-label">匹配结果 (${matches.length})</div>
        <div class="highlighted-text">${highlighted}</div>
      </div>
      <div class="controls">
        <input type="text" id="replace-input" class="f-input" placeholder="替换为" value="${replaceWith}"/>
        <button class="btn-sm" id="replace-btn">替换</button>
      </div>
      <div class="result-box">
        <div class="result-label">替换结果</div>
        <div class="replaced-text">${replaced}</div>
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

  document.querySelectorAll('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      (document.getElementById('pattern-input') as HTMLInputElement).value = (btn as HTMLElement).dataset.pattern!;
      (document.getElementById('flags-input') as HTMLInputElement).value = (btn as HTMLElement).dataset.flags!;
      render();
    });
  });

  document.getElementById('test-btn')?.addEventListener('click', () => {
    pattern = (document.getElementById('pattern-input') as HTMLInputElement)?.value || '';
    flags = (document.getElementById('flags-input') as HTMLInputElement)?.value || '';
    render();
  });

  document.getElementById('test-text')?.addEventListener('input', (e) => {
    testText = (e.target as HTMLTextAreaElement).value;
    // 保存到历史
    history.unshift(pattern);
    if (history.length > 20) history.pop();
    localStorage.setItem('regex_history', JSON.stringify(history));
    render();
  });

  document.getElementById('replace-btn')?.addEventListener('click', () => {
    replaceWith = (document.getElementById('replace-input') as HTMLInputElement)?.value || '';
    render();
  });

  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = [];
    localStorage.setItem('regex_history', JSON.stringify(history));
    render();
  });
}

render();
