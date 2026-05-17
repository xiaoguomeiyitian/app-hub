import '@app-hub/design-system/src/style.css';
import './style.css';

interface UnitDef { name: string; toBase: number; }
interface CategoryDef { name: string; icon: string; base: string; units: Record<string, UnitDef>; }

const categories: Record<string, CategoryDef> = {
  length: {
    name: '长度', icon: '📏', base: 'm',
    units: {
      mm: { name: '毫米', toBase: 0.001 },
      cm: { name: '厘米', toBase: 0.01 },
      m: { name: '米', toBase: 1 },
      km: { name: '千米', toBase: 1000 },
      in: { name: '英寸', toBase: 0.0254 },
      ft: { name: '英尺', toBase: 0.3048 },
      yd: { name: '码', toBase: 0.9144 },
      mi: { name: '英里', toBase: 1609.344 },
    }
  },
  weight: {
    name: '重量', icon: '⚖️', base: 'kg',
    units: {
      mg: { name: '毫克', toBase: 0.000001 },
      g: { name: '克', toBase: 0.001 },
      kg: { name: '千克', toBase: 1 },
      t: { name: '吨', toBase: 1000 },
      oz: { name: '盎司', toBase: 0.0283495 },
      lb: { name: '磅', toBase: 0.453592 },
    }
  },
  temperature: {
    name: '温度', icon: '🌡️', base: 'c',
    units: {
      c: { name: '摄氏度', toBase: 1 },
      f: { name: '华氏度', toBase: 1 },
      k: { name: '开尔文', toBase: 1 },
    }
  },
  area: {
    name: '面积', icon: '📐', base: 'm2',
    units: {
      mm2: { name: '平方毫米', toBase: 0.000001 },
      cm2: { name: '平方厘米', toBase: 0.0001 },
      m2: { name: '平方米', toBase: 1 },
      km2: { name: '平方千米', toBase: 1000000 },
      ha: { name: '公顷', toBase: 10000 },
      in2: { name: '平方英寸', toBase: 0.00064516 },
      ft2: { name: '平方英尺', toBase: 0.092903 },
      ac: { name: '英亩', toBase: 4046.86 },
    }
  },
  volume: {
    name: '体积', icon: '🧊', base: 'l',
    units: {
      ml: { name: '毫升', toBase: 0.001 },
      l: { name: '升', toBase: 1 },
      m3: { name: '立方米', toBase: 1000 },
      gal: { name: '加仑', toBase: 3.78541 },
      qt: { name: '夸脱', toBase: 0.946353 },
      pt: { name: '品脱', toBase: 0.473176 },
      cup: { name: '杯', toBase: 0.236588 },
      floz: { name: '液量盎司', toBase: 0.0295735 },
    }
  },
  speed: {
    name: '速度', icon: '🚀', base: 'ms',
    units: {
      ms: { name: '米/秒', toBase: 1 },
      kmh: { name: '千米/时', toBase: 0.277778 },
      mph: { name: '英里/时', toBase: 0.44704 },
      kn: { name: '节', toBase: 0.514444 },
      mach: { name: '马赫', toBase: 343 },
    }
  },
  data: {
    name: '数据量', icon: '💾', base: 'B',
    units: {
      b: { name: '位', toBase: 0.125 },
      B: { name: '字节', toBase: 1 },
      KB: { name: 'KB', toBase: 1024 },
      MB: { name: 'MB', toBase: 1048576 },
      GB: { name: 'GB', toBase: 1073741824 },
      TB: { name: 'TB', toBase: 1099511627776 },
    }
  },
};

let activeCategory = 'length';
let fromUnit = 'm';
let toUnit = 'km';
let inputValue = '1';

function convertTemp(val: number, from: string, to: string): number {
  let c: number;
  if (from === 'c') c = val;
  else if (from === 'f') c = (val - 32) * 5 / 9;
  else c = val - 273.15;
  if (to === 'c') return c;
  if (to === 'f') return c * 9 / 5 + 32;
  return c + 273.15;
}

function convert(cat: string, val: number, from: string, to: string): number {
  if (cat === 'temperature') return convertTemp(val, from, to);
  const c = categories[cat];
  return val * c.units[from].toBase / c.units[to].toBase;
}

function formatNum(n: number): string {
  if (n === 0) return '0';
  if (Math.abs(n) >= 1e15 || (Math.abs(n) < 0.0001 && n !== 0)) return n.toExponential(6);
  const s = n.toPrecision(10);
  return parseFloat(s).toString();
}

function render(): void {
  const cat = categories[activeCategory];
  const val = parseFloat(inputValue) || 0;
  const result = convert(activeCategory, val, fromUnit, toUnit);
  const app = document.getElementById('app')!;

  app.innerHTML = `
  <div class="app">
    <header class="header"><span class="logo">📐</span><span class="title">Unit Converter</span></header>
    <main class="main">
      <div class="categories">
        ${Object.entries(categories).map(([k, c]) => `
          <button class="cat-btn ${k === activeCategory ? 'active' : ''}" data-cat="${k}">
            <span>${c.icon}</span><span>${c.name}</span>
          </button>
        `).join('')}
      </div>
      <div class="converter">
        <div class="convert-row">
          <div class="unit-side">
            <select id="from-unit" class="unit-select">
              ${Object.entries(cat.units).map(([k, u]) => `<option value="${k}" ${k === fromUnit ? 'selected' : ''}>${u.name} (${k})</option>`).join('')}
            </select>
            <input type="number" id="from-value" class="value-input" value="${inputValue}" step="any" />
          </div>
          <button class="swap-btn" id="swap-btn">⇄</button>
          <div class="unit-side">
            <select id="to-unit" class="unit-select">
              ${Object.entries(cat.units).map(([k, u]) => `<option value="${k}" ${k === toUnit ? 'selected' : ''}>${u.name} (${k})</option>`).join('')}
            </select>
            <div class="result-display" id="result">${formatNum(result)}</div>
            <button class="copy-btn" id="copy-result" data-val="${formatNum(result)}">📋 Copy</button>
          </div>
        </div>
        <div class="all-results">
          <h3>All Conversions</h3>
          <div class="results-grid">
            ${Object.entries(cat.units).map(([k, u]) => {
              const r = convert(activeCategory, val, fromUnit, k);
              return `<div class="result-card ${k === toUnit ? 'highlight' : ''}" data-to="${k}">
                <div class="result-val">${formatNum(r)}</div>
                <div class="result-label">${u.name} (${k})</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </main>
  </div>`;

  bindEvents();
}

function bindEvents(): void {
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = (btn as HTMLElement).dataset.cat!;
      const cat = categories[activeCategory];
      fromUnit = Object.keys(cat.units)[0];
      toUnit = Object.keys(cat.units)[Math.min(1, Object.keys(cat.units).length - 1)];
      inputValue = '1';
      render();
    });
  });

  document.getElementById('from-unit')!.addEventListener('change', (e) => {
    fromUnit = (e.target as HTMLSelectElement).value;
    render();
  });

  document.getElementById('to-unit')!.addEventListener('change', (e) => {
    toUnit = (e.target as HTMLSelectElement).value;
    render();
  });

  document.getElementById('from-value')!.addEventListener('input', (e) => {
    inputValue = (e.target as HTMLInputElement).value;
    const val = parseFloat(inputValue) || 0;
    const result = convert(activeCategory, val, fromUnit, toUnit);
    const resultEl = document.getElementById('result')!;
    resultEl.textContent = formatNum(result);
  });

  document.getElementById('swap-btn')!.addEventListener('click', () => {
    [fromUnit, toUnit] = [toUnit, fromUnit];
    render();
  });

  document.getElementById('copy-result')!.addEventListener('click', () => {
    const val = document.getElementById('result')!.textContent!;
    navigator.clipboard.writeText(val);
    const btn = document.getElementById('copy-result')!;
    btn.textContent = '✓ Copied';
    setTimeout(() => btn.textContent = '📋 Copy', 800);
  });

  document.querySelectorAll('.result-card').forEach(card => {
    card.addEventListener('click', () => {
      toUnit = (card as HTMLElement).dataset.to!;
      render();
    });
  });
}

render();
