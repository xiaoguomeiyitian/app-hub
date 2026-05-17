import './style.css';

const ROWS = 13, COLS = 17;
type Cell = 0 | 1 | 2 | 3 | 4 | 5; // 0=empty, 1=wall, 2=brick, 3=bomb, 4=explosion, 5=powerup
interface Bomb { r: number; c: number; timer: number; power: number; }
interface Player { r: number; c: number; bombs: number; power: number; speed: number; alive: boolean; }
interface Game { grid: Cell[][]; player: Player; enemies: Player[]; bombs: Bomb[]; level: number; lives: number; score: number; state: 'playing' | 'won' | 'lost'; }

let game: Game;
const EMPTY = 0, WALL = 1, BRICK = 2, BOMB = 3, EXPLOSION = 4, POWERUP = 5;

function init(level = 1): void {
  const grid: Cell[][] = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) return WALL;
      if (r % 2 === 0 && c % 2 === 0) return WALL;
      return Math.random() < 0.4 ? BRICK : EMPTY;
    })
  );
  // Clear spawn areas
  for (let r = 1; r <= 2; r++) for (let c = 1; c <= 2; c++) grid[r][c] = EMPTY;
  for (let r = ROWS - 3; r < ROWS - 1; r++) for (let c = COLS - 3; c < COLS - 1; c++) grid[r][c] = EMPTY;

  const enemyCount = Math.min(2 + level, 6);
  const enemies: Player[] = [];
  for (let i = 0; i < enemyCount; i++) {
    let er, ec;
    do { er = Math.floor(Math.random() * (ROWS - 4)) + 2; ec = Math.floor(Math.random() * (COLS - 4)) + 2; }
    while (grid[er][ec] !== EMPTY || (er < 4 && ec < 4));
    enemies.push({ r: er, c: ec, bombs: 0, power: 1, speed: 1, alive: true });
  }

  game = {
    grid, player: { r: 1, c: 1, bombs: 1, power: 2, speed: 1, alive: true },
    enemies, bombs: [], level, lives: 3, score: 0, state: 'playing'
  };
}

function placeBomb(): void {
  if (!game.player.alive) return;
  if (game.bombs.some(b => b.r === game.player.r && b.c === game.player.c)) return;
  if (game.bombs.length >= game.player.bombs) return;
  game.bombs.push({ r: game.player.r, c: game.player.c, timer: 150, power: game.player.power });
}

function tickBombs(): void {
  for (let i = game.bombs.length - 1; i >= 0; i--) {
    game.bombs[i].timer--;
    if (game.bombs[i].timer <= 0) { explodeBomb(i); }
  }
}

function explodeBomb(idx: number): void {
  const b = game.bombs.splice(idx, 1)[0];
  const cells: [number, number][] = [[b.r, b.c]];
  for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]] as [number,number][]) {
    for (let d = 1; d <= b.power; d++) {
      const nr = b.r + dr * d, nc = b.c + dc * d;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || game.grid[nr][nc] === WALL) break;
      cells.push([nr, nc]);
      if (game.grid[nr][nc] === BRICK) { game.grid[nr][nc] = Math.random() < 0.2 ? POWERUP : EMPTY; game.score += 10; break; }
      // Chain explosion
      const bi = game.bombs.findIndex(x => x.r === nr && x.c === nc);
      if (bi !== -1) { explodeBomb(bi); break; }
    }
  }
  for (const [r, c] of cells) {
    // Check player
    if (game.player.r === r && game.player.c === c && game.player.alive) {
      game.player.alive = false; game.lives--;
      if (game.lives <= 0) game.state = 'lost';
    }
    // Check enemies
    for (const e of game.enemies) {
      if (e.r === r && e.c === c && e.alive) { e.alive = false; game.score += 100; }
    }
    // Temp mark as explosion
    if (game.grid[r][c] !== WALL) game.grid[r][c] = EXPLOSION;
  }
  // Clear explosions after short delay (via render)
  setTimeout(() => {
    for (const [r, c] of cells) {
      if (game.grid[r][c] === EXPLOSION) game.grid[r][c] = EMPTY;
    }
    // Check win
    if (game.enemies.every(e => !e.alive)) {
      if (game.level < 5) { init(game.level + 1); game.score += 500; }
      else game.state = 'won';
    }
    // Respawn player if dead
    if (!game.player.alive && game.lives > 0) {
      game.player = { r: 1, c: 1, bombs: game.player.bombs, power: game.player.power, speed: game.player.speed, alive: true };
    }
  }, 300);
}

function movePlayer(dr: number, dc: number): void {
  if (!game.player.alive) return;
  const nr = game.player.r + dr, nc = game.player.c + dc;
  if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
  if (game.grid[nr][nc] === WALL || game.grid[nr][nc] === BRICK || game.grid[nr][nc] === BOMB) return;
  if (game.grid[nr][nc] === POWERUP) {
    game.player.power = Math.min(game.player.power + 1, 5);
    game.player.bombs = Math.min(game.player.bombs + 1, 5);
    game.grid[nr][nc] = EMPTY;
  }
  game.player.r = nr; game.player.c = nc;
}

function moveEnemies(): void {
  for (const e of game.enemies) {
    if (!e.alive) continue;
    // Simple AI: random movement
    if (Math.random() < 0.1) {
      const dirs = [[0,1],[0,-1],[1,0],[-1,0]] as [number,number][];
      const [dr, dc] = dirs[Math.floor(Math.random() * 4)];
      const nr = e.r + dr, nc = e.c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && game.grid[nr][nc] !== WALL && game.grid[nr][nc] !== BRICK && game.grid[nr][nc] !== BOMB) {
        e.r = nr; e.c = nc;
      }
    }
    // Check collision with player
    if (e.r === game.player.r && e.c === game.player.c && game.player.alive) {
      game.player.alive = false; game.lives--;
      if (game.lives <= 0) game.state = 'lost';
    }
  }
}

// ===== 渲染 =====
const app = document.getElementById('app')!;

function render(): void {
  const gridHtml = game.grid.map((row, r) => row.map((cell, c) => {
    let cls = 'bm-cell';
    let content = '';
    if (cell === WALL) { cls += ' bm-wall'; }
    else if (cell === BRICK) { cls += ' bm-brick'; }
    else if (cell === BOMB) { cls += ' bm-bomb'; content = '💣'; }
    else if (cell === EXPLOSION) { cls += ' bm-explosion'; content = '🔥'; }
    else if (cell === POWERUP) { cls += ' bm-powerup'; content = '⭐'; }
    // Player
    if (game.player.alive && game.player.r === r && game.player.c === c) { content = '😊'; cls += ' bm-player'; }
    // Enemies
    for (const e of game.enemies) {
      if (e.alive && e.r === r && e.c === c) { content = '👾'; cls += ' bm-enemy'; }
    }
    return `<div class="${cls}">${content}</div>`;
  }).join('')).join('');

  app.innerHTML = `
    <div class="bm-wrapper">
      <div class="bm-topbar">
        <span>💣 炸弹人 Lv.${game.level}</span>
        <span>❤️ ${game.lives} | 🏆 ${game.score}</span>
        <button id="bm-restart" class="bm-btn small">重开</button>
      </div>
      <div class="bm-grid" style="grid-template-columns:repeat(${COLS},1fr)">${gridHtml}</div>
      ${game.state !== 'playing' ? `<div class="bm-result">${game.state === 'won' ? '🎉 通关！' : '💀 游戏结束'} 得分: ${game.score}</div>` : ''}
      <div class="bm-hints">↑↓←→ 移动 | Space 放炸弹</div>
    </div>
  `;
  document.getElementById('bm-restart')?.addEventListener('click', () => { init(); render(); });
}

// Input
window.addEventListener('keydown', e => {
  if (game.state !== 'playing') return;
  const map: Record<string, [number,number]> = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1] };
  const dir = map[e.code];
  if (dir) { e.preventDefault(); movePlayer(dir[0], dir[1]); }
  if (e.code === 'Space') { e.preventDefault(); placeBomb(); }
  render();
});

// Game loop
function gameLoop(): void {
  if (game.state === 'playing') {
    tickBombs();
    moveEnemies();
    render();
  }
  requestAnimationFrame(gameLoop);
}

init(); render(); gameLoop();
