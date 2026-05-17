import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'Text Diff';
const APP_VERSION = '1.3.0';
const APP_DESC = '文本差异对比工具';

let theme: 'light' | 'dark' = (localStorage.getItem('textdiff_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('textdiff_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('textdiff_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  (document.getElementById('left') as HTMLTextAreaElement).value = '';
  (document.getElementById('right') as HTMLTextAreaElement).value = '';
  history = [];
  localStorage.clear();
  localStorage.setItem('textdiff_theme', theme);
  render();
}

function exportData(): void {
  const left = (document.getElementById('left') as HTMLTextAreaElement)?.value || '';
  const right = (document.getElementById('right') as HTMLTextAreaElement)?.value || '';
  const data = { left, right, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'textdiff-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.left) (document.getElementById('left') as HTMLTextAreaElement).value = data.left;
      if (data.right) (document.getElementById('right') as HTMLTextAreaElement).value = data.right;
      computeDiff();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

const app = document.getElementById('app')!;

interface DiffLine {
  left: string;
  right: string;
  type: 'same' | 'added' | 'removed' | 'changed';
}

function computeDiff(left: string[], right: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const maxLen = Math.max(left.length, right.length);
  for (let i = 0; i < maxLen; i++) {
    const l = left[i] || '';
    const r = right[i] || '';
    if (l === r) result.push({ left: l, right: r, type: 'same' });
    else if (!l) result.push({ left: '', right: r, type: 'added' });
    else if (!r) result.push({ left: l, right: '', type: 'removed' });
    else result.push({ left: l, right: r, type: 'changed' });
  }
  return result;
}

function render(): void {
  applyTheme();
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📝</span><span class="title">Text Diff</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="inputs">
        <div><label>原文</label><textarea id="left" placeholder="粘贴原文..."></textarea></div>
        <div><label>新文</label><textarea id="right" placeholder="粘贴新文..."></textarea></div>
      </div>
      <div class="actions">
        <button class="btn primary" id="compare">🔍 开始对比</button>
        <button class="btn" id="clear">🗑️ 清空</button>
      </div>
      <div class="stats" id="stats"></div>
      <div class="diff-area" id="diff"></div>
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

  document.getElementById('compare')?.addEventListener('click', () => { computeDiff(); });
  document.getElementById('clear')?.addEventListener('click', () => {
    (document.getElementById('left') as HTMLTextAreaElement).value = '';
    (document.getElementById('right') as HTMLTextAreaElement).value = '';
    (document.getElementById('diff') as HTMLElement).innerHTML = '';
    (document.getElementById('stats') as HTMLElement).innerHTML = '';
  });

  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('textdiff_history', JSON.stringify(history)); render();
  });
}

function computeDiff(): void {
  const leftText = (document.getElementById('left') as HTMLTextAreaElement)?.value || '';
  const rightText = (document.getElementById('right') as HTMLTextAreaElement)?.value || '';
  const left = leftText.split('\n');
  const right = rightText.split('\n');
  const diff = computeDiff(left, right);
  
  const statsEl = document.getElementById('stats')!;
  const diffEl = document.getElementById('diff')!;
  
  const added = diff.filter(d => d.type === 'added').length;
  const removed = diff.filter(d => d.type === 'removed').length;
  const changed = diff.filter(d => d.type === 'changed').length;
  statsEl.innerHTML = `新增: ${added} | 删除: ${removed} | 修改: ${changed}`;
  
  diffEl.innerHTML = diff.map(d => `
    <div class="diff-line ${d.type}">
      <div class="diff-left">${d.left}</div>
      <div class="diff-right">${d.right}</div>
    </div>
  `).join('');
  
  // 保存到历史
  history.unshift(`对比: ${leftText.slice(0, 30)}...`);
  if (history.length > 10) history.pop();
  localStorage.setItem('textdiff_history', JSON.stringify(history));
}

render();
