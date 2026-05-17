/// <reference types="vite/client" />
import './style.css';

const N = 8;
const CS = 48;

interface Piece { player: 1 | 2; king: boolean; }

let board: (Piece | null)[][] = [];
let selected: [number, number] | null = null;
let turn: 1 | 2 = 1;
let gameOver = false;
let winner = 0;
let started = false;
let mustJump = false;
let jumpFrom: [number, number] | null = null;

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

function init(): void {
  board = Array.from({ length: N }, () => Array(N).fill(null));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) { board[r][c] = { player: 2, king: false }; }
        else if (r > 4) { board[r][c] = { player: 1, king: false }; }
      }
    }
  }
  selected = null;
  turn = 1;
  gameOver = false;
  winner = 0;
  started = true;
  mustJump = false;
  jumpFrom = null;
}

function canJump(r: number, c: number, p: Piece): boolean {
  const dirs: [number, number][] = p.king
    ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
    : p.player === 1 ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const mr = r + dr;
    const mc = c + dc;
    const er = r + dr * 2;
    const ec = c + dc * 2;
    if (er >= 0 && er < N && ec >= 0 && ec < N) {
      if (board[mr][mc] && board[mr][mc]!.player !== p.player && !board[er][ec]) {
        return true;
      }
    }
  }
  return false;
}

function hasJumps(player: 1 | 2): boolean {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = board[r][c];
      if (p?.player === player && canJump(r, c, p)) { return true; }
    }
  }
  return false;
}

function countPieces(player: 1 | 2): number {
  let n = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r][c]?.player === player) { n++; }
    }
  }
  return n;
}

function doMove(sr: number, sc: number, er: number, ec: number): void {
  const piece = board[sr][sc]!;
  board[er][ec] = piece;
  board[sr][sc] = null;
  const dr = er - sr;
  const dc = ec - sc;
  if (Math.abs(dr) === 2) {
    const mr = sr + dr / 2;
    const mc = sc + dc / 2;
    board[mr][mc] = null;
    sfx(600, 0.1);
  } else {
    sfx(400, 0.05);
  }
  // 王棋升变
  if (piece.player === 1 && er === 0) { piece.king = true; }
  if (piece.player === 2 && er === N - 1) { piece.king = true; }
  // 连跳检查
  if (Math.abs(dr) === 2 && canJump(er, ec, piece)) {
    jumpFrom = [er, ec];
    mustJump = true;
    selected = [er, ec];
    render();
    return;
  }
  jumpFrom = null;
  mustJump = false;
  selected = null;
  // 胜负检测
  if (countPieces(1) === 0) { gameOver = true; winner = 2; sfx(200, 0.3, 'sawtooth'); }
  else if (countPieces(2) === 0) { gameOver = true; winner = 1; sfx(880, 0.3, 'sine'); }
  else {
    turn = turn === 1 ? 2 : 1;
    if (turn === 2) { setTimeout(aiMove, 400); }
  }
  render();
}

function aiMove(): void {
  if (gameOver || turn !== 2) { return; }
  // 尝试跳吃
  const jumps: [number, number, number, number][] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = board[r][c];
      if (p?.player === 2) {
        const dirs: [number, number][] = p.king
          ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
          : [[1, 1], [1, -1]];
        for (const [dr, dc] of dirs) {
          const mr = r + dr;
          const mc = c + dc;
          const er = r + dr * 2;
          const ec = c + dc * 2;
          if (er >= 0 && er < N && ec >= 0 && ec < N) {
            if (board[mr][mc]?.player === 1 && !board[er][ec]) {
              jumps.push([r, c, er, ec]);
            }
          }
        }
      }
    }
  }
  if (jumps.length) {
    const j = jumps[Math.floor(Math.random() * jumps.length)];
    doMove(j[0], j[1], j[2], j[3]);
    return;
  }
  // 尝试普通移动
  const moves: [number, number, number, number][] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = board[r][c];
      if (p?.player === 2) {
        const dirs: [number, number][] = p.king
          ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
          : [[1, 1], [1, -1]];
        for (const [dr, dc] of dirs) {
          const er = r + dr;
          const ec = c + dc;
          if (er >= 0 && er < N && ec >= 0 && ec < N && !board[er][ec]) {
            moves.push([r, c, er, ec]);
          }
        }
      }
    }
  }
  if (moves.length) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    doMove(m[0], m[1], m[2], m[3]);
  }
}

const app = document.getElementById('app')!;

function render(): void {
  const sz = N * CS;

  app.innerHTML = `<div class="ck-wrapper">
    <h1 class="ck-title">♟️ 跳棋</h1>
    <div class="ck-status">
    <div class="ck-hint">点击或触摸棋盘即可移动，支持小屏手机操作</div>${gameOver ? (winner === 1 ? '🎉 你赢了！' : '😢 AI 赢了') : (turn === 1 ? '你的回合 (红)' : 'AI 思考中...')}</div>
    <div class="ck-info"><span>红:${countPieces(1)}</span><span>黑:${countPieces(2)}</span></div>
    <div class="ck-canvas-wrap">
      <canvas id="ck-canvas" width="${sz}" height="${sz}"></canvas>
      ${!started ? '<div class="ck-overlay"><div><h2>♟️ 跳棋</h2><p>点击选择棋子，点击目标移动</p><p>可跳吃对方棋子</p><button class="ck-btn primary" id="ck-go">开始</button></div></div>' : ''}
      ${gameOver ? '<div class="ck-overlay"><div><h2>' + (winner === 1 ? '🎉 你赢了！' : '😢 AI 赢了') + '</h2><button class="ck-btn primary" id="ck-retry">再来</button></div></div>' : ''}
    </div>
  </div>`;

  const c = document.getElementById('ck-canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;

  // 绘制棋盘
  for (let r = 0; r < N; r++) {
    for (let cc = 0; cc < N; cc++) {
      ctx.fillStyle = (r + cc) % 2 === 0 ? '#deb887' : '#8b4513';
      ctx.fillRect(cc * CS, r * CS, CS, CS);
      const piece = board[r][cc];
      if (piece) {
        const x = cc * CS + CS / 2;
        const y = r * CS + CS / 2;
        ctx.beginPath();
        ctx.arc(x, y, CS / 2 - 5, 0, Math.PI * 2);
        ctx.fillStyle = piece.player === 1 ? '#e74c3c' : '#2c3e50';
        ctx.fill();
        if (piece.king) {
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('K', x, y);
        }
        if (selected && selected[0] === r && selected[1] === cc) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    }
  }

  // 高亮可移动位置
  if (selected && turn === 1 && !gameOver) {
    const [sr, sc] = selected;
    const piece = board[sr][sc];
    if (piece) {
      const dirs: [number, number][] = piece.king
        ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
        : piece.player === 1 ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]];
      for (const [dr, dc] of dirs) {
        if (mustJump) {
          const mr = sr + dr;
          const mc = sc + dc;
          const er = sr + dr * 2;
          const ec = sc + dc * 2;
          if (er >= 0 && er < N && ec >= 0 && ec < N) {
            if (board[mr][mc]?.player !== piece.player && !board[er][ec]) {
              ctx.fillStyle = 'rgba(0,255,0,.3)';
              ctx.fillRect(ec * CS, er * CS, CS, CS);
            }
          }
        } else {
          const er = sr + dr;
          const ec = sc + dc;
          if (er >= 0 && er < N && ec >= 0 && ec < N && !board[er][ec]) {
            ctx.fillStyle = 'rgba(0,255,0,.3)';
            ctx.fillRect(ec * CS, er * CS, CS, CS);
          }
        }
      }
    }
  }

  document.getElementById('ck-go')?.addEventListener('click', init);
  document.getElementById('ck-retry')?.addEventListener('click', init);

  const handleBoardTap = (clientX: number, clientY: number): void => {
    if (gameOver || turn !== 1) { return; }
    const rect = c.getBoundingClientRect();
    const cc = Math.floor((clientX - rect.left) / CS);
    const r = Math.floor((clientY - rect.top) / CS);
    if (r < 0 || r >= N || cc < 0 || cc >= N) { return; }

    if (mustJump && jumpFrom) {
      const [sr, sc] = jumpFrom;
      const dr = r - sr;
      const dc = cc - sc;
      if (Math.abs(dr) === 2 && Math.abs(dc) === 2) {
        doMove(sr, sc, r, cc);
        return;
      }
      return;
    }

    if (board[r][cc]?.player === 1) {
      selected = [r, cc];
      render();
      return;
    }

    if (selected) {
      const [sr, sc] = selected;
      const dr = r - sr;
      const dc = cc - sc;
      const piece = board[sr][sc];
      if (piece) {
        const isJump = Math.abs(dr) === 2 && Math.abs(dc) === 2;
        const isMove = Math.abs(dr) === 1 && Math.abs(dc) === 1;
        const correctDir = piece.king || piece.player === 1 ? dr < 0 : dr > 0;
        if (isJump && correctDir) { doMove(sr, sc, r, cc); return; }
        if (isMove && correctDir && !mustJump && !board[r][cc]) { doMove(sr, sc, r, cc); return; }
      }
    }
  };

  c.onclick = (e) => { handleBoardTap(e.clientX, e.clientY); };
  c.addEventListener('touchstart', (e) => {
    if (!e.touches.length) return;
    e.preventDefault();
    handleBoardTap(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  c.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    handleBoardTap(e.clientX, e.clientY);
  });
}

init();
started = false;
gameOver = false;
render();
