import './style.css';
import '@app-hub/utils/theme/variables.css';

interface Stop { color: string; pos: number }

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 180) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}


// 大型预设库（50+ 渐变色）
const GRADIENT_PRESETS: Record<string, Stop[]> = {
  'Ocean Breeze': [{color:'#2196f3',pos:0},{color:'#21cbf3',pos:100}],
  'Sunset Glow': [{color:'#ff512f',pos:0},{color:'#dd2476',pos:100}],
  'Cotton Candy': [{color:'#f8b500',pos:0},{color:'#fceabb',pos:100}],
  'Royal Purple': [{color:'#8e44ad',pos:0},{color:'#c0392b',pos:100}],
  'Northern Lights': [{color:'#00c6ff',pos:0},{color:'#0072ff',pos:100}],
  'Berry Smoothie': [{color:'#8e44ad',pos:0},{color:'#ff6b6b',pos:100}],
  'Forest Walk': [{color:'#11998e',pos:0},{color:'#38ef7d',pos:100}],
  'Citrus Zest': [{color:'#f7971e',pos:0},{color:'#ffd200',pos:100}],
  'Deep Blue Sea': [{color:'#003973',pos:0},{color:'#e5e5be',pos:100}],
  'Cherry Blossom': [{color:'#ff758c',pos:0},{color:'#ff7eb3',pos:100}],
  'Lavender Dream': [{color:'#a18cd1',pos:0},{color:'#fbc2eb',pos:100}],
  'Minty Fresh': [{color:'#84fab0',pos:0},{color:'#8fd3f4',pos:100}],
  'Chocolate': [{color:'#964e4e',pos:0},{color:'#c0392b',pos:100}],
  'Tropical Beach': [{color:'#00b4db',pos:0},{color:'#0083b0',pos:100}],
  'Cosmic': [{color:'#2E3192',pos:0},{color:'#1BFFFF',pos:100}],
  'Neon Glow': [{color:'#f12711',pos:0},{color:'#f5af19',pos:100}],
  'Autumn Maple': [{color:'#c94b4b',pos:0},{color:'#e8b86d',pos:100}],
  'Mountain Mist': [{color:'#606c88',pos:0},{color:'#3f4c6b',pos:100}],
  'Rose Quartz': [{color:'#f8a5c2',pos:0},{color:'#f6d365',pos:100}],
  'Electric Violet': [{color:'#8e2de2',pos:0},{color:'#4a00e0',pos:100}],
};

// Extend presets to 50+
(() => {
  const extra: Record<string, Stop[]> = {};
  const hues = [0,30,60,90,120,150,180,210,240,270,300,330];
  const names = ['Red','Orange','Yellow','Lime','Green','Aqua','Cyan','Azure','Blue','Indigo','Violet','Magenta'];
  hues.forEach((h,i) => {
    const base = names[i];
    const c1 = hslToHex(h, 80, 50);
    const c2 = hslToHex(h, 60, 60);
    const c3 = hslToHex(h, 40, 70);
    extra[`${base} Glow`] = [{color:c1,pos:0},{color:c2,pos:50},{color:c3,pos:100}];
    extra[`${base} Dual`] = [{color:c1,pos:0},{color:c3,pos:100}];
  });
  const earthH = [30,45,60,90,120,150];
  earthH.forEach((h,i) => {
    const c1 = hslToHex(h, 60, 40);
    const c2 = hslToHex(h, 50, 60);
    extra[`Earth ${i+1}`] = [{color:c1,pos:0},{color:c2,pos:100}];
  });
  const pastelH = [340,30,60,180,220,260];
  pastelH.forEach((h,i) => {
    const c1 = hslToHex(h, 70, 85);
    const c2 = hslToHex(h, 60, 95);
    extra[`Pastel ${i+1}`] = [{color:c1,pos:0},{color:c2,pos:100}];
  });
  const neonH = [300,330,60,120,180];
  neonH.forEach((h,i) => {
    const c1 = hslToHex(h, 100, 45);
    const c2 = hslToHex(h, 90, 55);
    extra[`Neon ${i+1}`] = [{color:c1,pos:0},{color:c2,pos:100}];
  });
  const greys: Stop[] = [];
  for (let l = 15; l <= 85; l+=14) {
    const hex = rgbToHex(l,l,l);
    greys.push({color:hex, pos: l});
  }
  extra['Greyscale'] = greys;
  // Merge into main
  Object.assign(GRADIENT_PRESETS, extra);
})();

let stops: Stop[] = [{ color: '#667eea', pos: 0 }, { color: '#764ba2', pos: 100 }];
let angle = 90;
let type: 'linear' | 'radial' = 'linear';

function gradientCSS(): string {
  const stopsStr = stops.sort((a, b) => a.pos - b.pos).map(s => `${s.color} ${s.pos}%`).join(', ');
  return type === 'linear'
    ? `linear-gradient(${angle}deg, ${stopsStr})`
    : `radial-gradient(circle, ${stopsStr})`;
}

function render() {
  const app = document.getElementById('app')!;
  const presetNames = Object.keys(GRADIENT_PRESETS);
  app.innerHTML = `
    <h1>🎨 渐变色生成器（增强）</h1>
    <div class="preview" style="background:${gradientCSS()}"></div>
    <div class="controls">
      <select id="type">
        <option value="linear" ${type==='linear'?'selected':''}>线性</option>
        <option value="radial" ${type==='radial'?'selected':''}>径向</option>
      </select>
      ${type==='linear'?`<label>角度: <input type="range" id="angle" min="0" max="360" value="${angle}"/> ${angle}°</label>`:''}
    </div>
    <div class="stop-list" id="stops">
      ${stops.map((s,i) => `
        <div class="stop-item">
          <input type="color" data-i="${i}" class="stop-color" value="${s.color}"/>
          <input type="range" data-i="${i}" class="stop-pos" min="0" max="100" value="${s.pos}"/> ${s.pos}%
          ${stops.length>2?`<button class="remove" data-i="${i}">×</button>`:''}
        </div>
      `).join('')}
    </div>
    <div class="actions">
      <button class="btn" id="addStop">+ 添加色标</button>
      <button class="btn" id="random">🎲 随机生成</button>
      <button class="btn primary" id="copy">📋 复制 CSS</button>
      <button class="btn" id="export-json">💾 导出 JSON</button>
    </div>
    <div class="code-block">${gradientCSS()}</div>
    <div class="presets">
      <h4>预设库</h4>
      <select id="preset-select">
        <option value="">选择预设...</option>
        ${presetNames.map(n => `<option value="${n}">${n}</option>`).join('')}
      </select>
    </div>
  `;

  document.getElementById('type')!.addEventListener('change', e => {
    type = (e.target as HTMLSelectElement).value as any;
    render();
  });

  const angleEl = document.getElementById('angle') as HTMLInputElement | null;
  if (angleEl) angleEl.addEventListener('input', e => {
    angle = +(e.target as HTMLInputElement).value;
    render();
  });

  document.querySelectorAll('.stop-color').forEach(el => {
    el.addEventListener('input', e => {
      const i = +(e.target as HTMLElement).dataset.i!;
      stops[i].color = (e.target as HTMLInputElement).value;
      render();
    });
  });

  document.querySelectorAll('.stop-pos').forEach(el => {
    el.addEventListener('input', e => {
      const i = +(e.target as HTMLElement).dataset.i!;
      stops[i].pos = +(e.target as HTMLInputElement).value;
      render();
    });
  });

  document.querySelectorAll('.remove').forEach(el => {
    el.addEventListener('click', e => {
      const i = +(e.target as HTMLElement).dataset.i!;
      stops.splice(i, 1);
      render();
    });
  });

  document.getElementById('addStop')!.addEventListener('click', () => {
    const r = () => Math.floor(Math.random()*256).toString(16).padStart(2,'0');
    stops.push({ color: `#${r()}${r()}${r()}`, pos: 50 });
    render();
  });

  document.getElementById('random')!.addEventListener('click', () => {
    const r = () => Math.floor(Math.random()*256).toString(16).padStart(2,'0');
    const n = 2 + Math.floor(Math.random()*3);
    stops = Array.from({length:n}, () => ({ color: `#${r()}${r()}${r()}`, pos: Math.floor(Math.random()*101) }));
    angle = Math.floor(Math.random()*360);
    render();
  });

  document.getElementById('copy')!.addEventListener('click', () => {
    const css = gradientCSS();
    navigator.clipboard.writeText(css).then(() => {
      const t = document.createElement('div');
      t.className = 'toast show';
      t.textContent = '已复制到剪贴板！';
      document.body.appendChild(t);
      setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1500);
    });
  });

  document.getElementById('export-json')!.addEventListener('click', () => {
    const data = { stops, angle, type };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gradient.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('preset-select')!.addEventListener('change', async (e) => {
    const name = (e.target as HTMLSelectElement).value;
    if (name && GRADIENT_PRESETS[name]) {
      stops = JSON.parse(JSON.stringify(GRADIENT_PRESETS[name]));
      render();
    }
  });
}

render();

// Extend presets to reach 50+
(function() {
  // Helpers (already defined earlier, but re-declare if missing)
  if (typeof hslToHex !== 'function') {
    function hslToHex(h: number, s: number, l: number): string {
      s /= 100; l /= 100;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h / 180) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      };
      const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
      return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
    }
    (window as any).hslToHex = hslToHex; // temporary global for this script
  }
  if (typeof rgbToHex !== 'function') {
    function rgbToHex(r: number, g: number, b: number): string {
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }
    (window as any).rgbToHex = rgbToHex;
  }
  const extra: Record<string, Stop[]> = {};
  const hues = [0,30,60,90,120,150,180,210,240,270,300,330];
  const names = ['Red','Orange','Yellow','Lime','Green','Aqua','Cyan','Azure','Blue','Indigo','Violet','Magenta'];
  hues.forEach((h,i) => {
    const base = names[i];
    const c1 = (window as any).hslToHex(h, 80, 50);
    const c2 = (window as any).hslToHex(h, 60, 60);
    const c3 = (window as any).hslToHex(h, 40, 70);
    extra[base + ' Glow'] = [{color:c1,pos:0},{color:c2,pos:50},{color:c3,pos:100}];
    extra[base + ' Dual'] = [{color:c1,pos:0},{color:c3,pos:100}];
  });
  const earthH = [30,45,60,90,120,150];
  earthH.forEach((h,i) => {
    const c1 = (window as any).hslToHex(h, 60, 40);
    const c2 = (window as any).hslToHex(h, 50, 60);
    extra['Earth ' + (i+1)] = [{color:c1,pos:0},{color:c2,pos:100}];
  });
  const pastelH = [340,30,60,180,220,260];
  pastelH.forEach((h,i) => {
    const c1 = (window as any).hslToHex(h, 70, 85);
    const c2 = (window as any).hslToHex(h, 60, 95);
    extra['Pastel ' + (i+1)] = [{color:c1,pos:0},{color:c2,pos:100}];
  });
  const neonH = [300,330,60,120,180];
  neonH.forEach((h,i) => {
    const c1 = (window as any).hslToHex(h, 100, 45);
    const c2 = (window as any).hslToHex(h, 90, 55);
    extra['Neon ' + (i+1)] = [{color:c1,pos:0},{color:c2,pos:100}];
  });
  const greys: Stop[] = [];
  for (let l = 15; l <= 85; l+=14) {
    greys.push({color: (window as any).rgbToHex(l,l,l), pos: l});
  }
  extra['Greyscale'] = greys;
  Object.assign(GRADIENT_PRESETS, extra);
})();
