import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'CSS Playground';
const APP_VERSION = '1.3.0';
const APP_DESC = 'CSS 代码在线试验场';

let theme: 'light' | 'dark' = (localStorage.getItem('css_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('css_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有代码吗？此操作不可撤销。')) return;
  html = defaultHTML; css = defaultCSS; layout = 'horizontal'; previewWidth = 50;
  localStorage.clear();
  localStorage.setItem('css_theme', theme);
  render();
}

function exportData(): void {
  const data = { html, css, layout, previewWidth, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'css-playground-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.html) html = data.html;
      if (data.css) css = data.css;
      if (data.layout) layout = data.layout;
      if (data.previewWidth) previewWidth = data.previewWidth;
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

// --- State ---
interface AppState {
  html: string;
  css: string;
  layout: 'horizontal' | 'vertical';
  previewWidth: number;
  fullscreen: boolean;
}

const STORAGE_KEY = 'css-playground-state';

const defaultHTML = `<div class="card">
  <h2>Hello CSS Playground!</h2>
  <p>Edit the HTML and CSS on the left to see changes here in real-time.</p>
  <button class="btn">Click Me</button>
</div>`;

const defaultCSS = `.card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
  max-width: 400px;
  margin: 2rem auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}`;

let html = localStorage.getItem('css-html') || defaultHTML;
let css = localStorage.getItem('css-css') || defaultCSS;
let layout: 'horizontal' | 'vertical' = (localStorage.getItem('css-layout') as 'horizontal' | 'vertical') || 'horizontal';
let previewWidth = parseInt(localStorage.getItem('css-preview-width') || '50');

function updatePreview(): void {
  const preview = document.getElementById('preview') as HTMLIFrameElement;
  const doc = preview.contentDocument || preview.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(`<style>${css}</style>${html}`);
  doc.close();
  // 保存状态
  localStorage.setItem('css-html', html);
  localStorage.setItem('css-css', css);
  localStorage.setItem('css-layout', layout);
  localStorage.setItem('css-preview-width', String(previewWidth));
}

function render(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🎨</span><span class="title">CSS Playground</span>
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
        <button class="btn-sm ${layout === 'horizontal' ? 'active' : ''}" id="layout-h">水平</button>
        <button class="btn-sm ${layout === 'vertical' ? 'active' : ''}" id="layout-v">垂直</button>
        <label>预览宽度: <input type="range" id="width-slider" min="20" max="80" value="${previewWidth}"/> ${previewWidth}%</label>
        <button class="btn-sm" id="copy-html">📋 HTML</button>
        <button class="btn-sm" id="copy-css">📋 CSS</button>
      </div>
      <div class="editor-container ${layout}">
        <div class="editor-box" style="width:${100 - previewWidth}%">
          <div class="editor-label">HTML</div>
          <textarea id="html-editor" class="code-editor">${html}</textarea>
        </div>
        <div class="editor-box" style="width:${previewWidth}%">
          <div class="editor-label">CSS</div>
          <textarea id="css-editor" class="code-editor">${css}</textarea>
        </div>
      </div>
      <iframe id="preview" class="preview-frame"></iframe>
    </main>
  </div>`;
  bindEvents();
  setTimeout(() => updatePreview(), 100);
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });

  document.getElementById('layout-h')?.addEventListener('click', () => { layout = 'horizontal'; render(); });
  document.getElementById('layout-v')?.addEventListener('click', () => { layout = 'vertical'; render(); });

  document.getElementById('width-slider')?.addEventListener('input', (e) => {
    previewWidth = +(e.target as HTMLInputElement).value;
    render();
  });

  document.getElementById('html-editor')?.addEventListener('input', (e) => {
    html = (e.target as HTMLTextAreaElement).value;
    updatePreview();
  });

  document.getElementById('css-editor')?.addEventListener('input', (e) => {
    css = (e.target as HTMLTextAreaElement).value;
    updatePreview();
  });

  document.getElementById('copy-html')?.addEventListener('click', () => {
    navigator.clipboard.writeText(html);
  });

  document.getElementById('copy-css')?.addEventListener('click', () => {
    navigator.clipboard.writeText(css);
  });
}

render();
