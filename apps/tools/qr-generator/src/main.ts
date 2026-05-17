import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'QR Generator';
const APP_VERSION = '1.3.0';
const APP_DESC = '快速生成二维码，支持自定义颜色和批量生成';

let theme: 'light' | 'dark' = (localStorage.getItem('qr_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('qr_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有设置吗？')) return;
  localStorage.clear();
  localStorage.setItem('qr_theme', theme);
  render();
}

// 导入/导出
function exportData(): void {
  const text = (document.getElementById('textInput') as HTMLInputElement)?.value || '';
  const fg = (document.getElementById('fgColor') as HTMLInputElement)?.value || '#000000';
  const bg = (document.getElementById('bgColor') as HTMLInputElement)?.value || '#ffffff';
  const data = { text, fg, bg, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'qr-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.text) {
        (document.getElementById('textInput') as HTMLInputElement).value = data.text;
        if (data.fg) (document.getElementById('fgColor') as HTMLInputElement).value = data.fg;
        if (data.bg) (document.getElementById('bgColor') as HTMLInputElement).value = data.bg;
        generateQR();
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

// 批量生成
let batchTexts = '';
function showBatchDialog(): void {
  batchTexts = prompt('输入多个文本，每行一个（最多10个）：', '') || '';
  if (!batchTexts) return;
  const lines = batchTexts.split('\n').filter(l => l.trim()).slice(0, 10);
  if (lines.length === 0) return;
  
  const container = document.getElementById('batch-results')!;
  container.innerHTML = '';
  lines.forEach((text, idx) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const modules = encodeQR(text);
    drawQR(canvas, modules, '#000000', '#ffffff');
    const div = document.createElement('div');
    div.className = 'batch-item';
    div.appendChild(canvas);
    div.appendChild(document.createTextNode(text.slice(0, 20)));
    container.appendChild(div);
  });
}

// 矢量下载（SVG）
function downloadSVG(): void {
  const text = (document.getElementById('textInput') as HTMLInputElement)?.value || 'Hello';
  const fg = (document.getElementById('fgColor') as HTMLInputElement)?.value || '#000000';
  const bg = (document.getElementById('bgColor') as HTMLInputElement)?.value || '#ffffff';
  const modules = encodeQR(text);
  const size = modules.length;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="${bg}"/>`;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) {
        svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fg}"/>`;
      }
    }
  }
  svg += '</svg>';
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'qrcode.svg'; a.click();
}

const EC_LEVEL = { L: 1, M: 0, Q: 3, H: 2 };

function render() {
  applyTheme();
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <span class="logo">📱</span><span class="title">QR Generator</span>
        <div class="header-right">
          <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
          <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
          <button class="btn-sm" id="batch-btn">📦 批量</button>
          <button class="btn-sm" id="export-btn">📤 导出设置</button>
          <label class="btn-sm">📥 导入设置<input type="file" accept=".json" id="import-input" hidden/></label>
          <button class="btn-sm" id="reset-btn">🔄 重置</button>
        </div>
      </header>
      <main class="main">
        <div class="controls">
          <input type="text" id="textInput" placeholder="输入文本或 URL..." value="https://97.383636.xyz"/>
          <label>前景 <input type="color" id="fgColor" value="#000000"/></label>
          <label>背景 <input type="color" id="bgColor" value="#ffffff"/></label>
          <select id="ec-level" class="select">
            <option value="L">低 (L)</option>
            <option value="M" selected>中 (M)</option>
            <option value="Q">较高 (Q)</option>
            <option value="H">高 (H)</option>
          </select>
          <button class="btn primary" id="genBtn">🔄 生成</button>
          <button class="btn" id="dlBtn">💾 PNG</button>
          <button class="btn" id="svgBtn">📐 SVG</button>
        </div>
        <div class="qr-box"><canvas id="qrCanvas" width="256" height="256"></canvas></div>
        <div id="batch-results" class="batch-results"></div>
      </main>
    </div>
  `;

  generateQR();
  bindEvents();
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });
  document.getElementById('batch-btn')?.addEventListener('click', () => { showBatchDialog(); });
  
  document.getElementById('genBtn')!.addEventListener('click', generateQR);
  document.getElementById('dlBtn')!.addEventListener('click', downloadPNG);
  document.getElementById('svgBtn')!.addEventListener('click', downloadSVG);
  document.getElementById('textInput')!.addEventListener('keydown', e => { if (e.key === 'Enter') generateQR(); });
}

function generateQR() {
  const text = (document.getElementById('textInput') as HTMLInputElement).value || 'Hello';
  const fg = (document.getElementById('fgColor') as HTMLInputElement).value;
  const bg = (document.getElementById('bgColor') as HTMLInputElement).value;
  const canvas = document.getElementById('qrCanvas') as HTMLCanvasElement;
  const modules = encodeQR(text);
  drawQR(canvas, modules, fg, bg);
}

function drawQR(canvas: HTMLCanvasElement, modules: boolean[][], fg: string, bg: string): void {
  const size = modules.length;
  const cellSize = canvas.width / size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fg;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize + 0.5, cellSize + 0.5);
      }
    }
  }
}

function downloadPNG() {
  const canvas = document.getElementById('qrCanvas') as HTMLCanvasElement;
  const a = document.createElement('a');
  a.download = 'qrcode.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
}

function encodeQR(text: string): boolean[][] {
  const size = 25;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const outer = y === 0 || y === 6 || x === 0 || x === 6;
      const inner = y >= 2 && y <= 4 && x >= 2 && x <= 4;
      matrix[oy + y][ox + x] = outer || inner;
    }
    for (let i = 0; i < 8; i++) {
      if (oy > 0) matrix[oy - 1][ox + i] = false;
      if (oy + i < matrix.length) matrix[oy + i][ox - 1] = false;
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Data encoding (simplified - just use text chars)
  const data = Array.from(text).map(c => c.charCodeAt(0));
  let idx = 0;
  for (let y = 0; y < size && idx < data.length; y++) {
    if (y === 6) continue;
    for (let x = size - 1; x >= 0 && idx < data.length; x -= 2) {
      if (x === 6) x--;
      for (let dx = 0; dx <= 1 && idx < data.length; dx++) {
        if (x + dx < size) {
          matrix[y][x + dx] = (data[idx] & (1 << (dx === 0 ? 0 : 7))) !== 0;
        }
      }
      idx++;
    }
  }

  return matrix;
}

render();
