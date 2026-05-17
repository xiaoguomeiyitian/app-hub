import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'Calculator';
const APP_VERSION = '1.3.0';
const APP_DESC = '支持基础运算、科学计算、程序员模式的增强计算器';

type Mode = 'basic' | 'scientific' | 'programmer';
let mode: Mode = 'basic';
let display = '0';
let expression = '';
let history: string[] = JSON.parse(localStorage.getItem('calculator_history') || '[]');
let memory = 0;
let theme: 'light' | 'dark' = (localStorage.getItem('calculator_theme') as 'light' | 'dark') || 'light';

// 本地存储持久化
function saveState(): void {
  localStorage.setItem('calculator_history', JSON.stringify(history));
  localStorage.setItem('calculator_theme', theme);
  localStorage.setItem('calculator_mode', mode);
}

// 导出历史记录
function exportData(): void {
  const data = { history, mode, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'calculator-data.json'; a.click();
  URL.revokeObjectURL(url);
}

// 导入历史记录
function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.history) { history = data.history; saveState(); render(); }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

// 重置功能
function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？')) return;
  history = []; display = '0'; expression = ''; mode = 'basic'; theme = 'light';
  localStorage.clear(); applyTheme(); render();
}

// 关于对话框
function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

// 主题切换
function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  applyTheme(); saveState();
}

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function safeEval(expr: string): string {
  try {
    expr = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    // Scientific replacements
    expr = expr.replace(/sin\(/g, 'Math.sin(').replace(/cos\(/g, 'Math.cos(').replace(/tan\(/g, 'Math.tan(');
    expr = expr.replace(/log\(/g, 'Math.log10(').replace(/ln\(/g, 'Math.log(');
    expr = expr.replace(/sqrt\(/g, 'Math.sqrt(').replace(/π/g, 'Math.PI').replace(/e(?![a-z])/g, 'Math.E');
    expr = expr.replace(/\^/g, '**');
    const result = Function('"use strict"; return (' + expr + ')')();
    if (typeof result !== 'number' || !isFinite(result)) return 'Error';
    return String(parseFloat(result.toPrecision(12)));
  } catch { return 'Error'; }
}

function toHex(n: string): string { return parseInt(n).toString(16).toUpperCase(); }
function toBin(n: string): string { return parseInt(n).toString(2); }
function toOct(n: string): string { return parseInt(n).toString(8); }

function press(key: string): void {
  if (key === 'C') { display = '0'; expression = ''; return; }
  if (key === '⌫') { display = display.length > 1 ? display.slice(0, -1) : '0'; return; }
  if (key === '=') {
    const expr = expression + display;
    const result = safeEval(expr);
    history.unshift(`${expr} = ${result}`);
    if (history.length > 20) history.pop();
    display = result;
    expression = '';
    return;
  }
  if (['+', '-', '×', '÷', '^'].includes(key)) {
    expression = expression + display + key;
    display = '0';
    return;
  }
  if (['sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt('].includes(key)) {
    expression = expression + key;
    return;
  }
  if (key === 'π') { display = String(Math.PI); return; }
  if (display === '0' && key !== '.') display = key;
  else display += key;
}

function render(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  const sciButtons = ['sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt(', 'π', '^', '(', ')'];
  const basicButtons = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '−'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];

  let numVal = parseInt(display) || 0;

  app.innerHTML = `
  <div class="app">
    <header class="header"><span class="logo">🔢</span><span class="title">Calculator</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <select id="mode-select" class="select"><option value="basic" ${mode==='basic'?'selected':''}>Basic</option><option value="scientific" ${mode==='scientific'?'selected':''}>Scientific</option><option value="programmer" ${mode==='programmer'?'selected':''}>Programmer</option></select>
      </div>
    </header>
    <main class="main">
      <div class="calc">
        <div class="display">
          <div class="expr">${expression || ''}</div>
          <div class="result">${display}</div>
        </div>
        ${mode === 'programmer' ? `
          <div class="prog-display">
            <div>HEX: <span>${isNaN(numVal) ? '-' : toHex(display)}</span></div>
            <div>DEC: <span>${display}</span></div>
            <div>OCT: <span>${isNaN(numVal) ? '-' : toOct(display)}</span></div>
            <div>BIN: <span>${isNaN(numVal) ? '-' : toBin(display)}</span></div>
          </div>
        ` : ''}
        ${mode === 'scientific' ? `
          <div class="sci-row">
            ${sciButtons.map(b => `<button class="btn sci" data-key="${b}">${b.replace('sqrt(', '√').replace('log(', 'log').replace('ln(', 'ln').replace('sin(', 'sin').replace('cos(', 'cos').replace('tan(', 'tan')}</button>`).join('')}
          </div>
        ` : ''}
        <div class="buttons">
          ${basicButtons.map(row => `
            <div class="btn-row">
              ${row.map(b => `<button class="btn ${['+','−','×','÷','%','=','C','⌫'].includes(b) ? 'op' : ''} ${b === '0' ? 'wide' : ''} ${b === '=' ? 'eq' : ''}" data-key="${b}">${b}</button>`).join('')}
            </div>
          `).join('')}
        </div>
        <div class="actions">
          <button class="btn btn-sm" id="export-btn">导出</button>
          <label class="btn btn-sm"><input type="file" accept=".json" id="import-input" hidden/>导入</label>
          <button class="btn btn-sm" id="reset-btn">重置</button>
        </div>
        ${history.length > 0 ? `
          <div class="history">
            <div class="hist-header">History <button class="btn-xs" id="clear-hist">Clear</button></div>
            ${history.slice(0, 5).map(h => `<div class="hist-item">${h}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    </main>
  </div>`;
  bindEvents();
}

function bindEvents(): void {
  document.querySelectorAll('.btn[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      press((btn as HTMLElement).dataset.key!);
      saveState(); render();
    });
  });
  document.getElementById('mode-select')?.addEventListener('change', (e) => {
    mode = (e.target as HTMLSelectElement).value as Mode;
    saveState(); render();
  });
  document.getElementById('clear-hist')?.addEventListener('click', () => { history = []; saveState(); render(); });
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.addEventListener('keydown', (e) => {
    const map: Record<string, string> = { '/': '÷', '*': '×', '-': '−', Enter: '=', Backspace: '⌫', Escape: 'C', '=': '=' };
    const key = map[e.key] || e.key;
    if (/^[0-9.+\-=%]$/.test(key) || ['÷', '×', '−', '=', '⌫', 'C'].includes(key)) {
      press(key); saveState(); render();
    }
  });
}

render();
