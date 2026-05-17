import { styles, HeartStyle } from './styles/index.js';
import '@app-hub/utils/theme/variables.css';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let currentStyle: HeartStyle | null = null;
let currentIndex = 0;
let animationId = 0;
let userText: string = 'Love';

function init(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="container">
      <div class="sidebar">
        <h2>💕 粒子爱心</h2>
        <div class="text-control">
          <label>文字: <input type="text" id="text-input" value="${userText}" maxlength="20"/></label>
        </div>
        <div class="style-list" id="style-list"></div>
      </div>
      <div class="main">
        <div class="header">
          <span class="style-name" id="style-name"></span>
          <span class="style-desc" id="style-desc"></span>
        </div>
        <div class="canvas-wrap" id="canvas-wrap">
          <canvas id="heart-canvas"></canvas>
        </div>
      </div>
    </div>
  `;

  injectStyles();
  canvas = document.getElementById('heart-canvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;

  const list = document.getElementById('style-list')!;
  styles.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.className = 'style-btn' + (i === 0 ? ' active' : '');
    btn.innerHTML = `<span class="btn-num">${String(i + 1).padStart(2, '0')}</span><span class="btn-name">${s.name}</span>`;
    btn.addEventListener('click', () => selectStyle(i));
    list.appendChild(btn);
  });

  // 文字输入
  const textInput = document.getElementById('text-input') as HTMLInputElement;
  textInput?.addEventListener('input', (e) => { userText = (e.target as HTMLInputElement).value; });

  // 鼠标事件
  const wrap = document.getElementById('canvas-wrap')!;
  wrap.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (currentStyle && 'onMouseMove' in currentStyle) {
      (currentStyle as any).onMouseMove(x, y);
    }
  });

  resize();
  window.addEventListener('resize', resize);
  selectStyle(0);
}

function resize(): void {
  const wrap = document.getElementById('canvas-wrap')!;
  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (currentStyle) {
    currentStyle.resize(rect.width, rect.height);
  }
}

function selectStyle(index: number): void {
  currentIndex = index;
  cancelAnimationFrame(animationId);

  // 更新UI
  document.querySelectorAll('.style-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });
  document.getElementById('style-name')!.textContent = styles[index].name;
  document.getElementById('style-desc')!.textContent = styles[index].description;

  // 创建样式实例
  const wrap = document.getElementById('canvas-wrap')!;
  const rect = wrap.getBoundingClientRect();
  currentStyle = styles[index].create(ctx, rect.width, rect.height);

  animate();
}

function animate(): void {
  const wrap = document.getElementById('canvas-wrap')!;
  const rect = wrap.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (currentStyle) {
    currentStyle.render();
  }
  // Draw user text centered
  if (userText) {
    const fontSize = Math.max(16, Math.floor(rect.height * 0.08));
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.fillText(userText, rect.width / 2, rect.height - fontSize * 1.5);
    ctx.shadowBlur = 0;
  }
  animationId = requestAnimationFrame(animate);
}

function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
      height: 100vh;
      overflow: hidden;
    }
    .container {
      display: flex;
      height: 100vh;
    }
    .sidebar {
      width: 240px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-secondary);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .sidebar h2 {
      padding: 20px 16px 12px;
      font-size: 18px;
      font-weight: 600;
      color: var(--accent);
      letter-spacing: 1px;
    }
    .text-control {
      padding: 0 16px 8px;
    }
    .text-control label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    .text-control input[type=text] {
      background: #1a1a25;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 4px 8px;
      color: #fff;
      width: 120px;
      font-size: 13px;
    }
    .style-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 8px;
    }
    .style-list::-webkit-scrollbar { width: 4px; }
    .style-list::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    .style-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 12px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
      margin-bottom: 2px;
    }
    .style-btn:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
    .style-btn.active {
      background: var(--bg-secondary);
      color: var(--accent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent), transparent 80%);
    }
    .btn-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: var(--bg-secondary);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      flex-shrink: 0;
    }
    .style-btn.active .btn-num {
      background: color-mix(in srgb, var(--accent), transparent 85%);
      color: var(--accent);
    }
    .btn-name { flex: 1; }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .header {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-secondary);
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    .style-name {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .style-desc {
      font-size: 13px;
      color: var(--text-secondary);
    }
    .canvas-wrap {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    #heart-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    @media (max-width: 768px) {
      .container { flex-direction: column; }
      .sidebar {
        width: 100%;
        height: auto;
        max-height: 120px;
        border-right: none;
        border-bottom: 1px solid var(--border-secondary);
      }
      .style-list {
        display: flex;
        flex-wrap: nowrap;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 4px 8px;
        gap: 4px;
      }
      .style-btn {
        flex-shrink: 0;
        padding: 6px 10px;
        margin-bottom: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', init);
