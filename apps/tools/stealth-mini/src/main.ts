import '@app-hub/design-system/src/style.css';
import './style.css';
// Simplified stealth game
const APP_NAME = 'Stealth Mini';
const APP_VERSION = '1.3.0';
const APP_DESC = '潜行迷你游戏';

let theme: 'light' | 'dark' = (localStorage.getItem('stealth_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('stealth_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('stealth_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  score = 0; history = [];
  localStorage.clear();
  localStorage.setItem('stealth_theme', theme);
  init(); render();
}

function exportData(): void {
  const data = { score, history, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'stealth-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.score) { score = data.score; }
      if (data.history) { history = data.history; localStorage.setItem('stealth_history', JSON.stringify(history)); }
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

const W=400,H=400;
let courier={x:50,y:50},guards:{x:number,y:number}[],goal={x:350,y:350},score=0,caught=false;

function init():void{
  courier={x:50,y:50};
  guards=[{x:200,y:100},{x:300,y:200},{x:150,y:300}];
  goal={x:350,y:350};score=0;caught=false;
}

function update():void{
  if(caught)return;
  // Move guards towards courier
  for(const g of guards){
    const dx=courier.x-g.x,dy=courier.y-g.y,d=Math.sqrt(dx*dx+dy*dy);
    if(d>0){g.x+=dx/d*1.5;g.y+=dy/d*1.5;}
    if(d<20)caught=true;
  }
  // Check goal
  if(Math.abs(courier.x-goal.x)<20&&Math.abs(courier.y-goal.y)<20){score++; init();}
}

function render(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🎭</span><span class="title">Stealth Mini</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="st-wrapper">
        <div class="st-header"><span>🎭 潜行快递</span><span>得分: ${score}</span><button id="st-restart" class="st-btn">重新开始</button></div>
        <canvas id="st-canvas" width="${W}" height="${H}"></canvas>
        <div class="st-hints">↑↓←→ 移动 | 躲避保安到达绿点</div>
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
  
  const c=document.getElementById('st-canvas') as HTMLCanvasElement;
  if (!c) return;
  const ctx=c.getContext('2d')!;
  ctx.fillStyle='#1a1a2e';ctx.fillRect(0,0,W,H);
  // Goal
  ctx.fillStyle='#2ecc71';ctx.fillRect(goal.x-10,goal.y-10,20,20);
  // Guards
  ctx.fillStyle='#e74c3c';
  guards.forEach(g=>ctx.fillRect(g.x-8,g.y-8,16,16));
  // Courier
  ctx.fillStyle='#3498db';ctx.fillRect(courier.x-6,courier.y-6,12,12);
  
  // 保存历史
  history.unshift(`Score: ${score}`);
  if (history.length > 10) history.pop();
  localStorage.setItem('stealth_history', JSON.stringify(history));
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });

  document.getElementById('st-restart')?.addEventListener('click', () => { init(); render(); });
  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('stealth_history', JSON.stringify(history)); render();
  });

  document.addEventListener('keydown', (e) => {
    const step = 10;
    if (e.key === 'ArrowUp') courier.y -= step;
    if (e.key === 'ArrowDown') courier.y += step;
    if (e.key === 'ArrowLeft') courier.x -= step;
    if (e.key === 'ArrowRight') courier.x += step;
    update(); render();
  });
}

init(); render();
