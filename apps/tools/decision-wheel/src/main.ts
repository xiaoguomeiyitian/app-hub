import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'Decision Wheel';
const APP_VERSION = '1.3.0';
const APP_DESC = '决策转盘，随机选择工具';

const COLORS = ['#f85149','#58a6ff','#3fb950','#d29922','#bc8cff','#f778ba','#79c0ff','#7ee787','#ffa657','#d2a8ff'];
let theme: 'light' | 'dark' = (localStorage.getItem('decision_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('decision_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('decision_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  options = ['选项A','选项B','选项C'];
  history = [];
  localStorage.clear();
  localStorage.setItem('decision_theme', theme);
  render();
}

function exportData(): void {
  const data = { options, history, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'decision-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.options) { options = data.options; }
      if (data.history) { history = data.history; localStorage.setItem('decision_history', JSON.stringify(history)); }
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

let options: string[] = ['选项A','选项B','选项C'];
let spinning = false;
let angle = 0;
let velocity = 0;
let result = '';
let lastResult = '';

function render() {
  applyTheme();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🎡</span><span class="title">Decision Wheel</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="input-area">
        <input id="optInput" placeholder="输入选项..." />
        <button id="addBtn">添加</button>
        <button class="spin" id="spinBtn" ${options.length<2||spinning?'disabled':''}>🎲 开始</button>
      </div>
      <div class="options" id="tags">
        ${options.map((o,i)=>`<div class="tag"><span>${o}</span><button class="remove" data-i="${i}">×</button></div>`).join('')}
      </div>
      <div class="pointer"></div>
      <canvas id="wheel" width="320" height="320"></canvas>
      ${result?`<div class="result">🎯 ${result}</div>`:''}
      ${lastResult?`<div class="last-result">上次：${lastResult}</div>`:''}
      ${history.length > 0 ? `
        <div class="history">
          <div class="history-header">历史记录 <button class="btn-xs" id="clear-history">清空</button></div>
          ${history.slice(0, 5).map(h => `<div class="hist-item">${h}</div>`).join('')}
        </div>
      ` : ''}
    </main>
  </div>`;
  bindEvents();
  drawWheel();
}

function drawWheel(): void {
  const canvas = document.getElementById('wheel') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const cx = 160, cy = 160, r = 150;
  const n = options.length;
  if (n === 0) return;
  const arc = 2 * Math.PI / n;
  options.forEach((opt, i) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, arc*i + angle, arc*(i+1) + angle);
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(arc*i + angle + arc/2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(opt, r - 10, 5);
    ctx.restore();
  });
}

function addOption(): void {
  const input = document.getElementById('optInput') as HTMLInputElement;
  if (input.value) { options.push(input.value); input.value = ''; render(); }
}

function spin(): void {
  if (spinning || options.length < 2) return;
  spinning = true;
  velocity = 0.3 + Math.random()*0.2;
  result = '';
  const animate = () => {
    angle += velocity;
    velocity *= 0.995;
    drawWheel();
    if (velocity > 0.001) requestAnimationFrame(animate);
    else {
      spinning = false;
      const n = options.length;
      const arc = 2 * Math.PI / n;
      const idx = Math.floor(((2*Math.PI - (angle % (2*Math.PI))) % (2*Math.PI) / arc) % n;
      result = options[idx];
      lastResult = result;
      history.unshift(result);
      if (history.length > 20) history.pop();
      localStorage.setItem('decision_history', JSON.stringify(history));
      render();
    }
  };
  animate();
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });

  document.getElementById('addBtn')!.addEventListener('click', addOption);
  document.getElementById('optInput')!.addEventListener('keydown', e => { if (e.key === 'Enter') addOption(); });
  document.getElementById('spinBtn')!.addEventListener('click', spin);
  document.querySelectorAll('.remove').forEach(el => {
    el.addEventListener('click', () => {
      const i = +(el as HTMLElement).dataset.i!;
      options.splice(i, 1);
      render();
    });
  });
  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('decision_history', JSON.stringify(history)); render();
  });
}

render();
