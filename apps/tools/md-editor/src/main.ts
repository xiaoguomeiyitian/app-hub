import '@app-hub/design-system/src/style.css';
/// <reference types="vite/client" />
import '@app-hub/utils/theme/variables.css';
import './style.css';

const APP_NAME = 'MD Editor';
const APP_VERSION = '1.3.0';
const APP_DESC = 'Markdown 编辑器，支持实时预览';

let theme: 'light' | 'dark' = (localStorage.getItem('md_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('md_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('md_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有内容吗？此操作不可撤销。')) return;
  (document.getElementById('md-input') as HTMLTextAreaElement).value = SAMPLE;
  localStorage.clear();
  localStorage.setItem('md_theme', theme);
  render();
}

function exportData(): void {
  const mdText = (document.getElementById('md-input') as HTMLTextAreaElement)?.value || '';
  const data = { markdown: mdText, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'md-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.markdown) {
        (document.getElementById('md-input') as HTMLTextAreaElement).value = data.markdown;
        updatePreview();
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

const STORAGE_KEY = 'md_editor_content';
const SAMPLE = `# 欢迎使用 Markdown 编辑器

这是一个**轻量级**的 Markdown 编辑器，支持实时预览。

## 功能特性

- **粗体** 和 *斜体* 文本
- \`行内代码\` 和代码块
- [链接](https://example.com)
- 引用块
- 表格支持

### 代码块示例

\`\`\`javascript
function greet(name) {
  return \`Hello, ${name}!\`;
}
\`\`\`

### 表格示例

| 功能 | 状态 |
|------|------|
| 标题 | ✅ |
`;

function parseMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n/g, '<br/>');
}

function updatePreview(): void {
  const mdText = (document.getElementById('md-input') as HTMLTextAreaElement)?.value || '';
  const preview = document.getElementById('md-preview');
  if (preview) preview.innerHTML = parseMarkdown(mdText);
  localStorage.setItem(STORAGE_KEY, mdText);
  
  // 保存到历史
  history.unshift(mdText.slice(0, 100));
  if (history.length > 10) history.pop();
  localStorage.setItem('md_history', JSON.stringify(history));
}

function render(): void {
  applyTheme();
  const saved = localStorage.getItem(STORAGE_KEY) || SAMPLE;
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📝</span><span class="title">MD Editor</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="editor-container">
        <div class="editor-box">
          <div class="editor-label">Markdown</div>
          <textarea id="md-input" class="md-editor">${saved}</textarea>
        </div>
        <div class="preview-box">
          <div class="editor-label">预览</div>
          <div id="md-preview" class="md-preview"></div>
        </div>
      </div>
      ${history.length > 0 ? `
        <div class="history">
          <div class="history-header">历史记录 <button class="btn-xs" id="clear-history">清空</button></div>
          ${history.slice(0, 3).map(h => `<div class="hist-item">${h}...</div>`).join('')}
        </div>
      ` : ''}
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

  document.getElementById('md-input')?.addEventListener('input', () => { updatePreview(); });
  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('md_history', JSON.stringify(history)); render();
  });
}

render();
