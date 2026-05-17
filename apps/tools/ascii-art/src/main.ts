import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'ASCII Art';
const APP_VERSION = '1.3.0';
const APP_DESC = '图片转 ASCII 艺术生成器';

let theme: 'light' | 'dark' = (localStorage.getItem('ascii_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('ascii_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('ascii_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  history = [];
  localStorage.clear();
  localStorage.setItem('ascii_theme', theme);
  render();
}

function exportData(): void {
  const output = document.getElementById('output')?.textContent || '';
  const data = { output, history, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ascii-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.output) {
        const outputEl = document.getElementById('output');
        if (outputEl) outputEl.textContent = data.output;
      }
      if (data.history) { history = data.history; localStorage.setItem('ascii_history', JSON.stringify(history)); }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

const CHARS_DARK = '@%#*+=-:. ';       // dark to light
const CHARS_BLOCK = '█▓▒░ ';            // block chars
const CHARS_DETAILED = '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`. ';

let density = 100;
let charset = CHARS_DARK;
let colored = false;
let imgData: ImageData | null = null;
let imgW = 0, imgH = 0;

function render() {
  applyTheme();
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <span class="logo">🖼️</span><span class="title">ASCII Art</span>
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
          <input type="file" id="fileInput" accept="image/*"/>
          <label>密度 <input type="range" id="densitySlider" min="20" max="300" value="${density}"/> ${density}</label>
          <select id="charsetSelect">
            <option value="dark" ${charset===CHARS_DARK?'selected':''}>经典 (@%#*+=-:. )</option>
            <option value="block" ${charset===CHARS_BLOCK?'selected':''}>方块 (█▓▒░ )</option>
            <option value="detailed" ${charset===CHARS_DETAILED?'selected':''}>精细</option>
          </select>
          <label class="check-label"><input type="checkbox" id="colorCheck" ${colored?'checked':''}/> 彩色模式</label>
          <button class="btn" id="copyBtn">📋 复制文本</button>
        </div>
        <img id="preview" class="preview-img" style="display:none"/>
        <div class="output" id="output">上传图片开始转换...</div>
        ${history.length > 0 ? `
          <div class="history">
            <div class="history-header">历史记录 <button class="btn-xs" id="clear-history">清空</button></div>
            ${history.slice(0, 3).map(h => `<div class="hist-item">${h.slice(0, 50)}...</div>`).join('')}
          </div>
        ` : ''}
      </main>
    </div>
  `;

  bindEvents();
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });

  document.getElementById('fileInput')!.addEventListener('change', handleFile);
  document.getElementById('densitySlider')!.addEventListener('input', e => {
    density = +(e.target as HTMLInputElement).value;
    if (imgData) convert();
    else render();
  });
  document.getElementById('charsetSelect')!.addEventListener('change', e => {
    const v = (e.target as HTMLSelectElement).value;
    charset = v === 'block' ? CHARS_BLOCK : v === 'detailed' ? CHARS_DETAILED : CHARS_DARK;
    if (imgData) convert();
  });
  document.getElementById('colorCheck')!.addEventListener('change', e => {
    colored = (e.target as HTMLInputElement).checked;
    if (imgData) convert();
  });
  document.getElementById('copyBtn')!.addEventListener('click', () => {
    const out = document.getElementById('output')!;
    const text = colored ? out.innerText : out.textContent!;
    navigator.clipboard?.writeText(text).catch(() => {});
  });
  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('ascii_history', JSON.stringify(history)); render();
  });
}

function handleFile(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(img.width, 800);
      canvas.height = Math.min(img.height, 800);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      imgW = canvas.width; imgH = canvas.height;
      const preview = document.getElementById('preview') as HTMLImageElement;
      preview.src = ev.target!.result as string;
      preview.style.display = 'block';
      convert();
    };
    img.src = ev.target!.result as string;
  };
  reader.readAsDataURL(file);
}

function convert(): void {
  if (!imgData) return;
  const out = document.getElementById('output')!;
  const w = Math.floor(imgW * density / 100);
  const h = Math.floor(imgH * density / 100);
  const charW = imgW / w, charH = imgH / h;
  
  let result = '';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = Math.floor(x * charW), py = Math.floor(y * charH);
      const i = (py * imgW + px) * 4;
      const r = imgData.data[i], g = imgData.data[i+1], b = imgData.data[i+2];
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const idx = Math.floor(brightness * (charset.length - 1));
      if (colored) {
        result += `<span style="color:rgb(${r},${g},${b})">${charset[idx]}</span>`;
      } else {
        result += charset[idx];
      }
    }
    result += '\n';
  }
  
  out.innerHTML = colored ? result : '';
  out.textContent = result;
  
  // 保存到历史
  history.unshift(result.slice(0, 100));
  if (history.length > 10) history.pop();
  localStorage.setItem('ascii_history', JSON.stringify(history));
}

render();
