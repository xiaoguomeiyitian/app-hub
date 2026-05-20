import '@app-hub/design-system/src/style.css';
import '@app-hub/utils/theme/variables.css';
import './style.css';

const APP_NAME = 'Guestbook';
const APP_VERSION = '1.3.0';
const APP_DESC = '在线留言板，支持签名';

let theme: 'light' | 'dark' = (localStorage.getItem('guest_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('guest_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有留言吗？此操作不可撤销。')) return;
  messages = [];
  localStorage.clear();
  localStorage.setItem('guest_theme', theme);
  render();
}

function exportData(): void {
  const data = { messages, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'guestbook-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.messages && Array.isArray(data.messages)) {
        messages = data.messages;
        render();
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

interface Message {
  id: number; name: string; message: string; signature: string | null; created_at: string;
}

const API = 'https://97.383636.xyz/openclaw/20008/api/guestbook';
const WS_URL = 'wss://97.383636.xyz';
const WS_PATH = '/openclaw/20008/api/guestbook';

let messages: Message[] = [];
let ws: WebSocket | null = null;
let connected = false;

let sigCanvas: HTMLCanvasElement;
let sigCtx: CanvasRenderingContext2D;
let sigDrawing = false;
let sigPoints: { x: number; y: number }[] = [];
let sigEmpty = true;

function getThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    bg: styles.getPropertyValue('--bg-primary').trim() || '#ffffff',
    fg: styles.getPropertyValue('--text-primary').trim() || '#000000',
  };
}

function initSigCanvas(): void {
  sigCanvas = document.getElementById('sig-canvas') as HTMLCanvasElement;
  if (!sigCanvas) return;
  sigCtx = sigCanvas.getContext('2d')!;
  sigCtx.strokeStyle = '#000';
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = 'round';

  sigCanvas.addEventListener('mousedown', (e) => {
    sigDrawing = true;
    sigEmpty = false;
    const rect = sigCanvas.getBoundingClientRect();
    sigPoints.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    sigCtx.beginPath();
    sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  });

  sigCanvas.addEventListener('mousemove', (e) => {
    if (!sigDrawing) return;
    const rect = sigCanvas.getBoundingClientRect();
    sigPoints.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    sigCtx.stroke();
  });

  sigCanvas.addEventListener('mouseup', () => { sigDrawing = false; });
  sigCanvas.addEventListener('mouseleave', () => { sigDrawing = false; });
}

function render(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📖</span><span class="title">Guestbook</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="controls">
        <input type="text" id="name-input" placeholder="你的名字" class="f-input" />
        <textarea id="message-input" placeholder="留言内容..." class="f-input" rows="3"></textarea>
        <canvas id="sig-canvas" width="200" height="100" style="border:1px solid #ccc; border-radius:4px;"></canvas>
        <button class="btn-sm" id="clear-sig">清除签名</button>
        <button class="btn-sm" id="send-btn">💌 发送</button>
      </div>
      <div class="message-list">
        ${messages.slice(0, 10).map(m => `
          <div class="message-item">
            <div class="msg-header">
              <span class="msg-name">${m.name}</span>
              <span class="msg-time">${m.created_at}</span>
            </div>
            <div class="msg-content">${m.message}</div>
            ${m.signature ? `<div class="msg-sig"><img src="${m.signature}" alt="签名"/></div>` : ''}
          </div>
        `).join('')}
        ${messages.length === 0 ? '<p class="text-muted">暂无留言</p>' : ''}
      </div>
      <div class="connection-status">${connected ? '🟢 已连接' : '🔴 未连接'}</div>
    </main>
  </div>`;
  bindEvents();
  initSigCanvas();
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });

  document.getElementById('send-btn')?.addEventListener('click', () => {
    const name = (document.getElementById('name-input') as HTMLInputElement)?.value;
    const message = (document.getElementById('message-input') as HTMLTextAreaElement)?.value;
    if (name && message) {
      messages.unshift({ id: Date.now(), name, message, signature: null, created_at: new Date().toISOString() });
      render();
    }
  });

  document.getElementById('clear-sig')?.addEventListener('click', () => {
    if (sigCtx) { sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); sigEmpty = true; }
  });
}

// 初始化
(async () => {
  render();
})();
