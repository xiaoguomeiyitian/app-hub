/// <reference types="vite/client" />
import './style.css';

const COLS = 7;
const ROWS = 6;
const CELL = 48;

type Cell = 0 | 1 | 2;
type Board = Cell[][];

let board: Board = [];
let current: Cell = 1;
let gameOver = false;
let winner: Cell = 0;
let started = false;
let animCol = -1;
let animRow = -1;
let animY = 0;
let animating = false;
let aiDifficulty = 'medium';

let audioCtx: AudioContext | null = null;
function sfx(freq: number, dur: number, type: OscillatorType = 'sine'): void {
  if (!audioCtx) { try { audioCtx = new AudioContext(); } catch { return; } }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]);
}

function dropPiece(col: number, player: Cell): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) { board[r][col] = player; return r; }
  }
  return -1;
}

function checkWin(r: number, c: number, p: Cell): boolean {
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let i = 1; i < 4; i++) {
      const nr = r + dr * i;
      const nc = c + dc * i;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === p) { count++; }
      else { break; }
    }
    for (let i = 1; i < 4; i++) {
      const nr = r - dr * i;
      const nc = c - dc * i;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === p) { count++; }
      else { break; }
    }
    if (count >= 4) { return true; }
  }
  return false;
}

function isFull(): boolean {
  return board[0].every(c => c !== 0);
}

function aiMove(): number {
  const cols = [...Array(COLS).keys()].filter(c => board[0][c] === 0);
  if (!cols.length) { return -1; }
  // 检查 AI 是否能赢
  for (const c of cols) {
    const r = dropPiece(c, 2);
    if (r >= 0) {
      if (checkWin(r, c, 2)) { board[r][c] = 0; return c; }
      board[r][c] = 0;
    }
  }
  // 阻止玩家赢
  for (const c of cols) {
    const r = dropPiece(c, 1);
    if (r >= 0) {
      if (checkWin(r, c, 1)) { board[r][c] = 0; return c; }
      board[r][c] = 0;
    }
  }
  // 困难模式优先中心
  if (aiDifficulty === 'hard' && board[0][3] === 0) { return 3; }
  // 随机
  return cols[Math.floor(Math.random() * cols.length)];
}

function init(): void {
  board = createBoard();
  current = 1;
  gameOver = false;
  winner = 0;
  started = true;
  animating = false;
}

function doDrop(col: number): void {
  if (gameOver || animating || board[0][col] !== 0) { return; }
  const row = dropPiece(col, current);
  if (row < 0) { return; }
  animating = true;
  animCol = col;
  animRow = row;
  animY = 0;
  sfx(300, 0.1);

  const targetY = row * CELL;
  const dropAnim = (): void => {
    animY += 12;
    if (animY >= targetY) {
      animY = targetY;
      animating = false;
      if (checkWin(row, col, current)) {
        winner = current;
        gameOver = true;
        sfx(880, 0.3, 'sine');
      } else if (isFull()) {
        gameOver = true;
      } else {
        current = current === 1 ? 2 : 1;
        if (current === 2) {
          setTimeout(() => {
            const aiCol = aiMove();
            if (aiCol >= 0) { doDrop(aiCol); }
          }, 300);
        }
      }
      render();
      return;
    }
    render();
    requestAnimationFrame(dropAnim);
  };
  dropAnim();
}

const app = document.getElementById('app')!;

function render(): void {
  const w = COLS * CELL;
  const h = ROWS * CELL;

  app.innerHTML = `<div class="c4-wrapper">
    <h1 class="c4-title">🔴 四子棋</h1>
    <div class="c4-controls">
      <div class="c4-hint">点按任意列落子，手机支持触摸操作</div>
      <select id="c4-diff" class="c4-select">
        <option value="easy" ${aiDifficulty === 'easy' ? 'selected' : ''}>简单</option>
        <option value="medium" ${aiDifficulty === 'medium' ? 'selected' : ''}>中等</option>
        <option value="hard" ${aiDifficulty === 'hard' ? 'selected' : ''}>困难</option>
      </select>
      <button class="c4-btn" id="c4-new">新游戏</button>
    </div>
    <div class="c4-status">${gameOver ? (winner === 1 ? '🎉 你赢了！' : '😢 AI 赢了') : (current === 1 ? '你的回合 (红)' : 'AI 思考中...')}</div>
    <div class="c4-canvas-wrap">
      <canvas id="c4-canvas" width="${w}" height="${h}"></canvas>
      ${!started ? '<div class="c4-overlay"><div><h2>🔴 四子棋</h2><p>点击列落子</p><button class="c4-btn primary" id="c4-go">开始</button></div></div>' : ''}
      ${gameOver ? `<div class="c4-overlay"><div><h2>${winner === 1 ? '🎉 你赢了！' : '😢 AI 赢了'}</h2><button class="c4-btn primary" id="c4-retry">再来</button></div></div>` : ''}
    </div>
  </div>`;

  const c = document.getElementById('c4-canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;

  // 棋盘背景
  ctx.fillStyle = '#1a3a8a';
  ctx.fillRect(0, 0, w, h);

  // 绘制格子
  for (let r = 0; r < ROWS; r++) {
    for (let cc = 0; cc < COLS; cc++) {
      const x = cc * CELL + CELL / 2;
      const y = r * CELL + CELL / 2;
      ctx.beginPath();
      ctx.arc(x, y, CELL / 2 - 4, 0, Math.PI * 2);
      ctx.fillStyle = '#0a1a4a';
      ctx.fill();
      const val = board[r][cc];
      if (val > 0) {
        if (animating && cc === animCol && r === animRow) {
          ctx.beginPath();
          ctx.arc(x, animY + CELL / 2, CELL / 2 - 4, 0, Math.PI * 2);
          ctx.fillStyle = val === 1 ? '#e74c3c' : '#f1c40f';
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, CELL / 2 - 4, 0, Math.PI * 2);
          ctx.fillStyle = val === 1 ? '#e74c3c' : '#f1c40f';
          ctx.fill();
        }
      }
    }
  }

  document.getElementById('c4-go')?.addEventListener('click', init);
  document.getElementById('c4-new')?.addEventListener('click', init);
  document.getElementById('c4-retry')?.addEventListener('click', init);
  document.getElementById('c4-diff')?.addEventListener('change', (e) => { aiDifficulty = (e.target as HTMLSelectElement).value; });

  const handleBoardTap = (clientX: number): void => {
    const rect = c.getBoundingClientRect();
    const col = Math.floor((clientX - rect.left) / CELL);
    if (col >= 0 && col < COLS) { doDrop(col); }
  };

  c.onclick = (e) => {
    handleBoardTap(e.clientX);
  };

  c.addEventListener('touchstart', (e) => {
    if (!e.touches.length) return;
    e.preventDefault();
    handleBoardTap(e.touches[0].clientX);
  }, { passive: false });

  c.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    handleBoardTap(e.clientX);
  });
}

init();
started = false;
gameOver = false;
render();
