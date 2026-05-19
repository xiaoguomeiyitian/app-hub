import '@app-hub/design-system/src/style.css';
/// <reference types="vite/client" />
import '@app-hub/utils/theme/variables.css';
import './style.css';

const APP_NAME = 'JSON Tool';
const APP_VERSION = '1.3.0';
const APP_DESC = 'JSON 工具集：格式化、验证、对比、转其他格式';

let theme: 'light' | 'dark' = (localStorage.getItem('json_theme') as 'light' | 'dark') || 'light';
let indent = 2;
let view: 'formatted' | 'tree' | 'compare' = 'formatted';
let inputText = '{"name":"Code Shot","version":"1.0.0","features":["format","validate","tree"],"config":{"theme":"dracula","fontSize":14,"lineNumbers":true}}';
let compareText = '{"name":"Code Shot","version":"1.1.0","features":["format","validate"],"config":{"theme":"monokai"}}';
let history: string[] = JSON.parse(localStorage.getItem('json_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('json_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  history = [];
  inputText = '';
  compareText = '';
  localStorage.clear();
  localStorage.setItem('json_theme', theme);
  render();
}

// 导入/导出
function exportData(): void {
  const data = { inputText, compareText, history, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'json-tool-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.inputText) { inputText = data.inputText; }
      if (data.compareText) { compareText = data.compareText; }
      if (data.history) { history = data.history; localStorage.setItem('json_history', JSON.stringify(history)); }
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

// JSON 转其他格式
function convertToXML(json: unknown): string {
  function toXML(obj: unknown, tag = 'root'): string {
    if (obj === null) return `<${tag} nil="true"/>`;
    if (typeof obj !== 'object') return `<${tag}>${obj}</${tag}>`;
    if (Array.isArray(obj)) {
      return `<${tag}>${obj.map((item) => toXML(item, 'item')).join('')}</${tag}>`;
    }
    const entries = Object.entries(obj as Record<string, unknown>);
    return `<${tag}>${entries.map(([k, v]) => toXML(v, k)).join('')}</${tag}>`;
  }
  return `<?xml version="1.0"?>${toXML(json)}`;
}

function convertToYAML(json: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (Array.isArray(json)) {
    return json.map(item => `${pad}- ${convertToYAML(item, indent + 1)}`).join('\n');
  }
  if (typeof json === 'object' && json !== null) {
    const entries = Object.entries(json as Record<string, unknown>);
    return entries.map(([k, v]) => `${pad}${k}: ${convertToYAML(v, indent + 1)}`).join('\n');
  }
  return String(json);
}

function tryParse(text: string): { ok: true; data: unknown } | { ok: false; error: string; line: number; col: number } {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e) {
    const msg = (e as Error).message;
    const m = msg.match(/position (\d+)/);
    const pos = m ? parseInt(m[1], 10) : 0;
    const before = text.slice(0, pos);
    const line = (before.match(/\n/g) || []).length + 1;
    const col = pos - before.lastIndexOf('\n');
    return { ok: false, error: msg, line, col };
  }
}

function formatJSON(data: unknown, spaces: number): string {
  return JSON.stringify(data, null, spaces);
}

function compressJSON(data: unknown): string {
  return JSON.stringify(data);
}

function render(): void {
  applyTheme();
  const parsed = tryParse(inputText);
  const app = document.getElementById('app')!;
  
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📋</span><span class="title">JSON Tool</span>
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
        <button class="btn ${view === 'formatted' ? 'active' : ''}" id="view-formatted">格式化</button>
        <button class="btn ${view === 'tree' ? 'active' : ''}" id="view-tree">树形</button>
        <button class="btn ${view === 'compare' ? 'active' : ''}" id="view-compare">对比</button>
        <select id="indent-select" class="select">
          <option value="2" ${indent === 2 ? 'selected' : ''}>2空格</option>
          <option value="4" ${indent === 4 ? 'selected' : ''}>4空格</option>
        </select>
        <button class="btn" id="copy-btn">📋 复制</button>
        <button class="btn" id="minify-btn">压缩</button>
      </div>
      <div class="editor-container">
        <div class="editor-box">
          <div class="editor-label">输入 JSON</div>
          <textarea id="json-input" class="json-editor" placeholder="输入JSON...">${inputText}</textarea>
          ${parsed.ok ? '<div class="status-ok">✅ 有效 JSON</div>' : `<div class="status-error">❌ ${parsed.error}</div>`}
        </div>
        ${view === 'compare' ? `
          <div class="editor-box">
            <div class="editor-label">对比 JSON</div>
            <textarea id="json-compare" class="json-editor" placeholder="输入对比JSON...">${compareText}</textarea>
          </div>
        ` : ''}
      </div>
      <div class="output-box">
        <div class="output-label">输出</div>
        <pre id="json-output" class="json-output">${parsed.ok ? formatJSON(parsed.data, indent) : '无效 JSON'}</pre>
      </div>
      <div class="convert-box">
        <button class="btn-sm" id="to-xml">转 XML</button>
        <button class="btn-sm" id="to-yaml">转 YAML</button>
        <button class="btn-sm" id="show-stats">统计信息</button>
      </div>
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

  document.getElementById('view-formatted')?.addEventListener('click', () => { view = 'formatted'; render(); });
  document.getElementById('view-tree')?.addEventListener('click', () => { view = 'tree'; render(); });
  document.getElementById('view-compare')?.addEventListener('click', () => { view = 'compare'; render(); });

  document.getElementById('indent-select')?.addEventListener('change', (e) => {
    indent = parseInt((e.target as HTMLSelectElement).value);
    render();
  });

  document.getElementById('json-input')?.addEventListener('input', (e) => {
    inputText = (e.target as HTMLTextAreaElement).value;
    history.unshift(inputText.slice(0, 100));
    if (history.length > 20) history.pop();
    localStorage.setItem('json_history', JSON.stringify(history));
    render();
  });

  document.getElementById('json-compare')?.addEventListener('input', (e) => {
    compareText = (e.target as HTMLTextAreaElement).value;
  });

  document.getElementById('copy-btn')?.addEventListener('click', () => {
    const output = document.getElementById('json-output')?.textContent || '';
    navigator.clipboard.writeText(output);
  });

  document.getElementById('minify-btn')?.addEventListener('click', () => {
    const parsed = tryParse(inputText);
    if (parsed.ok) {
      inputText = compressJSON(parsed.data);
      render();
    }
  });

  document.getElementById('to-xml')?.addEventListener('click', () => {
    const parsed = tryParse(inputText);
    if (parsed.ok) {
      const xml = convertToXML(parsed.data);
      const output = document.getElementById('json-output') as HTMLPreElement;
      if (output) output.textContent = xml;
    }
  });

  document.getElementById('to-yaml')?.addEventListener('click', () => {
    const parsed = tryParse(inputText);
    if (parsed.ok) {
      const yaml = convertToYAML(parsed.data);
      const output = document.getElementById('json-output') as HTMLPreElement;
      if (output) output.textContent = yaml;
    }
  });

  document.getElementById('show-stats')?.addEventListener('click', () => {
    const parsed = tryParse(inputText);
    if (parsed.ok) {
      const jsonStr = JSON.stringify(parsed.data);
      const size = new Blob([jsonStr]).size;
      const keys = jsonStr.match(/"\w+":/g)?.length || 0;
      alert(`大小: ${size} bytes\n键数: ${keys}\n类型: ${Array.isArray(parsed.data) ? '数组' : typeof parsed.data}`);
    }
  });

  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = [];
    localStorage.setItem('json_history', JSON.stringify(history));
    render();
  });
}

render();
