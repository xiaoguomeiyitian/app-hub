/// <reference types="vite/client" />
import './style.css';

// ===== 数独生成器 =====
function generateSudoku(emptyCells: number): { puzzle: number[][]; solution: number[][] } {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));

  function isValid(board: number[][], row: number, col: number, num: number): boolean {
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === num || board[i][col] === num) return false;
    }
    const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) {
      if (board[r][c] === num) return false;
    }
    return true;
  }

  function solve(board: number[][]): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
          for (const n of nums) {
            if (isValid(board, r, c, n)) {
              board[r][c] = n;
              if (solve(board)) return true;
              board[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  solve(board);
  const solution = board.map(r => [...r]);

  // 移除指定数量的数字
  let removed = 0;
  while (removed < emptyCells) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (board[r][c] !== 0) { board[r][c] = 0; removed++; }
  }

  return { puzzle: board, solution };
}

const DIFFICULTIES: Record<string, number> = { easy: 30, medium: 45, hard: 55 };

// ===== 游戏状态 =====
let puzzle: number[][] = [];
let solution: number[][] = [];
let board: number[][] = [];
let fixed: boolean[][] = [];
let notes: Set<number>[][] = [];
let selected: [number, number] | null = null;
let highlightNum = 0;
let timer = 0;
let timerInterval: number | null = null;
let won = false;
let noteMode = false;
let history: { board: number[][]; notes: Set<number>[][] }[] = [];

const BEST_KEY = 'sudoku_best';
function loadBest(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}'); } catch { return {}; }
}
function saveBest(level: string, time: number): void {
  const b = loadBest();
  if (!b[level] || time < b[level]) { b[level] = time; try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch {} }
}

function initGame(difficulty: string): void {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  const empty = DIFFICULTIES[difficulty] || 45;
  const gen = generateSudoku(empty);
  puzzle = gen.puzzle;
  solution = gen.solution;
  board = puzzle.map(r => [...r]);
  fixed = puzzle.map(r => r.map(v => v !== 0));
  notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set<number>()));
  selected = null;
  highlightNum = 0;
  timer = 0;
  won = false;
  noteMode = false;
  history = [];
  timerInterval = window.setInterval(() => { if (!won) { timer++; updateTimer(); } }, 1000);
  render();
}

function saveHistory(): void {
  history.push({ board: board.map(r => [...r]), notes: notes.map(r => r.map(s => new Set(s))) });
  if (history.length > 30) history.shift();
}

function undo(): void {
  if (history.length === 0) return;
  const prev = history.pop()!;
  board = prev.board;
  notes = prev.notes;
  render();
}

function updateTimer(): void {
  const el = document.getElementById('sd-timer');
  if (el) el.textContent = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`;
}

function setNumber(num: number): void {
  if (!selected || won) return;
  const [r, c] = selected;
  if (fixed[r][c]) return;

  saveHistory();

  if (noteMode && num > 0) {
    if (notes[r][c].has(num)) notes[r][c].delete(num);
    else notes[r][c].add(num);
    board[r][c] = 0;
  } else {
    board[r][c] = num;
    notes[r][c].clear();
    // 清除相关笔记
    if (num > 0) {
      for (let i = 0; i < 9; i++) { notes[r][i].delete(num); notes[i][c].delete(num); }
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++) notes[rr][cc].delete(num);
    }
  }

  highlightNum = num || highlightNum;

  // 检查胜利
  if (checkWin()) {
    won = true;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    const level = Object.entries(DIFFICULTIES).find(([, v]) => v === Object.values(DIFFICULTIES).find(val => val === (puzzle.flat().filter(v => v === 0).length)))?.[0] || 'medium';
    saveBest(level, timer);
  }
  render();
}

function checkWin(): boolean {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (board[r][c] !== solution[r][c]) return false;
  }
  return true;
}

function getConflict(r: number, c: number): boolean {
  if (board[r][c] === 0) return false;
  const val = board[r][c];
  for (let i = 0; i < 9; i++) {
    if (i !== c && board[r][i] === val) return true;
    if (i !== r && board[i][c] === val) return true;
  }
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++) {
    if ((rr !== r || cc !== c) && board[rr][cc] === val) return true;
  }
  return false;
}

function countNumber(num: number): number {
  let count = 0;
  for (const row of board) for (const v of row) if (v === num) count++;
  return count;
}

const app = document.getElementById('app')!;

function render(): void {
  

  app.innerHTML = `<div class="sd-wrapper">
    <h1 class="sd-title">🔢 数独</h1>
    <div class="sd-controls">
      <select id="sd-diff" class="sd-select">
        <option value="easy">简单</option>
        <option value="medium" selected>中等</option>
        <option value="hard">困难</option>
      </select>
      <button class="sd-btn" id="sd-new">新游戏</button>
      <button class="sd-btn" id="sd-undo">撤销</button>
      <button class="sd-btn ${noteMode ? 'active' : ''}" id="sd-note">📝 笔记</button>
      <span id="sd-timer" class="sd-timer">${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}</span>
    </div>
    <div class="sd-board" id="sd-board">
      ${board.map((row, r) => `<div class="sd-row">${row.map((val, c) => {
        const isFixed = fixed[r][c];
        const isSelected = selected && selected[0] === r && selected[1] === c;
        const isConflict = getConflict(r, c);
        const isHighlight = val > 0 && val === highlightNum;
        const isSameBox = selected && Math.floor(r / 3) === Math.floor(selected[0] / 3) && Math.floor(c / 3) === Math.floor(selected[1] / 3);
        const isSameLine = selected && (r === selected[0] || c === selected[1]);
        const cellNotes = notes[r][c];
        const thickR = r % 3 === 0 ? 'thick-top' : '';
        const thickC = c % 3 === 0 ? 'thick-left' : '';
        const thickR2 = r === 8 ? 'thick-bottom' : '';
        const thickC2 = c === 8 ? 'thick-right' : '';

        return `<div class="sd-cell ${thickR} ${thickC} ${thickR2} ${thickC2} ${isSelected ? 'selected' : ''} ${isConflict ? 'conflict' : ''} ${isHighlight && !isSelected ? 'highlight' : ''} ${isSameBox && !isSelected && !isHighlight ? 'same-box' : ''} ${isSameLine && !isSelected && !isHighlight ? 'same-line' : ''} ${isFixed ? 'fixed' : ''}" data-r="${r}" data-c="${c}">
          ${val > 0 ? `<span class="sd-val">${val}</span>` :
            cellNotes.size > 0 ? `<div class="sd-notes">${[1,2,3,4,5,6,7,8,9].map(n => `<span class="sd-note ${cellNotes.has(n) ? '' : 'empty'}">${cellNotes.has(n) ? n : ''}</span>`).join('')}</div>` : ''}
        </div>`;
      }).join('')}</div>`).join('')}
    </div>
    <div class="sd-numpad">
      ${[1,2,3,4,5,6,7,8,9].map(n => {
        const cnt = countNumber(n);
        const done = cnt >= 9;
        return `<button class="sd-num ${done ? 'done' : ''}" data-num="${n}" ${done ? 'disabled' : ''}>${n}</button>`;
      }).join('')}
      <button class="sd-num eraser" data-num="0">⌫</button>
    </div>
    ${won ? `<div class="sd-win">🎉 完成！用时 ${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}</div>` : ''}
  </div>`;

  bindEvents();
}

function bindEvents(): void {
  document.querySelectorAll('.sd-cell').forEach(el => {
    el.addEventListener('click', () => {
      const r = parseInt((el as HTMLElement).dataset.r!, 10);
      const c = parseInt((el as HTMLElement).dataset.c!, 10);
      selected = [r, c];
      if (board[r][c] > 0) highlightNum = board[r][c];
      render();
    });
  });

  document.querySelectorAll('.sd-num[data-num]').forEach(el => {
    el.addEventListener('click', () => {
      const n = parseInt((el as HTMLElement).dataset.num!, 10);
      setNumber(n);
    });
  });

  document.getElementById('sd-new')?.addEventListener('click', () => {
    const diff = (document.getElementById('sd-diff') as HTMLSelectElement)?.value || 'medium';
    initGame(diff);
  });

  document.getElementById('sd-undo')?.addEventListener('click', undo);

  document.getElementById('sd-note')?.addEventListener('click', () => { noteMode = !noteMode; render(); });

  // 键盘
  const handler = (e: KeyboardEvent) => {
    if (e.key >= '1' && e.key <= '9') setNumber(parseInt(e.key, 10));
    if (e.key === 'Backspace' || e.key === 'Delete') setNumber(0);
    if (e.key === 'z' && e.ctrlKey) { undo(); e.preventDefault(); }
    if (selected) {
      let [r, c] = selected;
      if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
      if (e.key === 'ArrowDown') r = Math.min(8, r + 1);
      if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
      if (e.key === 'ArrowRight') c = Math.min(8, c + 1);
      if ([r, c].join(',') !== selected.join(',')) { selected = [r, c]; render(); }
    }
  };
  window.removeEventListener('keydown', handler);
  window.addEventListener('keydown', handler);
}

initGame('medium');
