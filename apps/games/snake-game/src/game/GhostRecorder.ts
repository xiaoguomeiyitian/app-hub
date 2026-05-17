/** Phase 23: 幽灵蛇 + 折线图 */
import type { Point } from '../types';

const STORAGE_KEY = 'snake_score_history';
const MAX_HISTORY = 10;
const GHOST_KEY = 'snake_ghost';

interface ScoreRecord {
  score: number;
  mode: string;
  date: number;
}

/** 保存得分记录 */
export function saveScoreRecord(score: number, mode: string): void {
  try {
    const history: ScoreRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    history.unshift({ score, mode, date: Date.now() });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
}

/** 获取得分历史 */
export function getScoreHistory(): ScoreRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

/** 绘制折线图 */
export function drawScoreChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const history = getScoreHistory().reverse();
  if (history.length < 2) return;

  const maxScore = Math.max(...history.map(h => h.score), 1);

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();

  // Title
  ctx.fillStyle = '#888';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('最近得分趋势', x + 8, y + 14);

  // Chart area
  const chartX = x + 20;
  const chartY = y + 22;
  const chartW = w - 30;
  const chartH = h - 32;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 3; i++) {
    const gy = chartY + chartH - (chartH * i / 3);
    ctx.beginPath();
    ctx.moveTo(chartX, gy);
    ctx.lineTo(chartX + chartW, gy);
    ctx.stroke();
  }

  // Line
  ctx.strokeStyle = '#00d4aa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  history.forEach((rec, i) => {
    const px = chartX + (chartW * i / (history.length - 1));
    const py = chartY + chartH - (chartH * rec.score / maxScore);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Dots
  ctx.fillStyle = '#00d4aa';
  history.forEach((rec, i) => {
    const px = chartX + (chartW * i / (history.length - 1));
    const py = chartY + chartH - (chartH * rec.score / maxScore);
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Score labels
  ctx.fillStyle = '#666';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  history.forEach((rec, i) => {
    const px = chartX + (chartW * i / (history.length - 1));
    ctx.fillText(String(rec.score), px, chartY + chartH + 10);
  });
}

/** 幽灵蛇：记录蛇头位置用于重放 */
interface GhostFrame { x: number; y: number; }
let ghostData: GhostFrame[] = [];

export function recordGhostFrame(head: Point): void {
  ghostData.push({ x: head.x, y: head.y });
  if (ghostData.length > 2000) ghostData = ghostData.slice(-2000);
}

export function saveGhost(): void {
  try { localStorage.setItem(GHOST_KEY, JSON.stringify(ghostData.slice(-500))); }
  catch { /* ignore */ }
  ghostData = [];
}

export function getGhost(): GhostFrame[] {
  try { return JSON.parse(localStorage.getItem(GHOST_KEY) || '[]'); }
  catch { return []; }
}

export function drawGhost(ctx: CanvasRenderingContext2D, cellSize: number, frame: number): void {
  const ghost = getGhost();
  if (ghost.length === 0) return;
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#00d4aa';
  const idx = frame % ghost.length;
  const g = ghost[idx];
  ctx.fillRect(g.x * cellSize + 2, g.y * cellSize + 2, cellSize - 4, cellSize - 4);
  ctx.globalAlpha = 1;
}

export function clearGhost(): void {
  ghostData = [];
}
