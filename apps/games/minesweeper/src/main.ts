/// <reference types="vite/client" />
import './style.css';
import {
  type Cell, type BoardConfig, type GameStatus,
  createBoard, populateBoard, generateRandomMines, generateMines,
  floodReveal, checkWin,
} from './core.js';
import { AudioManager } from './audio.js';
import { OnlineClient } from './online.js';

// ===== 常量 =====
const CELL_SIZE = 24;
const DIGIT_W = 13;
const DIGIT_H = 23;

const NUMBER_COLORS: Record<number, string> = {
  1: '#0000ff', 2: '#008000', 3: '#ff0000', 4: '#000080',
  5: '#800000', 6: '#008080', 7: '#000000', 8: '#808080',
};

const PRESETS: Record<string, BoardConfig> = {
  beginner: { width: 9, height: 9, mines: 10 },
  intermediate: { width: 16, height: 16, mines: 40 },
  expert: { width: 30, height: 16, mines: 99 },
};

const BEST_KEY = 'minesweeper_best';

// ===== 状态 =====
let config: BoardConfig = { ...PRESETS.beginner };
let board: Cell[][] = [];
let mines: Set<string> = new Set();
let status: GameStatus = 'idle';
let timer = 0;
let timerInterval: number | null = null;
let firstClick = true;
let totalMines = 10;
let isOnline = false;
let viewState: 'entry' | 'game' = 'entry';

// 在线状态
let onlineNick = '';
let onlineGameId = '';
let onlinePlayers: { nick: string; revealed: number; lost: boolean }[] = [];
let onlinePosition = -1;

const audio = new AudioManager();
const online = new OnlineClient();

// ===== 最佳记录 =====
function loadBest(): Record<string, number | null> {
  try { const r = JSON.parse(localStorage.getItem(BEST_KEY) || '{}'); return { beginner: null, intermediate: null, expert: null, ...r }; }
  catch { return { beginner: null, intermediate: null, expert: null }; }
}
function saveBest(level: string, time: number): void {
  const b = loadBest();
  if (b[level] === null || time < b[level]!) { b[level] = time; try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch {} }
}
function getBestLabel(): string {
  const level = config.width === 9 ? 'beginner' : config.width === 16 ? 'intermediate' : 'expert';
  const b = loadBest();
  return b[level] !== null ? `最佳: ${b[level]}s` : '';
}

// ===== 计时器 =====
function startTimer(): void {
  if (timerInterval) return;
  timer = 0;
  timerInterval = window.setInterval(() => { timer = Math.min(timer + 1, 999); updateLEDs(); }, 1000);
}
function stopTimer(): void { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

// ===== 初始化 =====
function initGame(): void {
  stopTimer();
  board = createBoard(config.width, config.height);
  mines = new Set();
  status = 'idle';
  timer = 0;
  firstClick = true;
  totalMines = config.mines;
  render();
}

// ===== 点击处理 =====
function handleClick(x: number, y: number): void {
  if (status === 'won' || status === 'lost') return;
  if (board[y][x].state === 'flagged' || board[y][x].state === 'revealed') return;

  audio.init();

  if (firstClick) {
    firstClick = false;
    status = 'playing';
    if (!isOnline) {
      mines = generateRandomMines(config.width, config.height, config.mines, x, y);
      populateBoard(board, mines);
    }
    startTimer();
  }

  if (isOnline) {
    online.send('game:reveal', { x, y });
    // 本地不立即揭示，等服务端确认
    return;
  }

  const cell = board[y][x];
  if (cell.mine) {
    // 踩雷
    cell.state = 'revealed';
    status = 'lost';
    stopTimer();
    revealAllMines();
    audio.mine();
    render();
    return;
  }

  floodReveal(x, y, board);
  audio.reveal();

  if (checkWin(board)) {
    status = 'won';
    stopTimer();
    flagAllMines();
    audio.win();
    const level = config.width === 9 && config.height === 9 ? 'beginner' : config.width === 16 && config.height === 16 ? 'intermediate' : 'expert';
    if (level in PRESETS) saveBest(level, timer);
  }
  render();
}

function handleRightClick(x: number, y: number): void {
  if (status === 'won' || status === 'lost') return;
  if (board[y][x].state === 'revealed') return;
  audio.init();

  const cell = board[y][x];
  if (cell.state === 'hidden') cell.state = 'flagged';
  else if (cell.state === 'flagged') cell.state = 'question';
  else cell.state = 'hidden';
  audio.flag();
  render();
}

/** 双键和弦：数字格周围旗数匹配时自动揭示周围 */
function handleChord(x: number, y: number): void {
  if (status !== 'playing') return;
  const cell = board[y][x];
  if (cell.state !== 'revealed' || cell.adjacent === 0) return;

  let flags = 0;
  const neighbors: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < config.width && ny >= 0 && ny < config.height) {
        if (board[ny][nx].state === 'flagged') flags++;
        else if (board[ny][nx].state === 'hidden') neighbors.push([nx, ny]);
      }
    }
  }

  if (flags !== cell.adjacent) return;

  for (const [nx, ny] of neighbors) {
    if (board[ny][nx].mine) {
      board[ny][nx].state = 'revealed';
      status = 'lost';
      stopTimer();
      revealAllMines();
      audio.mine();
      render();
      return;
    }
    floodReveal(nx, ny, board);
  }
  audio.reveal();

  if (checkWin(board)) {
    status = 'won';
    stopTimer();
    flagAllMines();
    audio.win();
  }
  render();
}

function revealAllMines(): void {
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      if (board[y][x].mine && board[y][x].state !== 'flagged') board[y][x].state = 'revealed';
    }
  }
}

function flagAllMines(): void {
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      if (board[y][x].mine) board[y][x].state = 'flagged';
    }
  }
}

// ===== LED 渲染 =====
function drawLED(ctx: CanvasRenderingContext2D, value: number, x: number, y: number, w: number, h: number): void {
  const str = String(Math.min(999, Math.max(-99, value))).padStart(value < 0 ? 3 : 3, '0');
  // 背景
  ctx.fillStyle = '#300';
  ctx.fillRect(x, y, w * 3 + 4, h + 4);
  for (let i = 0; i < 3; i++) {
    const ch = str[i] || '0';
    drawDigit(ctx, ch, x + 2 + i * w, y + 2, w - 2, h);
  }
}

function drawDigit(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#f00';
  ctx.font = `bold ${h - 2}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, x + w / 2, y + h / 2 + 1);
}

function updateLEDs(): void {
  const mineLED = document.getElementById('mine-led') as HTMLCanvasElement;
  const timerLED = document.getElementById('timer-led') as HTMLCanvasElement;
  if (mineLED) {
    const ctx = mineLED.getContext('2d')!;
    ctx.clearRect(0, 0, mineLED.width, mineLED.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    drawLED(ctx, totalMines - countFlags(), 0, 0, DIGIT_W, DIGIT_H);
    ctx.restore();
  }
  if (timerLED) {
    const ctx = timerLED.getContext('2d')!;
    ctx.clearRect(0, 0, timerLED.width, timerLED.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    drawLED(ctx, timer, 0, 0, DIGIT_W, DIGIT_H);
    ctx.restore();
  }
}

function countFlags(): number {
  let n = 0;
  for (const row of board) for (const c of row) if (c.state === 'flagged') n++;
  return n;
}

// ===== 主渲染 =====
const app = document.getElementById('app')!;

function render(): void {
  const w = config.width, h = config.height;
  const boardPxW = w * CELL_SIZE + 2;
  const boardPxH = h * CELL_SIZE + 2;
  const maxW = Math.min(window.innerWidth - 32, 800);
  const scale = Math.min(1, maxW / (boardPxW + 20));
  const face = status === 'won' ? '😎' : status === 'lost' ? '😵' : '😊';

  if (viewState === 'entry') {
    renderEntry();
    return;
  }

  // game view
  app.innerHTML = `<div class="mw-wrapper">
    <div class="mw-back-row">
      <button id="mw-back-entry" class="mw-back-btn" type="button">🏠 返回大厅</button>
    </div>
    <div class="mw-controls">
      ${!isOnline ? `<button id="mw-sound" class="mw-btn small">${audio.isEnabled() ? '🔊' : '🔇'}</button>` : ''}
    </div>
    ${renderCustomInput()}
    ${isOnline ? renderOnlineUI() : ''}
    <div class="mw-game" style="transform:scale(${scale});transform-origin:top center;">
      <div class="mw-frame">
        <div class="mw-header">
          <canvas id="mine-led" class="mw-led" width="${DIGIT_W * 3 + 8}" height="${DIGIT_H + 4}"></canvas>
          <button id="mw-face" class="mw-face">${face}</button>
          <canvas id="timer-led" class="mw-led" width="${DIGIT_W * 3 + 8}" height="${DIGIT_H + 4}"></canvas>
        </div>
        <canvas id="mw-board" class="mw-board" width="${boardPxW}" height="${boardPxH}"></canvas>
      </div>
    </div>
    <div class="mw-best">${getBestLabel()}</div>
  </div>`;

  drawBoard();
  updateLEDs();
  bindEvents();
}

function renderEntry(): void {
  app.innerHTML = `<div class="mw-wrapper">
    <div class="entry-bg">
      <div class="entry-logo">
        <span class="logo-icon">💣</span>
        <h1>扫雷</h1>
        <p class="entry-tagline">经典扫雷 · 单机挑战 · 联机速度赛</p>
      </div>
      <div class="entry-actions">
        <button id="mw-btn-start-beginner" class="entry-btn primary">
          <span class="btn-icon">🎮</span>
          <span class="btn-text-wrap">
            <span class="btn-text">开始游戏</span>
            <span class="btn-desc">初级 9×9 · 10 雷</span>
          </span>
        </button>
        <button id="mw-btn-online" class="entry-btn">
          <span class="btn-icon">🌐</span>
          <span class="btn-text-wrap">
            <span class="btn-text">联机速度赛</span>
            <span class="btn-desc">实时竞速 · 谁先清场</span>
          </span>
        </button>
      </div>
      <div class="entry-sub-row">
        <button id="mw-btn-intermediate" class="entry-sub-btn">中级 16×16</button>
        <button id="mw-btn-expert" class="entry-sub-btn">高级 30×16</button>
      </div>
      <div class="entry-footer">v1.0 · 经典扫雷</div>
    </div>
  </div>`;
  bindEntryEvents();
}

function showEntry(): void {
  viewState = 'entry';
  renderEntry();
}

function showGame(): void {
  viewState = 'game';
  render();
}

function bindEntryEvents(): void {
  document.getElementById('mw-btn-start-beginner')?.addEventListener('click', () => {
    config = { ...PRESETS.beginner };
    audio.init();
    isOnline = false;
    onlineGameId = '';
    initGame();
    showGame();
  });
  document.getElementById('mw-btn-intermediate')?.addEventListener('click', () => {
    config = { ...PRESETS.intermediate };
    audio.init();
    isOnline = false;
    onlineGameId = '';
    initGame();
    showGame();
  });
  document.getElementById('mw-btn-expert')?.addEventListener('click', () => {
    config = { ...PRESETS.expert };
    audio.init();
    isOnline = false;
    onlineGameId = '';
    initGame();
    showGame();
  });
  document.getElementById('mw-btn-online')?.addEventListener('click', () => {
    isOnline = true;
    onlinePlayers = [];
    onlineGameId = '';
    audio.init();
    showGame();
  });
}

function renderCustomInput(): string {
  // Show custom inputs only when custom is selected
  return `<div id="mw-custom" class="mw-custom hidden">
    <label>宽 <input type="number" id="mw-w" min="5" max="50" value="${config.width}"></label>
    <label>高 <input type="number" id="mw-h" min="5" max="50" value="${config.height}"></label>
    <label>雷 <input type="number" id="mw-m" min="1" max="${config.width * config.height - 9}" value="${config.mines}"></label>
    <button id="mw-apply" class="mw-btn small">应用</button>
  </div>`;
}

function renderOnlineUI(): string {
  if (!online.isConnected()) {
    return `<div class="mw-online">
      <div class="mw-online-row"><label>昵称 <input id="mw-nick" class="mw-input" value="${onlineNick}" placeholder="输入昵称"></label></div>
      <div class="mw-online-row"><button class="mw-btn" id="mw-connect">连接服务器</button></div>
      <div class="mw-status">未连接</div>
    </div>`;
  }
  if (!onlineGameId) {
    return `<div class="mw-online">
      <div class="mw-online-row">
        <button class="mw-btn" id="mw-create">创建房间</button>
        <span>或</span>
        <input id="mw-room-code" class="mw-input mw-room-input" placeholder="房间码">
        <button class="mw-btn" id="mw-join">加入</button>
      </div>
      <div class="mw-status">已连接</div>
    </div>`;
  }
  return `<div class="mw-online">
    <div class="mw-status">房间: ${onlineGameId} | ${onlinePlayers.map(p => `${p.nick}${p.lost ? '💀' : ''}(${p.revealed})`).join(', ')}</div>
  </div>`;
}

// ===== Canvas 绘制 =====
function drawBoard(): void {
  const canvas = document.getElementById('mw-board') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const w = config.width, h = config.height;

  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(0, 0, w * CELL_SIZE + 2, h * CELL_SIZE + 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      drawCell(ctx, x, y);
    }
  }
}

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cell = board[y]?.[x];
  if (!cell) return;
  const cx = x * CELL_SIZE + 1, cy = y * CELL_SIZE + 1;
  const s = CELL_SIZE - 1;

  if (cell.state === 'revealed') {
    // 平面
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(cx, cy, s, s);
    ctx.strokeStyle = '#808080';
    ctx.strokeRect(cx, cy, s, s);

    if (cell.mine) {
      // 雷
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx + s / 2, cy + s / 2, s / 3, 0, Math.PI * 2);
      ctx.fill();
      // 十字
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + s / 2, cy + 2); ctx.lineTo(cx + s / 2, cy + s - 2);
      ctx.moveTo(cx + 2, cy + s / 2); ctx.lineTo(cx + s - 2, cy + s / 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    } else if (cell.adjacent > 0) {
      ctx.fillStyle = NUMBER_COLORS[cell.adjacent] || '#000';
      ctx.font = `bold ${s - 4}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cell.adjacent), cx + s / 2, cy + s / 2 + 1);
    }
  } else if (cell.state === 'flagged') {
    // 3D 凸起 + 旗
    drawRaisedCell(ctx, cx, cy, s);
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.moveTo(cx + s / 3, cy + 3);
    ctx.lineTo(cx + s * 2 / 3, cy + s / 3);
    ctx.lineTo(cx + s / 3, cy + s / 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + s / 3, cy + 3);
    ctx.lineTo(cx + s / 3, cy + s - 4);
    ctx.stroke();
    ctx.lineWidth = 1;
  } else if (cell.state === 'question') {
    drawRaisedCell(ctx, cx, cy, s);
    ctx.fillStyle = '#000';
    ctx.font = `bold ${s - 4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx + s / 2, cy + s / 2 + 1);
  } else {
    // 隐藏 - 3D 凸起
    drawRaisedCell(ctx, cx, cy, s);
  }
}

function drawRaisedCell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(x, y, s, s);
  // 上左亮边
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + s); ctx.lineTo(x, y); ctx.lineTo(x + s, y);
  ctx.stroke();
  // 下右暗边
  ctx.strokeStyle = '#808080';
  ctx.beginPath();
  ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s);
  ctx.stroke();
}

// ===== 事件绑定 =====
function bindEvents(): void {
  const canvas = document.getElementById('mw-board') as HTMLCanvasElement;
  if (canvas) {
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE);
      const y = Math.floor((e.clientY - rect.top) * scaleY / CELL_SIZE);
      if (x >= 0 && x < config.width && y >= 0 && y < config.height) handleClick(x, y);
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE);
      const y = Math.floor((e.clientY - rect.top) * scaleY / CELL_SIZE);
      if (x >= 0 && x < config.width && y >= 0 && y < config.height) handleRightClick(x, y);
    });

    // 中键和弦
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE);
        const y = Math.floor((e.clientY - rect.top) * scaleY / CELL_SIZE);
        if (x >= 0 && x < config.width && y >= 0 && y < config.height) handleChord(x, y);
      }
    });

    // 触屏长按 = 右键
    let longPressTimer: number | null = null;
    let touchMoved = false;
    canvas.addEventListener('touchstart', (e) => {
      touchMoved = false;
      const touch = e.touches[0];
      longPressTimer = window.setTimeout(() => {
        if (!touchMoved) {
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
          const x = Math.floor((touch.clientX - rect.left) * scaleX / CELL_SIZE);
          const y = Math.floor((touch.clientY - rect.top) * scaleY / CELL_SIZE);
          if (x >= 0 && x < config.width && y >= 0 && y < config.height) handleRightClick(x, y);
          e.preventDefault();
        }
      }, 400);
    }, { passive: false });

    canvas.addEventListener('touchmove', () => {
      touchMoved = true;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    });

    canvas.addEventListener('touchend', (_e) => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      if (touchMoved) return;
    });
  }

  document.getElementById('mw-face')?.addEventListener('click', () => {
    if (isOnline) return;
    initGame();
  });

  document.getElementById('mw-back-entry')?.addEventListener('click', () => {
    stopTimer();
    isOnline = false;
    online.disconnect();
    onlineGameId = '';
    showEntry();
  });

  document.getElementById('mw-sound')?.addEventListener('click', () => {
    audio.toggle();
    render();
  });

  document.getElementById('mw-apply')?.addEventListener('click', () => {
    const w = parseInt((document.getElementById('mw-w') as HTMLInputElement).value, 10) || 9;
    const h = parseInt((document.getElementById('mw-h') as HTMLInputElement).value, 10) || 9;
    const m = parseInt((document.getElementById('mw-m') as HTMLInputElement).value, 10) || 10;
    if (m >= w * h) { alert('雷数必须小于宽×高'); return; }
    config = { width: Math.max(5, Math.min(50, w)), height: Math.max(5, Math.min(50, h)), mines: Math.max(1, m) };
    initGame();
  });

 // 在线按钮
  document.getElementById('mw-connect')?.addEventListener('click', () => {
    onlineNick = (document.getElementById('mw-nick') as HTMLInputElement)?.value || '匿名';
    online.connect();
    online.startPing();
    online.on(onlineHandler);
    setTimeout(render, 500);
  });

  document.getElementById('mw-create')?.addEventListener('click', () => {
    online.send('room:create', { width: config.width, height: config.height, mines: config.mines, nick: onlineNick });
  });

  document.getElementById('mw-join')?.addEventListener('click', () => {
    const code = (document.getElementById('mw-room-code') as HTMLInputElement)?.value;
    if (code) online.send('room:join', { gameId: code, nick: onlineNick });
  });
}

// ===== 在线消息处理 =====
function onlineHandler(type: string, data: unknown): void {
  if (type === 'connected') { render(); return; }
  if (type === 'pong') return;

  const d = data as Record<string, unknown>;

  if (type === 'room:created') {
    onlineGameId = (d as { gameId: string }).gameId;
    render();
    return;
  }

  if (type === 'room:joined') {
    render();
    return;
  }

  if (type === 'game:start') {
    const gd = d as { width: number; height: number; mineCount: number; seed: string };
    config = { width: gd.width, height: gd.height, mines: gd.mineCount };
    totalMines = gd.mineCount;
    board = createBoard(gd.width, gd.height);
    const mineSet = generateMines(gd.width, gd.height, gd.mineCount, gd.seed);
    populateBoard(board, mineSet);
    mines = mineSet;
    status = 'playing';
    firstClick = false;
    startTimer();
    render();
    return;
  }

  if (type === 'game:reveal') {
    const rd = d as { position: number; x: number; y: number; adjacent: number };
    if (rd.x >= 0 && rd.x < config.width && rd.y >= 0 && rd.y < config.height) {
      board[rd.y][rd.x].state = 'revealed';
      // flood fill locally
      if (rd.adjacent === 0) floodReveal(rd.x, rd.y, board);
    }
    render();
    return;
  }

  if (type === 'game:mine') {
    const md = d as { position: number; x: number; y: number };
    board[md.y][md.x].state = 'revealed';
    render();
    return;
  }

  if (type === 'game:over') {
    const od = d as { winner: number; scores: { nick: string; revealed: number }[] };
    status = od.winner === onlinePosition ? 'won' : 'lost';
    stopTimer();
    revealAllMines();
    render();
    return;
  }

  if (type === 'error') {
    const ed = d as { message: string };
    alert(ed.message);
    return;
  }
}

// 窗口resize
window.addEventListener('resize', () => { if (viewState === 'game') render(); });

// 启动：显示入口大厅
showEntry();
