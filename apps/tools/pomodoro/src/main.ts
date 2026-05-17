import '@app-hub/design-system/src/style.css';
/// <reference types="vite/client" />
import '@app-hub/utils/theme/variables.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';
import { createChart } from '@app-hub/utils/charts';

const APP_NAME = 'Pomodoro';
const APP_VERSION = '1.3.0';
const APP_DESC = '番茄工作法计时器，帮助专注工作与休息';

type Phase = 'work' | 'short' | 'long';

interface PomodoroState {
  work: number;
  short: number;
  long: number;
  phase: Phase;
  remaining: number;
  total: number;
  running: boolean;
  round: number;
  soundEnabled: boolean;
}

const DEFAULT_STATE: PomodoroState = { work: 25, short: 5, long: 15, phase: 'work', remaining: 25 * 60, total: 25 * 60, running: false, round: 0, soundEnabled: true };
const STORAGE_DB = 'pomodoro-db';
const store = createIdbStore(STORAGE_DB, 'kv');

let theme: 'light' | 'dark' = (localStorage.getItem('pomodoro_theme') as 'light' | 'dark') || 'light';
let currentTask = localStorage.getItem('pomodoro_task') || '';
let interruptions = parseInt(localStorage.getItem('pomodoro_interruptions') || '0');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('pomodoro_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  pause();
  state = { ...DEFAULT_STATE };
  setPhaseDuration();
  interruptions = 0;
  currentTask = '';
  localStorage.clear();
  store.set('state', state).then(() => render());
}

// 任务关联
function setTask(): void {
  const task = prompt('设置当前任务：', currentTask);
  if (task !== null) {
    currentTask = task;
    localStorage.setItem('pomodoro_task', task);
    render();
  }
}

// 打断记录
function recordInterruption(): void {
  interruptions++;
  localStorage.setItem('pomodoro_interruptions', String(interruptions));
  render();
}

// 导入/导出
function exportData(): void {
  const data = { state, stats: loadStats(), task: currentTask, interruptions, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pomodoro-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.state) { state = data.state; await saveState(state); }
      if (data.task) { currentTask = data.task; localStorage.setItem('pomodoro_task', currentTask); }
      if (data.interruptions) { interruptions = data.interruptions; localStorage.setItem('pomodoro_interruptions', String(interruptions)); }
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

async function loadState(): Promise<PomodoroState> {
  try {
    const raw = await store.get('state');
    if (raw) return raw as PomodoroState;
  } catch (e) { console.error('Load state failed', e); }
  return { ...DEFAULT_STATE };
}

async function saveState(state: PomodoroState): Promise<void> {
  await store.set('state', state);
}

function getToday(): string { return new Date().toISOString().slice(0, 10); }
async function loadStats(): Promise<Record<string, number>> {
  try {
    const raw = await store.get('stats');
    return raw ?? {};
  } catch { return {}; }
}
async function saveToday(count: number): Promise<void> {
  const s = await loadStats();
  s[getToday()] = count;
  await store.set('stats', s);
}
async function getTodayCount(): Promise<number> {
  const s = await loadStats();
  return s[getToday()] || 0;
}

function notify(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function playSound(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch { /* ignore */ }
}

let state: PomodoroState = { ...DEFAULT_STATE };
let timer: number | null = null;
let showStats = false;
let statsRange: '7d' | '30d' = '7d';

async function tick(): Promise<void> {
  state.remaining--;
  if (state.remaining <= 0) {
    playSound();
    if (state.phase === 'work') {
      state.round++;
      const count = await getTodayCount();
      await saveToday(count + 1);
      notify('🍅 番茄完成！', `已完成第 ${state.round} 个番茄`);
      if (state.round % 4 === 0) state.phase = 'long';
      else state.phase = 'short';
    } else {
      notify('⏰ 休息结束', '开始新的番茄吧！');
      state.phase = 'work';
    }
    const mins = state.phase === 'work' ? state.work : state.phase === 'short' ? state.short : state.long;
    state.total = mins * 60;
    state.remaining = state.total;
  }
  await saveState(state);
  render();
}

function start(): void {
  if (state.running) return;
  state.running = true;
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  timer = window.setInterval(() => tick(), 1000);
  render();
}

function pause(): void {
  state.running = false;
  if (timer) { clearInterval(timer); timer = null; }
  render();
}

function reset(): void {
  pause();
  state.phase = 'work';
  state.round = 0;
  setPhaseDuration();
  render();
}

function setPhaseDuration(): void {
  const mins = state.phase === 'work' ? state.work : state.phase === 'short' ? state.short : state.long;
  state.total = mins * 60;
  state.remaining = state.total;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function phaseColor(p: Phase): string {
  return p === 'work' ? '#e74c3c' : '#2ecc71';
}

const RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

async function render(): Promise<void> {
  applyTheme();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🍅</span><span class="title">Pomodoro</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="task-btn">📋 任务</button>
        <button class="btn-sm" id="interrupt-btn">⚠️ 打断 (${interruptions})</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
        <button class="btn-sm" id="stats-toggle">${showStats ? '⏰ Timer' : '📊 Stats'}</button>
      </div>
    </header>
    <main class="main">
      ${showStats ? await renderStats() : renderTimer()}
    </main>
  </div>`;
  bindEvents();
  if (showStats) await initChart();
}

function renderTimer() {
  const percent = state.total > 0 ? (state.total - state.remaining) / state.total : 0;
  const offset = CIRCUMFERENCE * (1 - percent);
  return `
      <div class="timer">
        <svg class="progress-ring" viewBox="0 0 240 240">
          <circle class="track" cx="120" cy="120" r="${RADIUS}" fill="none" stroke="var(--border)" stroke-width="12"/>
          <circle class="ring" cx="120" cy="120" r="${RADIUS}" fill="none" stroke="${phaseColor(state.phase)}" stroke-width="12" stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="${offset}" />
        </svg>
        <div class="timer-display">
          <div class="phase-label">${state.phase === 'work' ? '工作' : state.phase === 'short' ? '短休' : '长休'}</div>
          ${currentTask ? `<div class="task-label">📋 ${currentTask}</div>` : ''}
          <div class="time">${formatTime(state.remaining)}</div>
          <div class="rounds">第 ${state.round} 轮 (共 ${Math.floor(state.round/4) || 0} 个完整循环)</div>
        </div>
        <div class="controls">
          <button class="ctrl-btn" id="start">${state.running ? '⏸' : '▶'}</button>
          <button class="ctrl-btn" id="reset">↻</button>
        </div>
      </div>
    `;
}

async function renderStats() {
  const days = statsRange === '7d' ? 7 : 30;
  const labels: string[] = [];
  const data: number[] = [];
  const stats = await loadStats();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    labels.push(dateStr.slice(5));
    data.push(stats[dateStr] || 0);
  }

  return `
      <div class="stats-controls">
        <button class="range-btn ${statsRange==='7d'?'active':''}" data-range="7d">7天</button>
        <button class="range-btn ${statsRange==='30d'?'active':''}" data-range="30d">30天</button>
      </div>
      <canvas id="stats-chart" height="200"></canvas>
      <div class="stats-summary">
        <span>总计: ${data.reduce((a,b)=>a+b,0)} 番茄</span>
        <span>打断: ${interruptions} 次</span>
        <span>日均: ${data.filter(v=>v>0).length ? Math.round(data.reduce((a,b)=>a+b)/data.filter(v=>v>0).length) : 0}</span>
      </div>
    `;
}

async function initChart() {
  const canvas = document.getElementById('stats-chart') as HTMLCanvasElement;
  if (!canvas) return;
  const days = statsRange === '7d' ? 7 : 30;
  const labels: string[] = [];
  const data: number[] = [];
  const stats = await loadStats();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    labels.push(dateStr.slice(5));
    data.push(stats[dateStr] || 0);
  }

  createChart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: '番茄数', data, backgroundColor: 'var(--accent)' }],
    },
  });
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });
  document.getElementById('task-btn')?.addEventListener('click', () => { setTask(); });
  document.getElementById('interrupt-btn')?.addEventListener('click', () => { recordInterruption(); });

  document.getElementById('start')?.addEventListener('click', async () => {
    if (state.running) pause(); else start();
    render();
  });
  document.getElementById('reset')?.addEventListener('click', async () => {
    reset();
  });
  document.getElementById('stats-toggle')?.addEventListener('click', async () => {
    showStats = !showStats;
    render();
  });
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      statsRange = (btn as HTMLElement).dataset.range as '7d' | '30d';
      render();
    });
  });
}

// 初始化
(async () => {
  state = await loadState();
  // ensure phase duration
  const mins = state.phase === 'work' ? state.work : state.phase === 'short' ? state.short : state.long;
  state.total = mins * 60;
  state.remaining = state.total;
  render();
})();
