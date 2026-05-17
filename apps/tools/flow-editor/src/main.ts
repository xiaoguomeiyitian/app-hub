import '@app-hub/design-system/src/style.css';
/// <reference types="vite/client" />
import './style.css';

const APP_NAME = 'Flow Editor';
const APP_VERSION = '1.3.0';
const APP_DESC = '流程图编辑器，支持节点和连线';

let theme: 'light' | 'dark' = (localStorage.getItem('flow_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('flow_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('flow_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有流程图吗？此操作不可撤销。')) return;
  nodes = [];
  edges = [];
  history = [];
  localStorage.clear();
  localStorage.setItem('flow_theme', theme);
  render();
}

function exportData(): void {
  const snapshot = { nodes, edges, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'flow-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.nodes && data.edges) {
        nodes = data.nodes; edges = data.edges;
        saveState(); render();
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

interface Node { id: string; type: 'rect' | 'rounded' | 'diamond' | 'circle'; x: number; y: number; w: number; h: number; text: string; color: string; }
interface Edge { id: string; from: string; to: string; }
interface Snapshot { nodes: Node[]; edges: Edge[]; }

let nodes: Node[] = [];
let edges: Edge[] = [];
let selectedId: string | null = null;
let zoom = 1;
let panX = 0, panY = 0;
let dragging: { id: string; offsetX: number; offsetY: number } | null = null;
let panning = false;
let panStart = { x: 0, y: 0 };
let connecting: { from: string; x: number; y: number } | null = null;
let undoStack: Snapshot[] = [];
let redoStack: Snapshot[] = [];
const COLORS = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
const SNAP = 10;

let nid = 0;
function newNode(type: Node['type'], x: number, y: number): Node {
  nid++;
  const sizes: Record<string, [number, number]> = { rect: [120, 60], rounded: [120, 60], diamond: [80, 80], circle: [70, 70] };
  const [w, h] = sizes[type];
  return { id: `n${nid}`, type, x: Math.round(x / SNAP) * SNAP, y: Math.round(y / SNAP) * SNAP, w, h, text: '节点', color: COLORS[nid % COLORS.length] };
}

function snap(v: number): number { return Math.round(v / SNAP) * SNAP; }

function saveState(): void {
  undoStack.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
}

function render(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📈</span><span class="title">Flow Editor</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="toolbar">
        <button class="btn-sm" id="add-rect">矩形</button>
        <button class="btn-sm" id="add-rounded">圆角</button>
        <button class="btn-sm" id="add-diamond">菱形</button>
        <button class="btn-sm" id="add-circle">圆形</button>
        <button class="btn-sm" id="undo-btn">↩️ 撤销</button>
        <button class="btn-sm" id="redo-btn">↪️ 重做</button>
      </div>
      <div class="canvas-container" id="canvas-container">
        <svg id="canvas" width="100%" height="600" style="background:var(--bg, #f5f5f5); border-radius:8px;">
          <g transform="translate(${panX}, ${panY}) scale(${zoom})">
            ${edges.map(e => {
              const from = nodes.find(n => n.id === e.from);
              const to = nodes.find(n => n.id === e.to);
              if (!from || !to) return '';
              return `<line x1="${from.x + from.w/2}" y1="${from.y + from.h/2}" x2="${to.x + to.w/2}" y2="${to.y + to.h/2}" stroke="#999" stroke-width="2"/>`;
            }).join('')}
            ${nodes.map(n => {
              if (n.type === 'diamond') {
                const cx = n.x + n.w/2, cy = n.y + n.h/2;
                return `<polygon points="${cx},${n.y} ${n.x+n.w},${cy} ${cx},${n.y+n.h} ${n.x},${cy}" fill="${n.color}" data-id="${n.id}" class="flow-node"/>`;
              }
              if (n.type === 'circle') {
                const cx = n.x + n.w/2, cy = n.y + n.h/2;
                return `<circle cx="${cx}" cy="${cy}" r="${n.w/2}" fill="${n.color}" data-id="${n.id}" class="flow-node"/>`;
              }
              const rx = n.type === 'rounded' ? 10 : 0;
              return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${rx}" fill="${n.color}" data-id="${n.id}" class="flow-node"/>
                <text x="${n.x + n.w/2}" y="${n.y + n.h/2}" text-anchor="middle" dominant-baseline="middle" fill="white">${n.text}</text>`;
            }).join('')}
          </g>
        </svg>
      </div>
      ${history.length > 0 ? `
        <div class="history">
          <div class="history-header">历史记录 <button class="btn-xs" id="clear-history">清空</button></div>
          ${history.slice(0, 3).map(h => `<div class="hist-item">${h.slice(0, 50)}...</div>`).join('')}
        </div>
      ` : ''}
    </main>
  </div>`;
  bindEvents();
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });

  ['rect', 'rounded', 'diamond', 'circle'].forEach(type => {
    document.getElementById(`add-${type}`)?.addEventListener('click', () => {
      saveState();
      nodes.push(newNode(type as Node['type'], 100, 100));
      render();
    });
  });

  document.getElementById('undo-btn')?.addEventListener('click', () => {
    if (undoStack.length === 0) return;
    redoStack.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    const prev = undoStack.pop()!;
    nodes = prev.nodes; edges = prev.edges;
    render();
  });

  document.getElementById('redo-btn')?.addEventListener('click', () => {
    if (redoStack.length === 0) return;
    undoStack.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    const next = redoStack.pop()!;
    nodes = next.nodes; edges = next.edges;
    render();
  });

  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('flow_history', JSON.stringify(history)); render();
  });

  // 简化的节点拖拽和连线逻辑省略，保持核心功能
}

render();
