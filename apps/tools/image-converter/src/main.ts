import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'Image Converter';
const APP_VERSION = '1.3.0';
const APP_DESC = '图片格式转换工具';

let theme: 'light' | 'dark' = (localStorage.getItem('image_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('image_history') || '[]');

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('image_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有设置吗？')) return;
  image = null; originalFile = null; format = 'png'; quality = 0.9; width = 0; height = 0; base64Output = '';
  localStorage.clear();
  localStorage.setItem('image_theme', theme);
  render();
}

function exportData(): void {
  const data = { format, quality, width, height, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'image-converter-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.format) format = data.format;
      if (data.quality) quality = data.quality;
      if (data.width) width = data.width;
      if (data.height) height = data.height;
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

let image: HTMLImageElement | null = null;
let originalFile: File | null = null;
let format: 'png' | 'jpeg' | 'webp' = 'png';
let quality = 0.9;
let width = 0, height = 0;
let maintainRatio = true;
let base64Output = '';

function render(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🖼️</span><span class="title">Image Converter</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="upload-zone" id="drop-zone">
        <div class="upload-content">
          <span class="upload-icon">📁</span>
          <p>拖放图片到此处或 <label class="upload-label">浏览<input type="file" id="file-input" accept="image/*" hidden/></label></p>
          <p class="text-muted">PNG, JPG, WebP, GIF, SVG</p>
        </div>
      </div>
      ${image ? `
        <div class="editor-area">
          <div class="preview-wrap">
            <img id="preview" src="${image.src}" class="preview-img" alt="preview" />
          </div>
          <div class="controls">
            <div class="section">
              <label>格式:
                <select id="format-select" class="select">
                  <option value="png" ${format === 'png' ? 'selected' : ''}>PNG</option>
                  <option value="jpeg" ${format === 'jpeg' ? 'selected' : ''}>JPEG</option>
                  <option value="webp" ${format === 'webp' ? 'selected' : ''}>WebP</option>
                </select>
              </label>
              ${format === 'jpeg' || format === 'webp' ? `
                <label>质量: <input type="range" id="quality-slider" min="0.1" max="1" step="0.1" value="${quality}" /></label>
              ` : ''}
            </div>
            <div class="section">
              <label>宽度: <input type="number" id="width-input" class="f-input" value="${width}" /></label>
              <label>高度: <input type="number" id="height-input" class="f-input" value="${height}" /></label>
              <label><input type="checkbox" id="ratio-toggle" ${maintainRatio ? 'checked' : ''}/> 保持比例</label>
            </div>
            <button class="btn-sm" id="convert-btn">🔄 转换</button>
            ${base64Output ? `<button class="btn-sm" id="copy-btn">📋 复制Base64</button>` : ''}
          </div>
          ${base64Output ? `
            <div class="output">
              <div class="output-label">Base64 输出</div>
              <textarea class="output-text" readonly>${base64Output}</textarea>
            </div>
          ` : ''}
        </div>
      ` : ''}
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

  document.getElementById('drop-zone')?.addEventListener('click', () => { document.getElementById('file-input')?.click(); });
  document.getElementById('file-input')?.addEventListener('change', handleFile);
  
  document.getElementById('format-select')?.addEventListener('change', (e) => {
    format = (e.target as HTMLSelectElement).value as 'png' | 'jpeg' | 'webp';
    render();
  });
  
  document.getElementById('quality-slider')?.addEventListener('input', (e) => {
    quality = +(e.target as HTMLInputElement).value;
  });
  
  document.getElementById('width-input')?.addEventListener('input', (e) => {
    const newWidth = +(e.target as HTMLInputElement).value;
    if (maintainRatio && image) {
      height = Math.round((newWidth / image.naturalWidth) * image.naturalHeight);
      (document.getElementById('height-input') as HTMLInputElement).value = String(height);
    }
    width = newWidth;
  });
  
  document.getElementById('height-input')?.addEventListener('input', (e) => {
    const newHeight = +(e.target as HTMLInputElement).value;
    if (maintainRatio && image) {
      width = Math.round((newHeight / image.naturalHeight) * image.naturalWidth);
      (document.getElementById('width-input') as HTMLInputElement).value = String(width);
    }
    height = newHeight;
  });
  
  document.getElementById('ratio-toggle')?.addEventListener('change', (e) => {
    maintainRatio = (e.target as HTMLInputElement).checked;
  });
  
  document.getElementById('convert-btn')?.addEventListener('click', convertImage);
  
  document.getElementById('copy-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(base64Output);
  });
  
  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('image_history', JSON.stringify(history)); render();
  });
}

function handleFile(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  originalFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      image = img;
      width = img.naturalWidth;
      height = img.naturalHeight;
      render();
    };
    img.src = ev.target!.result as string;
  };
  reader.readAsDataURL(file);
}

function convertImage(): void {
  if (!image) return;
  const canvas = document.createElement('canvas');
  canvas.width = width || image.naturalWidth;
  canvas.height = height || image.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const dataUrl = canvas.toDataURL(mime, quality);
  base64Output = dataUrl;
  
  // 保存到历史
  history.unshift(`Converted to ${format} (${width}x${height})`);
  if (history.length > 10) history.pop();
  localStorage.setItem('image_history', JSON.stringify(history));
  
  render();
}

render();
