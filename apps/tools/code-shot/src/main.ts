import '@app-hub/design-system/src/style.css';
/// <reference types="vite/client" />
import './style.css';

const APP_NAME = 'Code Shot';
const APP_VERSION = '1.3.0';
const APP_DESC = '代码截图生成器，支持多种主题和语言';

declare const hljs: { highlight(code: string, options: { language: string }): { value: string } };
declare const html2canvas: (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>;

let theme: 'light' | 'dark' = (localStorage.getItem('code_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('code_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有设置吗？')) return;
  localStorage.clear();
  localStorage.setItem('code_theme', theme);
  render();
}

function exportData(): void {
  const code = (document.getElementById('code-input') as HTMLTextAreaElement)?.value || '';
  const lang = (document.getElementById('lang-select') as HTMLSelectElement)?.value || 'javascript';
  const themeName = (document.getElementById('theme-select') as HTMLSelectElement)?.value || 'dracula';
  const data = { code, lang, theme: themeName, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'code-shot-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.code) {
        (document.getElementById('code-input') as HTMLTextAreaElement).value = data.code;
        if (data.lang) (document.getElementById('lang-select') as HTMLSelectElement).value = data.lang;
        if (data.theme) (document.getElementById('theme-select') as HTMLSelectElement).value = data.theme;
        updatePreview();
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

// ===== 配置 =====
const LANGUAGES = ['javascript', 'typescript', 'python', 'html', 'css', 'json', 'go', 'rust', 'java', 'cpp'];
const LANG_LABELS: Record<string, string> = {
  javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
  html: 'HTML', css: 'CSS', json: 'JSON', go: 'Go', rust: 'Rust',
  java: 'Java', cpp: 'C++',
};

const THEMES: Record<string, Record<string, string>> = {
  dracula: { bg: '#282a36', fg: '#f8f8f2', keyword: '#ff79c6', string: '#f1fa8c', comment: '#6272a4', number: '#bd93f9', function: '#50fa7b', title: '#f8f8f2' },
  monokai: { bg: '#272822', fg: '#f8f8f2', keyword: '#f92672', string: '#e6db74', comment: '#75715e', number: '#ae81ff', function: '#a6e22e', title: '#f8f8f2' },
  nord: { bg: '#2e3440', fg: '#d8dee9', keyword: '#81a1c1', string: '#a3be8c', comment: '#616e88', number: '#b48ead', function: '#88c0d0', title: '#eceff4' },
  gruvbox: { bg: '#282828', fg: '#ebdbb2', keyword: '#fb4934', string: '#b8bb26', comment: '#928374', number: '#d3869b', function: '#fabd2f', title: '#fbf1c7' },
  github: { bg: '#0d1117', fg: '#c9d1d9', keyword: '#ff7b72', string: '#a5d6ff', comment: '#8b949e', number: '#79c0ff', function: '#d2a8ff', title: '#c9d1d9' },
};
const THEME_KEYS = Object.keys(THEMES);
const FONTS = ['JetBrains Mono', 'Fira Code', 'Consolas', 'Source Code Pro', 'Menlo'];

// ===== 状态 =====
let currentLang = 'javascript';
let currentTheme = 'dracula';
let showWindow = true;
let showLineNumbers = true;
let fontSize = 14;

function updatePreview(): void {
  const code = (document.getElementById('code-input') as HTMLTextAreaElement)?.value || '// Write some code...';
  const t = THEMES[currentTheme];
  const highlighted = hljs.highlight(code, { language: currentLang });
  
  const preview = document.getElementById('preview')!;
  preview.style.background = t.bg;
  preview.style.color = t.fg;
  preview.style.fontFamily = `'${FONTS[0]}', monospace`;
  preview.style.fontSize = fontSize + 'px';
  
  const lines = code.split('\n');
  const lineNums = showLineNumbers ? lines.map((_, i) => `<span class="line-num">${i + 1}</span>`).join('') : '';
  const codeHtml = lines.map((_, i) => `<div class="code-line">${lineNums}<span>${highlighted.value}</span></div>`).join('');
  
  preview.innerHTML = codeHtml;
}

function takeScreenshot(): void {
  const preview = document.getElementById('preview')!;
  html2canvas(preview, { backgroundColor: THEMES[currentTheme].bg }).then(canvas => {
    const a = document.createElement('a');
    a.download = 'code-shot.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });
}

function render(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📸</span><span class="title">Code Shot</span>
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
        <select id="lang-select" class="select">
          ${LANGUAGES.map(l => `<option value="${l}" ${l === currentLang ? 'selected' : ''}>${LANG_LABELS[l]}</option>`).join('')}
        </select>
        <select id="theme-select" class="select">
          ${THEME_KEYS.map(t => `<option value="${t}" ${t === currentTheme ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <label><input type="checkbox" id="window-toggle" ${showWindow ? 'checked' : ''}/> 窗口</label>
        <label><input type="checkbox" id="line-num-toggle" ${showLineNumbers ? 'checked' : ''}/> 行号</label>
        <label>字体<input type="range" id="font-slider" min="10" max="24" value="${fontSize}"/></label>
        <button class="btn-sm" id="screenshot-btn">📸 截图</button>
      </div>
      <textarea id="code-input" class="code-input" placeholder="输入代码...">${'// Write some code...'}</textarea>
      <div id="preview" class="preview"></div>
    </main>
  </div>`;
  bindEvents();
  updatePreview();
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });

  document.getElementById('lang-select')?.addEventListener('change', (e) => {
    currentLang = (e.target as HTMLSelectElement).value;
    updatePreview();
  });
  document.getElementById('theme-select')?.addEventListener('change', (e) => {
    currentTheme = (e.target as HTMLSelectElement).value;
    updatePreview();
  });
  document.getElementById('window-toggle')?.addEventListener('change', (e) => {
    showWindow = (e.target as HTMLInputElement).checked;
    updatePreview();
  });
  document.getElementById('line-num-toggle')?.addEventListener('change', (e) => {
    showLineNumbers = (e.target as HTMLInputElement).checked;
    updatePreview();
  });
  document.getElementById('font-slider')?.addEventListener('input', (e) => {
    fontSize = +(e.target as HTMLInputElement).value;
    updatePreview();
  });
  document.getElementById('code-input')?.addEventListener('input', () => { updatePreview(); });
  document.getElementById('screenshot-btn')?.addEventListener('click', () => { takeScreenshot(); });
}

render();
