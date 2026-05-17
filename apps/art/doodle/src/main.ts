import './style.css';
import '@app-hub/utils/theme/variables.css';
import { LayerStack } from '@app-hub/utils/layers';
import { exportCanvas, exportPDF, exportSVG } from '@app-hub/utils/export';

type Tool = 'pen' | 'eraser';
let tool: Tool = 'pen';
let color = '#222222';
let size = 3;
let drawing = false;
let points: { x: number; y: number }[] = [];

const W = Math.min(800, window.innerWidth - 32);
const H = Math.min(560, Math.floor(W * 0.7));

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  size: number;
  eraser: boolean;
}

// LayerStack setup
const layers = new LayerStack();
const BASE_ID = layers.add({ type: 'base' }, '背景');
const DRAW_ID = layers.add({ type: 'drawing', strokes: [] as Stroke[] }, '绘图层');
const PREV_ID = layers.add({ type: 'preview', points: [] as { x: number; y: number }[], color: '#222', size: 3, eraser: false }, '预览层');

function getLayerData<T>(id: string): T {
  const layer = layers.get(id)!;
  return layer.data as T;
}
function updateLayerData(id: string, data: any): void {
  const layer = layers.get(id)!;
  layer.data = data;
}

function render() {
  const app = document.getElementById('app')!;
  const drawLayer = getLayerData<Stroke[]>(DRAW_ID);
  const previewLayer = getLayerData<any>(PREV_ID);

  app.innerHTML = `
    <h1>✏️ 简笔画工具（图层版）</h1>
    <div class="toolbar">
      <button class="tool-btn ${tool==='pen'?'active':''}" data-tool="pen">🖊️ 笔</button>
      <button class="tool-btn ${tool==='eraser'?'active':''}" data-tool="eraser">🧹 橡皮擦</button>
      <input type="color" class="color-pick" value="${color}" title="颜色"/>
      <label>粗细 <input type="range" class="size-slider" min="1" max="20" value="${size}"/> ${size}px</label>
      <button class="tool-btn" id="undo">↩️ 撤销</button>
      <button class="tool-btn" id="clear">🗑️ 清空</button>
      <button class="tool-btn" id="export-png">💾 PNG</button>
      <button class="tool-btn" id="export-svg">🖼️ SVG</button>
      <button class="tool-btn" id="export-pdf">📄 PDF</button>
    </div>
    <div class="layers-panel">
      <h4>图层</h4>
      <div class="layer-entry" data-id="${DRAW_ID}">
        <label><input type="checkbox" checked data-action="visible"/> 绘图层</label>
        <span class="layer-status" data-lock="false">🔓</span>
      </div>
      <div class="layer-entry" data-id="${PREV_ID}">
        <label><input type="checkbox" checked data-action="visible"/> 预览层</label>
        <span class="layer-status" data-lock="true">🔒</span>
      </div>
    </div>
    <canvas id="cv" width="${W}" height="${H}"></canvas>
  `;

  // Tool selection
  document.querySelectorAll('[data-tool]').forEach(el => {
    el.addEventListener('click', () => { tool = (el as HTMLElement).dataset.tool as Tool; render(); });
  });
  // Color & size
  const cpick = document.querySelector('.color-pick') as HTMLInputElement;
  cpick.addEventListener('input', e => { color = (e.target as HTMLInputElement).value; });
  const sslider = document.querySelector('.size-slider') as HTMLInputElement;
  sslider.addEventListener('input', e => { size = +(e.target as HTMLInputElement).value; render(); });

  // Actions
  document.getElementById('undo')!.addEventListener('click', () => {
    const strokes = getLayerData<Stroke[]>(DRAW_ID);
    strokes.pop();
    updateLayerData(DRAW_ID, strokes);
    redraw();
  });
  document.getElementById('clear')!.addEventListener('click', () => {
    updateLayerData(DRAW_ID, []);
    redraw();
  });
  document.getElementById('export-png')!.addEventListener('click', async () => {
    const cv = document.getElementById('cv') as HTMLCanvasElement;
    await exportCanvas(cv, 'png');
  });
  document.getElementById('export-pdf')!.addEventListener('click', async () => {
    const cv = document.getElementById('cv') as HTMLCanvasElement;
    await exportPDF(cv);
  });
  document.getElementById('export-svg')!.addEventListener('click', async () => {
    const strokes = getLayerData<Stroke[]>(DRAW_ID);
    const svg = buildSVG(strokes);
    await exportSVG(svg, 'doodle.svg');
  });

  // Layer visibility toggles
  document.querySelectorAll('.layer-entry input[data-action="visible"]').forEach(el => {
    el.addEventListener('change', () => {
      const lid = (el.closest('.layer-entry') as HTMLElement).dataset.id!;
      layers.setVisibility(lid, (el as HTMLInputElement).checked);
      redraw();
    });
  });
  // Layer lock toggles
  document.querySelectorAll('.layer-status').forEach(el => {
    el.addEventListener('click', () => {
      const lid = (el.closest('.layer-entry') as HTMLElement).dataset.id!;
      const layer = layers.get(lid)!;
      const newLock = !layer.locked;
      layers.setLock(lid, newLock);
      (el as HTMLElement).dataset.lock = String(newLock);
      (el as HTMLElement).textContent = newLock ? '🔒' : '🔓';
      redraw();
    });
  });

  // Canvas drawing events
  const cv = document.getElementById('cv') as HTMLCanvasElement;
  cv.addEventListener('pointerdown', e => {
    // Check if draw layer is locked
    const drawLayer = layers.get(DRAW_ID)!;
    if (drawLayer.locked) return;
    drawing = true;
    points = [{ x: e.offsetX, y: e.offsetY }];
    updateLayerData(PREV_ID, { points: [...points], color, size, eraser: tool === 'eraser' });
  });
  cv.addEventListener('pointermove', e => {
    if (!drawing) return;
    points.push({ x: e.offsetX, y: e.offsetY });
    updateLayerData(PREV_ID, { points: [...points], color, size, eraser: tool === 'eraser' });
    redraw();
  });
  const finishStroke = () => {
    if (!drawing) return;
    const preview = getLayerData<any>(PREV_ID);
    if (preview.points.length > 1) {
      const strokes = getLayerData<Stroke[]>(DRAW_ID);
      strokes.push({ points: [...preview.points], color: preview.color, size: preview.size, eraser: preview.eraser });
      updateLayerData(DRAW_ID, strokes);
    }
    drawing = false;
    points = [];
    updateLayerData(PREV_ID, { points: [], color, size, eraser: false });
    redraw();
  };
  cv.addEventListener('pointerup', finishStroke);
  cv.addEventListener('pointerleave', finishStroke);
}

function redraw() {
  const cv = document.getElementById('cv') as HTMLCanvasElement;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  // Canvas background is handled by CSS (var(--bg-primary))
  // Iterate layers in order (base/draw/preview)
  for (const layer of layers.getAll()) {
    if (!layer.visible) continue;
    if (layer.id === BASE_ID) continue; // skip base (transparent)
    if (layer.id === DRAW_ID) {
      const strokes = layer.data as Stroke[];
      for (const s of strokes) drawStroke(ctx, s);
    } else if (layer.id === PREV_ID) {
      const preview = layer.data as any;
      if (preview.points && preview.points.length >= 2) {
        drawStroke(ctx, { points: preview.points, color: preview.color, size: preview.size, eraser: preview.eraser });
      }
    }
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.points.length < 2) return;
  ctx.strokeStyle = s.eraser ? '#ffffff' : s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(s.points[0].x, s.points[0].y);
  if (s.points.length === 2) {
    ctx.lineTo(s.points[1].x, s.points[1].y);
  } else {
    for (let i = 1; i < s.points.length - 1; i++) {
      const mx = (s.points[i].x + s.points[i + 1].x) / 2;
      const my = (s.points[i].y + s.points[i + 1].y) / 2;
      ctx.quadraticCurveTo(s.points[i].x, s.points[i].y, mx, my);
    }
    const last = s.points[s.points.length - 1];
    ctx.lineTo(last.x, last.y);
  }
  ctx.stroke();
}

function buildSVG(strokes: Stroke[]): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.background = '#ffffff';
  for (const s of strokes) {
    if (s.eraser) continue; // skip eraser
    const path = document.createElementNS(ns, 'path');
    let d = '';
    if (s.points.length > 0) {
      d += `M ${s.points[0].x} ${s.points[0].y}`;
      if (s.points.length === 2) {
        d += ` L ${s.points[1].x} ${s.points[1].y}`;
      } else {
        for (let i = 1; i < s.points.length - 1; i++) {
          const mx = (s.points[i].x + s.points[i+1].x) / 2;
          const my = (s.points[i].y + s.points[i+1].y) / 2;
          d += ` Q ${s.points[i].x} ${s.points[i].y} ${mx} ${my}`;
        }
        const last = s.points[s.points.length - 1];
        d += ` L ${last.x} ${last.y}`;
      }
    }
    path.setAttribute('d', d);
    path.setAttribute('stroke', s.color);
    path.setAttribute('stroke-width', String(s.size));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
  }
  return svg;
}

render();
