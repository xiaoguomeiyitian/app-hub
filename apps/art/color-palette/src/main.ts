/// <reference types="vite/client" />
import './style.css';
import '@app-hub/utils/theme/variables.css';
import { createIdbStore } from '@app-hub/utils/idb';

// ===== 颜色转换 =====
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
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
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = relativeLuminance(...rgb1), l2 = relativeLuminance(...rgb2);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ===== IDB 存储 =====
const store = createIdbStore('color-palette', 'kv');

// 渐变预设库（50+）：名称 -> 颜色数组（5-10色）
const gradientPresets: Record<string, string[]> = {
  'Ocean': ['#0077be', '#00a8e8', '#00d2ff', '#73e7ff', '#a6e1fa'],
  'Sunset': ['#ff512f', '#dd2476', '#ff7a5a', '#ffb86c', '#ff9a8b'],
  'Fruit': ['#ff6b6b', '#ffa502', '#ffca28', '#ffe082', '#ffab91'],
  'Forest': ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'],
  'Lavender': ['#7b68ee', '#9370db', '#ba55d3', '#da70d6', '#ee82ee'],
  'Mint': ['#00b894', '#00cec9', '#81ecec', '#a2d9ce', '#55efc4'],
  'Berry': ['#8e44ad', '#9b59b6', '#c0392b', '#e74c3c', '#fd79a8'],
  'Monochrome': ['#2d3436', '#636e72', '#b2bec3', '#dfe6e9', '#ffffff'],
};

let h = 210, s = 80, l = 55;
let recentColors: string[] = [];
let savedPreset = '';

async function loadData(): Promise<void> {
  try {
    const rec = await store.get('recentColors');
    if (rec) recentColors = rec as string[];
    const preset = await store.get('selectedPreset');
    if (preset) savedPreset = preset as string;
  } catch (e) { console.error('IDB load error', e); }
}

async function saveRecent(hex: string): Promise<void> {
  recentColors = [hex, ...recentColors.filter(c => c !== hex)].slice(0, 12);
  try { await store.set('recentColors', recentColors); } catch (e) { console.error('IDB save error', e); }
}

async function savePreset(name: string): Promise<void> {
  try { await store.set('selectedPreset', name); } catch (e) { console.error('IDB save error', e); }
}

loadData();

function getScheme(type: string): string[] {
  const schemes: Record<string, number[]> = {
    complementary: [180],
    analogous: [-30, 30],
    triadic: [120, 240],
    'split-complementary': [150, 210],
  };
  const offsets = schemes[type] || [];
  return offsets.map(off => {
    const nh = (h + off + 360) % 360;
    const [r, g, b] = hslToRgb(nh, s, l);
    return rgbToHex(r, g, b);
  });
}

function generateGradient(steps: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < steps; i++) {
    const tl = 10 + (80 * i / (steps - 1));
    const [r, g, b] = hslToRgb(h, s, Math.round(tl));
    colors.push(rgbToHex(r, g, b));
  }
  return colors;
}

const app = document.getElementById('app')!;

function render(): void {
  const [r, g, b] = hslToRgb(h, s, l);
  const hex = rgbToHex(r, g, b);

  const whiteContrast = contrastRatio([r, g, b], [255, 255, 255]);
  const blackContrast = contrastRatio([r, g, b], [0, 0, 0]);
  const wcagWhite = whiteContrast >= 7 ? 'AAA' : whiteContrast >= 4.5 ? 'AA' : 'Fail';
  const wcagBlack = blackContrast >= 7 ? 'AAA' : blackContrast >= 4.5 ? 'AA' : 'Fail';

  const gradient = generateGradient(8);

  // 预设选项
  const presetNames = Object.keys(gradientPresets);

  app.innerHTML = `<div class="cp-wrapper">
    <h1 class="cp-title">🎨 Color Palette</h1>
    <div class="cp-layout">
      <div class="cp-left">
        <canvas id="cp-wheel" width="220" height="220"></canvas>
        <div class="cp-sliders">
          <label>H <input type="range" id="cp-h" min="0" max="360" value="${h}"></label>
          <label>S <input type="range" id="cp-s" min="0" max="100" value="${s}"></label>
          <label>L <input type="range" id="cp-l" min="0" max="100" value="${l}"></label>
        </div>
        <div class="cp-preview" style="background:${hex}">
          <span class="cp-preview-text" style="color:${whiteContrast > blackContrast ? '#fff' : '#000'}">${hex}</span>
        </div>
      </div>
      <div class="cp-right">
        <div class="cp-values">
          <div class="cp-val-row"><label>HEX</label><input id="cp-hex" class="cp-input" value="${hex}"><button class="cp-btn small" data-copy="${hex}">复制</button></div>
          <div class="cp-val-row"><label>RGB</label><input class="cp-input" value="rgb(${r}, ${g}, ${b})" readonly><button class="cp-btn small" data-copy="rgb(${r}, ${g}, ${b})">复制</button></div>
          <div class="cp-val-row"><label>HSL</label><input class="cp-input" value="hsl(${h}, ${s}%, ${l}%)" readonly><button class="cp-btn small" data-copy="hsl(${h}, ${s}%, ${l}%)">复制</button></div>
        </div>
        <div class="cp-section">
          <h3>配色方案</h3>
          <div class="cp-scheme-btns">
            ${['complementary','analogous','triadic','split-complementary'].map(t => `<button class="cp-btn scheme-btn" data-scheme="${t}">${t}</button>`).join('')}
          </div>
          <div id="cp-scheme-colors" class="cp-scheme-row"></div>
        </div>
        <div class="cp-section">
          <h3>渐变色阶</h3>
          <div class="cp-gradient">${gradient.map(c => `<div class="cp-gblock" style="background:${c}" title="${c}"></div>`).join('')}</div>
        </div>
        <div class="cp-section">
          <h3>预设库</h3>
          <select id="cp-preset-select" class="cp-select">
            <option value="">选择预设...</option>
            ${presetNames.map(name => `<option value="${name}"${savedPreset===name?' selected':''}>${name}</option>`).join('')}
          </select>
          <button class="cp-btn" id="cp-apply-preset">应用</button>
          <div id="cp-preset-colors" class="cp-scheme-row" style="margin-top:8px"></div>
        </div>
        <div class="cp-section">
          <h3>WCAG 对比度</h3>
          <div class="cp-contrast">
            <div class="cp-contrast-item"><span style="background:#fff;color:${hex};padding:4px 12px;border-radius:4px;">白底</span> ${whiteContrast.toFixed(2)}:1 <span class="cp-wcag ${wcagWhite.toLowerCase()}">${wcagWhite}</span></div>
            <div class="cp-contrast-item"><span style="background:#000;color:${hex};padding:4px 12px;border-radius:4px;">黑底</span> ${blackContrast.toFixed(2)}:1 <span class="cp-wcag ${wcagBlack.toLowerCase()}">${wcagBlack}</span></div>
          </div>
        </div>
        <div class="cp-section">
          <h3>导出</h3>
          <div class="cp-export-btns">
            <button class="cp-btn" id="cp-export-css">CSS 变量</button>
            <button class="cp-btn" id="cp-export-scss">SCSS 变量</button>
          </div>
        </div>
        <div class="cp-section">
          <h3>最近使用</h3>
          <div class="cp-recent">${recentColors.map(c => `<div class="cp-rblock" style="background:${c}" data-color="${c}" title="${c}"></div>`).join('') || '<span class="cp-empty">暂无</span>'}</div>
        </div>
      </div>
    </div>
  </div>`;

  drawWheel();
  bindEvents();
}

function drawWheel(): void {
  const canvas = document.getElementById('cp-wheel') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const cx = 110, cy = 110, radius = 100;

  for (let angle = 0; angle < 360; angle += 1) {
    const startRad = (angle - 1) * Math.PI / 180;
    const endRad = (angle + 1) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startRad, endRad);
    ctx.closePath();
    const [r, g, b] = hslToRgb(angle, s, l);
    ctx.fillStyle = rgbToHex(r, g, b);
    ctx.fill();
  }

  // 指示器
  const indicatorAngle = h * Math.PI / 180;
  const ix = cx + Math.cos(indicatorAngle) * radius * 0.8;
  const iy = cy + Math.sin(indicatorAngle) * radius * 0.8;
  ctx.beginPath();
  ctx.arc(ix, iy, 8, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bindEvents(): void {
  document.getElementById('cp-h')?.addEventListener('input', (e) => { h = parseInt((e.target as HTMLInputElement).value, 10); render(); });
  document.getElementById('cp-s')?.addEventListener('input', (e) => { s = parseInt((e.target as HTMLInputElement).value, 10); render(); });
  document.getElementById('cp-l')?.addEventListener('input', (e) => { l = parseInt((e.target as HTMLInputElement).value, 10); render(); });

  document.getElementById('cp-hex')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLInputElement).value;
    const rgb = hexToRgb(val);
    if (rgb) { [h, s, l] = rgbToHsl(...rgb); saveRecent(val); render(); }
  });

  document.querySelectorAll('[data-copy]').forEach(el => {
    el.addEventListener('click', () => {
      const text = (el as HTMLElement).dataset.copy!;
      navigator.clipboard.writeText(text).then(() => {
        (el as HTMLButtonElement).textContent = '✅';
        setTimeout(() => { (el as HTMLButtonElement).textContent = '复制'; }, 1000);
      });
    });
  });

  document.querySelectorAll('[data-scheme]').forEach(el => {
    el.addEventListener('click', () => {
      const type = (el as HTMLElement).dataset.scheme!;
      const colors = [rgbToHex(...hslToRgb(h, s, l)), ...getScheme(type)];
      const row = document.getElementById('cp-scheme-colors');
      if (row) row.innerHTML = colors.map(c => `<div class="cp-sblock" style="background:${c}" data-color="${c}" title="${c}"></div>`).join('');
    });
  });

  // 点击色轮
  const wheel = document.getElementById('cp-wheel');
  wheel?.addEventListener('click', (e) => {
    const rect = wheel.getBoundingClientRect();
    const x = e.clientX - rect.left - 110;
    const y = e.clientY - rect.top - 110;
    const dist = Math.sqrt(x * x + y * y);
    if (dist <= 100) {
      h = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      h = Math.round(h);
      const hex = rgbToHex(...hslToRgb(h, s, l));
      saveRecent(hex);
      render();
    }
  });

  document.getElementById('cp-export-css')?.addEventListener('click', () => {
    const hex = rgbToHex(...hslToRgb(h, s, l));
    navigator.clipboard.writeText(`:root {\n  --primary: ${hex};\n  --primary-rgb: ${hslToRgb(h, s, l).join(', ')};\n}`);
  });

  document.getElementById('cp-export-scss')?.addEventListener('click', () => {
    const hex = rgbToHex(...hslToRgb(h, s, l));
    navigator.clipboard.writeText(`$primary: ${hex};\n$primary-hsl: hsl(${h}, ${s}%, ${l}%);`);
  });

  document.querySelectorAll('[data-color]').forEach(el => {
    el.addEventListener('click', () => {
      const hex = (el as HTMLElement).dataset.color!;
      const rgb = hexToRgb(hex);
      if (rgb) { [h, s, l] = rgbToHsl(...rgb); render(); }
    });
  });

  // 预设库交互
  const presetSelect = document.getElementById('cp-preset-select') as HTMLSelectElement | null;
  const applyPresetBtn = document.getElementById('cp-apply-preset') as HTMLButtonElement | null;
  const presetColorsDiv = document.getElementById('cp-preset-colors');

  const updatePresetDisplay = () => {
    if (!presetSelect || !presetColorsDiv) return;
    const name = presetSelect.value;
    if (name && gradientPresets[name]) {
      presetColorsDiv.innerHTML = gradientPresets[name].map(c => `<div class="cp-pblock" style="background:${c}" title="${c}"></div>`).join('');
    } else {
      presetColorsDiv.innerHTML = '';
    }
  };

  presetSelect?.addEventListener('change', async () => {
    updatePresetDisplay();
    const name = presetSelect.value;
    if (name) await savePreset(name);
  });

  applyPresetBtn?.addEventListener('click', async () => {
    const name = presetSelect?.value;
    if (name && gradientPresets[name]) {
      const hex = gradientPresets[name][0];
      const rgb = hexToRgb(hex);
      if (rgb) {
        [h, s, l] = rgbToHsl(...rgb);
        await savePreset(name);
        savedPreset = name;
        render();
      }
    }
  });
}

// 扩充预设库至 50+
(function() {
  const presets = gradientPresets;
  const hueNames = ['Red','Orange','Yellow','Lime','Green','Aqua','Cyan','Azure','Blue','Indigo','Violet','Magenta'];
  const hues = [0,30,60,90,120,150,180,210,240,270,300,330];
  hues.forEach((h,i) => {
    const base = hueNames[i];
    // Hue gradient
    const colors: string[] = [];
    for (let s = 80; s >= 30; s -= 10) {
      const [r,g,b] = hslToRgb(h, s, 55);
      colors.push(rgbToHex(r,g,b));
    }
    presets[`${base} Hue`] = colors;
    // Soft
    const soft: string[] = [];
    for (let off = -20; off <= 20; off += 10) {
      const [r,g,b] = hslToRgb((h+off+360)%360, 65, 60);
      soft.push(rgbToHex(r,g,b));
    }
    presets[`${base} Soft`] = soft;
    // Triad
    const triad: string[] = [];
    [0,120,240].forEach(off => {
      const [r,g,b] = hslToRgb((h+off)%360, 75, 50);
      triad.push(rgbToHex(r,g,b));
    });
    presets[`${base} Triad`] = triad;
  });
  // Earth tones
  const earthHues = [30,45,60,90,120,150];
  for (let i = 0; i < 6; i++) {
    const colors: string[] = [];
    const baseH = earthHues[i];
    for (let s = 40; s <= 70; s += 10) {
      for (let l = 30; l <= 70; l += 20) {
        if (colors.length >= 6) break;
        const [r,g,b] = hslToRgb(baseH, s, l);
        colors.push(rgbToHex(r,g,b));
      }
    }
    presets[`Earth ${i+1}`] = colors.slice(0,5);
  }
  // Greyscale
  const greys: string[] = [];
  for (let l = 10; l <= 90; l += 16) {
    greys.push(rgbToHex(l,l,l));
  }
  presets['Greyscale'] = greys;
})();

render();
