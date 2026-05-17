import './style.css';

const SIZE = 10;
type Cell = 0|1|2|3|4|5; // 0=empty, 1=ship, 2=miss, 3=hit, 4=sunk, 5=target
interface Ship { name: string; size: number; cells: [number,number][]; hits: number; sunk: boolean; }
interface Board { grid: Cell[][]; ships: Ship[]; }
interface Game { player: Board; enemy: Board; phase: 'setup'|'playing'|'won'|'lost'; turn: 'player'|'enemy'; setupShip: number; message: string; }

const SHIP_DEFS = [
  { name: '航母', size: 5 }, { name: '战列舰', size: 4 },
  { name: '巡洋舰', size: 3 }, { name: '潜艇', size: 3 }, { name: '驱逐舰', size: 2 }
];

let game: Game;
let setupHorizontal = true;
let mode: 'ai'|'online' = 'ai';
let connState = '离线';
let matchState = '';
let resultState = ''; 

function emptyGrid(): Cell[][] { return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); }

function canPlace(board: Board, r: number, c: number, size: number, horiz: boolean): boolean {
  for (let i = 0; i < size; i++) {
    const nr = horiz ? r : r + i, nc = horiz ? c + i : c;
    if (nr >= SIZE || nc >= SIZE || board.grid[nr][nc] !== 0) return false;
  }
  return true;
}

function placeShip(board: Board, r: number, c: number, def: typeof SHIP_DEFS[0], horiz: boolean): boolean {
  if (!canPlace(board, r, c, def.size, horiz)) return false;
  const cells: [number,number][] = [];
  for (let i = 0; i < def.size; i++) {
    const nr = horiz ? r : r + i, nc = horiz ? c + i : c;
    board.grid[nr][nc] = 1;
    cells.push([nr, nc]);
  }
  board.ships.push({ ...def, cells, hits: 0, sunk: false });
  return true;
}

function placeEnemyShips(): void {
  for (const def of SHIP_DEFS) {
    let placed = false;
    while (!placed) {
      const r = Math.floor(Math.random() * SIZE), c = Math.floor(Math.random() * SIZE);
      const h = Math.random() > 0.5;
      placed = placeShip(game.enemy, r, c, def, h);
    }
  }
}

function fire(board: Board, r: number, c: number): 'miss'|'hit'|'sunk' {
  if (board.grid[r][c] === 2 || board.grid[r][c] === 3 || board.grid[r][c] === 4) return 'miss';
  if (board.grid[r][c] === 1) {
    board.grid[r][c] = 3;
    for (const ship of board.ships) {
      if (ship.cells.some(([sr, sc]) => sr === r && sc === c)) {
        ship.hits++;
        if (ship.hits >= ship.size) {
          ship.sunk = true;
          for (const [sr, sc] of ship.cells) board.grid[sr][sc] = 4;
          return 'sunk';
        }
        return 'hit';
      }
    }
    return 'hit';
  }
  board.grid[r][c] = 2;
  return 'miss';
}

function checkWin(board: Board): boolean { return board.ships.every(s => s.sunk); }

function aiFire(): void {
  let r: number, c: number;
  // Simple AI: random + adjacent to hits
  const hits: [number,number][] = [];
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
    if (game.player.grid[i][j] === 3) hits.push([i, j]);
  }
  if (hits.length > 0 && Math.random() > 0.3) {
    const [hr, hc] = hits[Math.floor(Math.random() * hits.length)];
    const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
    const dir = dirs[Math.floor(Math.random() * 4)];
    r = hr + dir[0]; c = hc + dir[1];
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || game.player.grid[r][c] >= 2) {
      r = Math.floor(Math.random() * SIZE); c = Math.floor(Math.random() * SIZE);
    }
  } else {
    do { r = Math.floor(Math.random() * SIZE); c = Math.floor(Math.random() * SIZE); }
    while (game.player.grid[r][c] >= 2);
  }
  const result = fire(game.player, r, c);
  if (result === 'sunk') game.message = `敌方击沉了你的${game.player.ships.find(s=>s.sunk && s.cells.some(([sr,sc])=>sr===r&&sc===c))?.name}！`;
  if (checkWin(game.player)) game.phase = 'lost';
}

// ===== 渲染 =====
const app = document.getElementById('app')!;

function render(): void {
  const pGrid = game.player.grid.map((row, r) => row.map((cell, c) => {
    let cls = 'bs-cell';
    if (cell === 1) cls += ' bs-ship';
    if (cell === 2) cls += ' bs-miss';
    if (cell === 3) cls += ' bs-hit';
    if (cell === 4) cls += ' bs-sunk';
    if (game.phase === 'setup' && game.setupShip < SHIP_DEFS.length) {
      // Show ghost ship on hover handled by CSS
    }
    return `<div class="${cls}" data-r="${r}" data-c="${c}" data-board="player">${cell === 2 ? '•' : cell === 3 ? '💥' : cell === 4 ? '🔥' : cell === 1 ? '🚢' : ''}</div>`;
  }).join('')).join('');

  const eGrid = game.enemy.grid.map((row, r) => row.map((cell, c) => {
    let cls = 'bs-cell bs-target';
    if (cell === 2) cls += ' bs-miss';
    if (cell === 3) cls += ' bs-hit';
    if (cell === 4) cls += ' bs-sunk';
    const content = cell === 2 ? '•' : cell === 3 ? '💥' : cell === 4 ? '🔥' : '';
    return `<div class="${cls}" data-r="${r}" data-c="${c}" data-board="enemy">${content}</div>`;
  }).join('')).join('');

  app.innerHTML = `
    <div class="bs-wrapper">
      <div class="bs-topbar">
        <span>♟️ 海战棋</span>
        <span>${game.message}</span>
        <button id="bs-restart" class="bs-btn small">重开</button>
      </div>
      <div class="bs-modebar">
        <button id="bs-mode-ai" class="bs-btn small ${mode==='ai' ? 'primary' : ''}">单机</button>
        <button id="bs-mode-online" class="bs-btn small ${mode==='online' ? 'primary' : ''}">联机入口</button>
        <span class="bs-conn">${connState}</span><span class="bs-match">${matchState}</span>
      </div>
      <div class="bs-modebar">
        <button id="bs-mode-ai" class="bs-btn small ${mode==='ai' ? 'primary' : ''}">单机</button>
        <button id="bs-mode-online" class="bs-btn small ${mode==='online' ? 'primary' : ''}">联机入口</button>
        <span class="bs-conn">${connState}</span><span class="bs-match">${matchState}</span>
      </div>
      ${game.phase === 'setup' ? `<div class="bs-setup">
        <p>布阵：${SHIP_DEFS[game.setupShip]?.name || '完成'} (${SHIP_DEFS[game.setupShip]?.size || 0}格)
          <button class="bs-btn small" id="bs-rotate">${setupHorizontal ? '→ 横' : '↓ 竖'}</button>
        </p>
        <p style="font-size:0.7rem;color:#aaa">点击棋盘放置</p>
      </div>` : ''}
      <div class="bs-boards">
        <div class="bs-board">
          <div class="bs-label">你的舰队 ${game.player.ships.filter(s=>s.sunk).length}/${game.player.ships.length} 被击沉</div>
          <div class="bs-grid" style="grid-template-columns:repeat(${SIZE},1fr)">${pGrid}</div>
        </div>
        <div class="bs-board">
          <div class="bs-label">敌方海域 ${game.enemy.ships.filter(s=>s.sunk).length}/${game.enemy.ships.length} 已击沉</div>
          <div class="bs-grid" style="grid-template-columns:repeat(${SIZE},1fr)">${eGrid}</div>
        </div>
      </div>
      ${game.phase !== 'setup' && game.phase !== 'playing' ? `<div class="bs-result">${game.phase === 'won' ? '🎉 胜利！' : '💀 失败！'}</div>` : ''}
      <div class="bs-result">${resultState}</div>
    </div>
  `;
  bindEvents();
}

function bindEvents(): void {
  document.querySelectorAll('[data-board="player"]').forEach(el => {
    el.addEventListener('click', () => {
      if (game.phase !== 'setup' || game.setupShip >= SHIP_DEFS.length) return;
      const r = parseInt((el as HTMLElement).dataset.r!);
      const c = parseInt((el as HTMLElement).dataset.c!);
      if (placeShip(game.player, r, c, SHIP_DEFS[game.setupShip], setupHorizontal)) {
        game.setupShip++;
        if (game.setupShip >= SHIP_DEFS.length) {
          game.phase = 'playing'; game.message = '战斗开始！攻击敌方海域';
        }
      }
      render();
    });
  });

  document.querySelectorAll('[data-board="enemy"]').forEach(el => {
    el.addEventListener('click', () => {
      if (game.phase !== 'playing' || game.turn !== 'player') return;
      const r = parseInt((el as HTMLElement).dataset.r!);
      const c = parseInt((el as HTMLElement).dataset.c!);
      if (game.enemy.grid[r][c] >= 2) return;
      const result = fire(game.enemy, r, c);
      game.message = result === 'sunk' ? '🎉 击沉！' : result === 'hit' ? '💥 命中！' : '• 未命中';
      if (checkWin(game.enemy)) { game.phase = 'won'; render(); return; }
      game.turn = 'enemy';
      render();
      setTimeout(() => { aiFire(); game.turn = 'player'; render(); }, 600);
    });
  });

  document.getElementById('bs-rotate')?.addEventListener('click', () => { setupHorizontal = !setupHorizontal; render(); });
  document.getElementById('bs-restart')?.addEventListener('click', () => { initGame(); render(); });
  document.getElementById('bs-mode-ai')?.addEventListener('click', () => { mode = 'ai'; connState = '离线'; matchState = ''; resultState = ''; render(); });
  document.getElementById('bs-mode-online')?.addEventListener('click', () => { mode = 'online'; connState = '🟡 准备联机'; matchState = '匹配 / 好友房入口待接入'; resultState = '联机样板入口已预留'; render(); });
  document.getElementById('bs-mode-ai')?.addEventListener('click', () => { mode = "ai"; connState = "离线"; matchState = ""; render(); });
  document.getElementById('bs-mode-online')?.addEventListener('click', () => { mode = "online"; connState = "🟡 准备联机"; matchState = "匹配 / 好友房入口待接入"; game.message = "联机样板入口已预留"; render(); });
}

function initGame(): void {
  game = {
    player: { grid: emptyGrid(), ships: [] }, enemy: { grid: emptyGrid(), ships: [] },
    phase: 'setup', turn: 'player', setupShip: 0, message: '放置你的舰队'
  };
  mode = 'ai'; connState = '离线'; matchState = ''; resultState = ''; 
  setupHorizontal = true;
  placeEnemyShips();
}

initGame(); render();
