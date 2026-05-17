import './style.css';

const W = 28, H = 31, CELL = 14;
type Grid = number[][];
// 0=empty,1=wall,2=dot,3=power,4=ghost-house
const MAZE_TEMPLATE: Grid = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,3,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,3,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
  [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1],
  [0,0,0,0,0,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,1,1,1,0,0,1,1,1,0,1,1,2,1,0,0,0,0,0],
  [1,1,1,1,1,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,1,2,1,1,1,1,1,1],
  [0,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,1,0,0,0,2,0,0,0,0,0,0],
  [1,1,1,1,1,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,1,2,1,1,1,1,1,1],
  [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
  [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,3,2,2,1,1,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,1,1,2,2,3,1],
  [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
  [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
  [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
  [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

interface Ghost { x: number; y: number; dx: number; dy: number; color: string; scared: boolean; }

let grid: Grid = [];
let px = 14, py = 23, pd = 0, nextPd = 0;
let score = 0, lives = 3, level = 1;
let highScore = 0;
let ghosts: Ghost[] = [];
let dotsLeft = 0;
let scaredTimer = 0;
let gameOver = false;
let gameWon = false;
let paused = false;

const HIGH_SCORE_KEY = 'pacman_highscore';
try { highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10) || 0; } catch {}

function saveHighScore(): void {
  if (score > highScore) {
    highScore = score;
    try { localStorage.setItem(HIGH_SCORE_KEY, String(highScore)); } catch {}
  }
}

function initLevel(): void {
  grid = MAZE_TEMPLATE.map(r => [...r]);
  px = 14; py = 23; pd = 0; nextPd = 0;
  ghosts = [
    { x: 13, y: 14, dx: 1, dy: 0, color: '#ff0000', scared: false },
    { x: 14, y: 14, dx: -1, dy: 0, color: '#ffb8ff', scared: false },
    { x: 13, y: 15, dx: 0, dy: 1, color: '#00ffff', scared: false },
    { x: 14, y: 15, dx: 0, dy: -1, color: '#ffb852', scared: false },
  ];
  scaredTimer = 0;
  dotsLeft = 0;
  for (const row of grid) for (const v of row) if (v === 2 || v === 3) dotsLeft++;
}

function initGame(): void {
  score = 0; lives = 3; level = 1;
  gameOver = false; gameWon = false; paused = false;
  initLevel();
}

function canMove(x: number, y: number): boolean {
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  return grid[y][x] !== 1;
}

/** 幽灵 AI：追踪 pacman */
function moveGhost(g: Ghost): void {
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const validDirs = dirs.filter(([dx, dy]) => canMove(g.x + dx, g.y + dy));

  if (validDirs.length === 0) return;

  if (g.scared) {
    // 害怕时远离 pacman
    let best = validDirs[0], bestDist = -1;
    for (const [dx, dy] of validDirs) {
      const dist = Math.abs(g.x + dx - px) + Math.abs(g.y + dy - py);
      if (dist > bestDist) { bestDist = dist; best = [dx, dy]; }
    }
    g.dx = best[0]; g.dy = best[1];
  } else {
    // 正常时追踪 pacman，加随机性
    if (Math.random() < 0.6) {
      let best = validDirs[0], bestDist = Infinity;
      for (const [dx, dy] of validDirs) {
        // 不能掉头（除非死路）
        if (dx === -g.dx && dy === -g.dy && validDirs.length > 1) continue;
        const dist = Math.abs(g.x + dx - px) + Math.abs(g.y + dy - py);
        if (dist < bestDist) { bestDist = dist; best = [dx, dy]; }
      }
      g.dx = best[0]; g.dy = best[1];
    } else {
      const d = validDirs[Math.floor(Math.random() * validDirs.length)];
      g.dx = d[0]; g.dy = d[1];
    }
  }

  const nx = g.x + g.dx, ny = g.y + g.dy;
  if (canMove(nx, ny)) { g.x = nx; g.y = ny; }
}

function move(): void {
  if (gameOver || gameWon || paused) return;

  // 尝试转向
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const [ndx, ndy] = dirs[nextPd];
  if (canMove(px + ndx, py + ndy)) pd = nextPd;

  const [dx, dy] = dirs[pd];
  const nx = px + dx, ny = py + dy;
  if (canMove(nx, ny)) { px = nx; py = ny; }

  // 吃豆
  if (grid[py][px] === 2) { grid[py][px] = 0; score += 10; dotsLeft--; }
  if (grid[py][px] === 3) {
    grid[py][px] = 0; score += 50; dotsLeft--;
    scaredTimer = 150; // ~22.5 秒
    for (const g of ghosts) g.scared = true;
  }

  // 能量豆倒计时
  if (scaredTimer > 0) {
    scaredTimer--;
    if (scaredTimer === 0) for (const g of ghosts) g.scared = false;
  }

  // 移动幽灵
  for (const g of ghosts) moveGhost(g);

  // 碰撞检测
  for (const g of ghosts) {
    if (g.x === px && g.y === py) {
      if (g.scared) {
        // 吃掉幽灵
        score += 200;
        g.x = 13 + Math.floor(Math.random() * 2);
        g.y = 14 + Math.floor(Math.random() * 2);
        g.scared = false;
      } else {
        lives--;
        if (lives <= 0) {
          gameOver = true;
          saveHighScore();
        } else {
          // 重置位置
          px = 14; py = 23; pd = 0; nextPd = 0;
        }
        return;
      }
    }
  }

  // 过关
  if (dotsLeft <= 0) {
    level++;
    score += 500;
    initLevel();
  }
}

const app = document.getElementById('app')!;

function render(): void {
  const cw = W * CELL, ch = H * CELL;
  app.innerHTML = `<div class="pc-wrapper">
    <div class="pc-header">
      <span class="pc-title">🟡 吃豆人</span>
      <div class="pc-info">
        <span>得分: ${score}</span>
        <span>❤️ × ${lives}</span>
        <span>关卡 ${level}</span>
      </div>
      <div class="pc-header-btns">
        <button id="pc-pause" class="pc-btn">${paused ? '继续' : '暂停'}</button>
        <button id="pc-restart" class="pc-btn">重开</button>
      </div>
    </div>
    <div class="pc-hiscore">最高分: ${highScore}</div>
    <div class="pc-canvas-wrap">
      <canvas id="pc-canvas" width="${cw}" height="${ch}"></canvas>
      ${gameOver ? '<div class="pc-overlay"><div class="pc-overlay-card"><h2>💀 游戏结束</h2><p>得分: ' + score + '</p><p>关卡: ' + level + '</p><button class="pc-btn primary" id="pc-retry">再来一局</button></div></div>' : ''}
      ${gameWon ? '<div class="pc-overlay"><div class="pc-overlay-card"><h2>🎉 通关！</h2><p>得分: ' + score + '</p><button class="pc-btn primary" id="pc-retry">再来一局</button></div></div>' : ''}
      ${paused && !gameOver && !gameWon ? '<div class="pc-overlay"><div class="pc-overlay-card"><h2>⏸ 已暂停</h2><button class="pc-btn primary" id="pc-resume">继续</button></div></div>' : ''}
    </div>
    <div class="pc-hints">↑↓←→ 移动 | P 暂停</div>
    <div class="pc-touch">
      <div class="touch-row"><button class="touch-btn" data-dir="3">▲</button></div>
      <div class="touch-row">
        <button class="touch-btn" data-dir="2">◀</button>
        <button class="touch-btn" data-dir="1">▼</button>
        <button class="touch-btn" data-dir="0">▶</button>
      </div>
    </div>
  </div>`;

  const c = document.getElementById('pc-canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cw, ch);

  // 绘制迷宫
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = grid[y][x];
      if (v === 1) {
        ctx.fillStyle = '#2121de';
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      } else if (v === 2) {
        ctx.fillStyle = '#ffb897';
        ctx.beginPath();
        ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (v === 3) {
        ctx.fillStyle = '#ffb897';
        ctx.beginPath();
        ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Pacman
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(px * CELL + CELL / 2, py * CELL + CELL / 2, CELL / 2 - 1, 0, Math.PI * 2);
  ctx.fill();

  // 嘴巴
  const mouthAngle = (Date.now() / 100) % (Math.PI / 2);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  const cx = px * CELL + CELL / 2, cy = py * CELL + CELL / 2;
  const startA = [0, Math.PI / 2, Math.PI, -Math.PI / 2][pd];
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, CELL / 2 - 1, startA + mouthAngle / 2, startA - mouthAngle / 2 + Math.PI * 2);
  ctx.fill();

  // 幽灵
  for (const g of ghosts) {
    const gx = g.x * CELL + CELL / 2, gy = g.y * CELL + CELL / 2;
    ctx.fillStyle = g.scared ? (scaredTimer < 30 && scaredTimer % 6 < 3 ? '#fff' : '#2121de') : g.color;
    ctx.beginPath();
    ctx.arc(gx, gy - 2, CELL / 2 - 1, Math.PI, 0);
    ctx.lineTo(gx + CELL / 2 - 1, gy + CELL / 2 - 1);
    // 锯齿底部
    for (let i = 3; i >= 0; i--) {
      const bx = gx - CELL / 2 + 1 + (i * (CELL - 2)) / 3;
      ctx.lineTo(bx, gy + (i % 2 === 0 ? CELL / 2 - 1 : CELL / 2 - 4));
    }
    ctx.closePath();
    ctx.fill();

    // 眼睛
    if (!g.scared) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(gx - 3, gy - 3, 2.5, 0, Math.PI * 2);
      ctx.arc(gx + 3, gy - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#00f';
      ctx.beginPath();
      ctx.arc(gx - 3 + g.dx, gy - 3 + g.dy, 1.5, 0, Math.PI * 2);
      ctx.arc(gx + 3 + g.dx, gy - 3 + g.dy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 事件绑定
  document.getElementById('pc-restart')?.addEventListener('click', () => { initGame(); render(); });
  document.getElementById('pc-retry')?.addEventListener('click', () => { initGame(); render(); });
  document.getElementById('pc-pause')?.addEventListener('click', () => { paused = !paused; render(); });
  document.getElementById('pc-resume')?.addEventListener('click', () => { paused = false; render(); });

  // 触控
  document.querySelectorAll('.touch-btn[data-dir]').forEach(el => {
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      nextPd = parseInt((el as HTMLElement).dataset.dir!, 10);
    }, { passive: false });
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      nextPd = parseInt((el as HTMLElement).dataset.dir!, 10);
    });
  });
}

window.addEventListener('keydown', e => {
  const map: Record<string, number> = { ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3 };
  if (map[e.code] !== undefined) { e.preventDefault(); nextPd = map[e.code]; }
  if (e.key === 'p' || e.key === 'P') { paused = !paused; }
});

initGame();
setInterval(() => { move(); render(); }, 120);
render();
