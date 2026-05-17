import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'Color Picker';
const APP_VERSION = '1.3.0';
const APP_DESC = '高级颜色选择器，支持调色板、渐变生成和格式转换';

let theme: 'light' | 'dark' = (localStorage.getItem('color_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('color_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  state.palette = [];
  state.r = 88; state.g = 166; state.b = 255;
  localStorage.clear();
  localStorage.setItem('color_theme', theme);
  savePalette(state.palette);
  render();
}

// 导入/导出
function exportData(): void {
  const data = { palette: state.palette, color: rgbToHex(state.r, state.g, state.b), exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'color-picker-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.palette) { state.palette = data.palette; savePalette(state.palette); }
      if (data.color) { const rgb = hexToRgb(data.color); if (rgb) { state.r = rgb[0]; state.g = rgb[1]; state.b = rgb[2]; } }
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

// 渐变生成
function generateGradient(): string {
  const hex = rgbToHex(state.r, state.g, state.b);
  const hsl = rgbToHsl(state.r, state.g, state.b);
  const colors = [hex];
  for (let i = 1; i <= 4; i++) {
    const newHue = (hsl[0] + (360 / 5) * i) % 360;
    const newRgb = hslToRgb(newHue, hsl[1], hsl[2]);
    colors.push(rgbToHex(newRgb[0], newRgb[1], newRgb[2]));
  }
  return `linear-gradient(90deg, ${colors.join(', ')})`;
}

// 取色器（模拟）
function pickColor(): void {
  if (!('EyeDropper' in window)) {
    alert('您的浏览器不支持取色器 API');
    return;
  }
  // @ts-ignore
  const dropper = new (window as any).EyeDropper();
  dropper.open().then((result: { sRgbHex: string }) => {
    const rgb = hexToRgb(result.sRgbHex);
    if (rgb) { state.r = rgb[0]; state.g = rgb[1]; state.b = rgb[2]; render(); }
  }).catch(() => {});
}

// --- Color Math ---
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): [number, number, number] | null {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return null;
  const n = parseInt(hex, 16);
  if (isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  if (r === 0 && g === 0 && b === 0) return [0, 0, 0, 100];
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  return [
    Math.round((1 - rr - k) / (1 - k) * 100),
    Math.round((1 - gg - k) / (1 - k) * 100),
    Math.round((1 - bb - k) / (1 - k) * 100),
    Math.round(k * 100)
  ];
}

interface ColorState {
  r: number; g: number; b: number;
  palette: string[];
}

const STORAGE_KEY = 'color-picker-palette';

function loadPalette(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function savePalette(p: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

let state: ColorState = { r: 88, g: 166, b: 255, palette: loadPalette() };

function render(): void {
  applyTheme();
  const hex = rgbToHex(state.r, state.g, state.b);
  const hsl = rgbToHsl(state.r, state.g, state.b);
  const cmyk = rgbToCmyk(state.r, state.g, state.b);
  const gradient = generateGradient();

  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🎨</span><span class="title">Color Picker</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="pick-color">🎯 取色</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="picker-area">
        <div class="color-preview" style="background:${hex}"></div>
        <div class="sliders">
          <label>R <input type="range" id="r-slider" min="0" max="255" value="${state.r}" class="slider"/></label>
          <label>G <input type="range" id="g-slider" min="0" max="255" value="${state.g}" class="slider"/></label>
          <label>B <input type="range" id="b-slider" min="0" max="255" value="${state.b}" class="slider"/></label>
        </div>
        <div class="format-outputs">
          <div>HEX: <code>${hex}</code> <button class="copy-btn" data-text="${hex}">📋</button></div>
          <div>RGB: <code>rgb(${state.r}, ${state.g}, ${state.b})</code></div>
          <div>HSL: <code>hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)</code></div>
          <div>CMYK: <code>${cmyk.map(c => c + '%').join(', ')}</code></div>
        </div>
        <button class="btn-sm" id="save-palette">💾 保存到调色板</button>
      </div>
      <div class="gradient-box">
        <div class="gradient-preview" style="background:${gradient}; height:60px; border-radius:8px;"></div>
        <div class="gradient-label">渐变预览</div>
      </div>
      ${state.palette.length > 0 ? `
        <div class="palette">
          <div class="palette-header">调色板 (${state.palette.length})</div>
          <div class="palette-grid">
            ${state.palette.map((c, i) => `
              <div class="palette-item" style="background:${c}" title="${c}">
                <button class="palette-del" data-idx="${i}" title="删除">×</button>
              </div>
            `).join('')}
          </div>
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
  document.getElementById('pick-color')?.addEventListener('click', () => { pickColor(); });

  ['r', 'g', 'b'].forEach(ch => {
    document.getElementById(ch + '-slider')?.addEventListener('input', (e) => {
      state[ch as 'r' | 'g' | 'b'] = +(e.target as HTMLInputElement).value;
      render();
    });
  });

  document.getElementById('save-palette')?.addEventListener('click', () => {
    const hex = rgbToHex(state.r, state.g, state.b);
    if (!state.palette.includes(hex)) {
      state.palette.push(hex);
      savePalette(state.palette);
      render();
    }
  });

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText((btn as HTMLElement).dataset.text || '');
    });
  });

  document.querySelectorAll('.palette-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +(btn as HTMLElement).dataset.idx!;
      state.palette.splice(idx, 1);
      savePalette(state.palette);
      render();
    });
  });
}

render();
