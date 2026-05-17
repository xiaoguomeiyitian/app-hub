import './style.css';
import '@app-hub/utils/theme/variables.css';
import { LayerStack } from '@app-hub/utils/layers';

type ShapeType = 'rect' | 'circle' | 'line' | 'text';

interface Shape {
  id: string;
  type: ShapeType | 'quadratic';
  x: number; y: number;
  width: number; height: number;
  fill: string; stroke: string; strokeWidth: number; opacity: number;
  text?: string;
  fontSize?: number;
  // Quadratic specific
  cpX?: number; cpY?: number;
  x2?: number; y2?: number;
}

let shapes: Shape[] = [];
const layers = new LayerStack();
const BASE_ID = layers.add({ type: 'base' }, 'Base');
const DRAW_ID = layers.add({ type: 'drawing', shapes: shapes as Shape[] }, 'Drawing');
let selectedId: string | null = null;
let tool: ShapeType | 'select' | 'quadratic' = 'select';
let drawing = false;
let quadState: { stage: 'control' | 'end'; shape: Shape } | null = null;
let startX = 0, startY = 0;
let history: Shape[][] = [];
let historyIdx = -1;

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function saveHistory(): void {
  history = history.slice(0, historyIdx + 1);
  history.push(JSON.parse(JSON.stringify(shapes)));
  historyIdx = history.length - 1;
}

function undo(): void { if (historyIdx > 0) { historyIdx--; shapes = JSON.parse(JSON.stringify(history[historyIdx])); selectedId = null; render(); } }
function redo(): void { if (historyIdx < history.length - 1) { historyIdx++; shapes = JSON.parse(JSON.stringify(history[historyIdx])); selectedId = null; render(); } }

function shapeToSvg(s: Shape): string {
  const common = `fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}"`;
  switch (s.type) {
    case 'rect': return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="2" ${common} data-id="${s.id}"/>`;
    case 'circle': return `<ellipse cx="${s.x + s.width/2}" cy="${s.y + s.height/2}" rx="${s.width/2}" ry="${s.height/2}" ${common} data-id="${s.id}"/>`;
    case 'line': return `<line x1="${s.x}" y1="${s.y}" x2="${s.x + s.width}" y2="${s.y + s.height}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}" data-id="${s.id}"/>`;
    case 'text': return `<text x="${s.x}" y="${s.y + (s.fontSize||16)}" fill="${s.fill}" font-size="${s.fontSize||16}" opacity="${s.opacity}" data-id="${s.id}">${s.text||'Text'}</text>`;
    case 'quadratic':
      if (s.cpX !== undefined && s.x2 !== undefined) {
        return `<path d="M ${s.x} ${s.y} Q ${s.cpX} ${s.cpY} ${s.x2} ${s.y2}" fill="none" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}" data-id="${s.id}"/>`;
      }
      return '';
  }
}

function render(): void {
  const sel = shapes.find(s => s.id === selectedId);
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">✏️</span><span class="title">SVG Editor</span>
      <div class="header-right">
        <button class="btn-sm" id="undo-btn" ${historyIdx <= 0 ? 'disabled' : ''}>↩ Undo</button>
        <button class="btn-sm" id="redo-btn" ${historyIdx >= history.length - 1 ? 'disabled' : ''}>↪ Redo</button>
        <button class="btn-sm" id="export-btn">📥 Export SVG</button>
      </div>
    </header>
    <main class="main">
      <div class="toolbar">
        <button class="tool-btn ${tool === 'select' ? 'active' : ''}" data-tool="select">🖱️</button>
        <button class="tool-btn ${tool === 'rect' ? 'active' : ''}" data-tool="rect">▭</button>
        <button class="tool-btn ${tool === 'circle' ? 'active' : ''}" data-tool="circle">◯</button>
        <button class="tool-btn ${tool === 'line' ? 'active' : ''}" data-tool="line">╱</button>
        <button class="tool-btn ${tool === 'text' ? 'active' : ''}" data-tool="text">T</button>
        <button class="tool-btn ${tool === 'quadratic' ? 'active' : ''}" data-tool="quadratic">❝</button>
        <div class="toolbar-sep"></div>
        <label class="color-label">Fill <input type="color" id="fill-color" value="${sel?.fill || '#58a6ff'}" /></label>
        <label class="color-label">Stroke <input type="color" id="stroke-color" value="${sel?.stroke || '#e6edf3'}" /></label>
      </div>
      <div class="canvas-wrap">
        <svg id="canvas" class="canvas" viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="500" fill="#161b22"/>
          ${shapes.map(s => shapeToSvg(s)).join('')}
          ${sel && sel.type !== 'quadratic' ? `<rect x="${sel.x-2}" y="${sel.y-2}" width="${sel.width+4}" height="${sel.height+4}" fill="none" stroke="#58a6ff" stroke-width="1" stroke-dasharray="4" pointer-events="none"/>` : ''}
        </svg>
      </div>
      ${sel ? `
      <div class="props-panel">
        <h3>Properties</h3>
        <div class="prop-row"><label>X</label><input type="number" value="${sel.x}" data-prop="x" class="prop-input" /></div>
        <div class="prop-row"><label>Y</label><input type="number" value="${sel.y}" data-prop="y" class="prop-input" /></div>
        <div class="prop-row"><label>W</label><input type="number" value="${sel.width}" data-prop="width" class="prop-input" /></div>
        <div class="prop-row"><label>H</label><input type="number" value="${sel.height}" data-prop="height" class="prop-input" /></div>
        <div class="prop-row"><label>Opacity</label><input type="range" min="0" max="1" step="0.1" value="${sel.opacity}" data-prop="opacity" class="slider" /></div>
        ${sel.type === 'text' ? `<div class="prop-row"><label>Text</label><input type="text" value="${sel.text || ''}" data-prop="text" class="prop-input" /></div>` : ''}
        ${sel.type === 'quadratic' ? `
        <div class="prop-row"><label>CP X</label><input type="number" value="${sel.cpX || 0}" data-prop="cpX" class="prop-input" /></div>
        <div class="prop-row"><label>CP Y</label><input type="number" value="${sel.cpY || 0}" data-prop="cpY" class="prop-input" /></div>
        <div class="prop-row"><label>End X</label><input type="number" value="${sel.x2 || 0}" data-prop="x2" class="prop-input" /></div>
        <div class="prop-row"><label>End Y</label><input type="number" value="${sel.y2 || 0}" data-prop="y2" class="prop-input" /></div>
        ` : ''}
        <button class="btn-sm del-btn" id="delete-shape">🗑️ Delete</button>
      </div>` : ''}
    </main>
  </div>`;
  bindEvents();
}

function bindEvents(): void {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => { tool = (btn as HTMLElement).dataset.tool as any; render(); });
  });
  document.getElementById('undo-btn')?.addEventListener('click', undo);
  document.getElementById('redo-btn')?.addEventListener('click', redo);
  document.getElementById('export-btn')?.addEventListener('click', () => {
    const layersList = layers.getAll().filter(l => l.visible && l.id !== BASE_ID);
    const bodyParts: string[] = [];
    for (const layer of layersList) {
      const layerShapes: Shape[] = (layer.data as any).shapes || [];
      if (layerShapes.length) {
        const shapesSvg = layerShapes.map(s => shapeToSvg(s)).join('\n');
        bodyParts.push(`  <g data-layer="${layer.name}">\n${shapesSvg}\n  </g>`);
      }
    }
    const svg = `<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">\n${bodyParts.join('\n')}\n</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'drawing.svg'; a.click();
  });

  const canvas = document.getElementById('canvas')! as unknown as SVGElement;
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scale = 800 / rect.width;
    startX = (e.clientX - rect.left) * scale;
    startY = (e.clientY - rect.top) * scale;
    if (tool === 'select') {
      const target = e.target as SVGElement;
      const id = target.getAttribute('data-id');
      selectedId = id || null;
      render();
      return;
    }
    // Quadratic tool multi-stage handling
    if (tool === 'quadratic') {
      if (!quadState) {
        // Start: set start point
        drawing = true;
        const strokeColor = (document.getElementById('stroke-color') as HTMLInputElement).value;
        const newShape: Shape = {
          id: uid(), type: 'quadratic',
          x: startX, y: startY, width: 0, height: 0,
          fill: 'none', stroke: strokeColor,
          strokeWidth: 2, opacity: 1
        };
        shapes.push(newShape);
        selectedId = newShape.id;
        quadState = { stage: 'control', shape: newShape };
        render();
        return;
      } else if (quadState.stage === 'control') {
        // Set control point
        quadState.shape.cpX = startX;
        quadState.shape.cpY = startY;
        render();
        return;
      } else if (quadState.stage === 'end') {
        // Set end point and finish
        quadState.shape.x2 = startX;
        quadState.shape.y2 = startY;
        quadState = null;
        drawing = false;
        saveHistory();
        render();
        return;
      }
    }

    // Regular shapes
    drawing = true;
    const fillColor = (document.getElementById('fill-color') as HTMLInputElement).value;
    const strokeColor = (document.getElementById('stroke-color') as HTMLInputElement).value;
    const newShape: Shape = {
      id: uid(), type: tool as ShapeType,
      x: startX, y: startY, width: 0, height: 0,
      fill: tool === 'line' ? 'none' : fillColor, stroke: strokeColor,
      strokeWidth: 2, opacity: 1, text: tool === 'text' ? 'Text' : undefined, fontSize: 16
    };
    shapes.push(newShape);
    selectedId = newShape.id;
    render();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!drawing || !selectedId) return;
    if (tool === 'quadratic' && quadState) return; // Skip mousemove while placing quadratic points
    const rect = canvas.getBoundingClientRect();
    const scale = 800 / rect.width;
    const cx = (e.clientX - rect.left) * scale;
    const cy = (e.clientY - rect.top) * scale;
    const s = shapes.find(s => s.id === selectedId);
    if (s) { s.width = cx - startX; s.height = cy - startY; render(); }
  });

  canvas.addEventListener('mouseup', () => {
    if (drawing) { drawing = false; saveHistory(); }
  });

  document.querySelectorAll('.prop-input').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement;
      const prop = el.dataset.prop!;
      const s = shapes.find(s => s.id === selectedId);
      if (s) { (s as any)[prop] = prop === 'text' ? el.value : +el.value; saveHistory(); render(); }
    });
  });

  document.querySelectorAll('.slider').forEach(sl => {
    sl.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      const s = shapes.find(s => s.id === selectedId);
      if (s) { (s as any)[el.dataset.prop!] = +el.value; render(); }
    });
    sl.addEventListener('change', () => saveHistory());
  });

  document.getElementById('delete-shape')?.addEventListener('click', () => {
    shapes = shapes.filter(s => s.id !== selectedId);
    selectedId = null; saveHistory(); render();
  });

  document.getElementById('fill-color')?.addEventListener('change', (e) => {
    const s = shapes.find(s => s.id === selectedId);
    if (s) { s.fill = (e.target as HTMLInputElement).value; saveHistory(); render(); }
  });
  document.getElementById('stroke-color')?.addEventListener('change', (e) => {
    const s = shapes.find(s => s.id === selectedId);
    if (s) { s.stroke = (e.target as HTMLInputElement).value; saveHistory(); render(); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    if (e.key === 'Delete' && selectedId) { shapes = shapes.filter(s => s.id !== selectedId); selectedId = null; saveHistory(); render(); }
  });
}

saveHistory();
render();
