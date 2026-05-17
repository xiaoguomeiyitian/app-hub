import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'BMI Calculator';
const APP_VERSION = '1.3.0';
const APP_DESC = '身体质量指数(BMI)计算器，支持公制/英制';

interface Record { date: string; bmi: number; weight: number; height: number; }
let theme: 'light' | 'dark' = (localStorage.getItem('bmi_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('bmi_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  records = []; weight = 70; height = 170; unit = 'metric';
  localStorage.clear();
  localStorage.setItem('bmi_theme', theme);
  save(records); render();
}

function exportData(): void {
  const data = { records, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bmi-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.records && Array.isArray(data.records)) {
        records = data.records;
        save(records); render();
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

function load(): Record[] { try { return JSON.parse(localStorage.getItem('bmi-calculator') || '[]'); } catch { return []; } }
function save(r: Record[]): void { localStorage.setItem('bmi-calculator', JSON.stringify(r)); }

let records = load();
let height = 170;
let weight = 70;
let unit: 'metric' | 'imperial' = 'metric';

function calcBMI(h: number, w: number): number {
  const hm = unit === 'imperial' ? h * 0.0254 : h / 100;
  const wm = unit === 'imperial' ? w * 0.453592 : w;
  return wm / (hm * hm);
}

function getCategory(bmi: number): { label: string; color: string; range: string } {
  if (bmi < 18.5) return { label: '偏瘦', color: '#58a6ff', range: '< 18.5' };
  if (bmi < 24) return { label: '正常', color: '#3fb950', range: '18.5 - 24' };
  if (bmi < 28) return { label: '超重', color: '#d29922', range: '24 - 28' };
  return { label: '肥胖', color: '#f85149', range: '≥ 28' };
}

function render(): void {
  applyTheme();
  const bmi = calcBMI(height, weight);
  const cat = getCategory(bmi);
  const minW = (unit === 'imperial' ? height * 0.0254 : height / 100) ** 2 * 18.5 * (unit === 'imperial' ? 2.20462 : 1);
  const maxW = (unit === 'imperial' ? height * 0.0254 : height / 100) ** 2 * 24 * (unit === 'imperial' ? 2.20462 : 1);

  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">⚖️</span><span class="title">BMI Calculator</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="bmi-result">
        <div class="bmi-value" style="color:${cat.color}">${bmi.toFixed(1)}</div>
        <div class="bmi-category" style="color:${cat.color}">${cat.label} (${cat.range})</div>
      </div>
      <div class="controls">
        <label>身高 (${unit === 'metric' ? 'cm' : 'in'}): <input type="range" id="height-slider" min="${unit === 'metric' ? 100 : 36}" max="${unit === 'metric' ? 250 : 96}" value="${height}"/> ${height}</label>
        <label>体重 (${unit === 'metric' ? 'kg' : 'lb'}): <input type="range" id="weight-slider" min="${unit === 'metric' ? 30 : 66}" max="${unit === 'metric' ? 200 : 440}" value="${weight}"/> ${weight}</label>
        <label><input type="checkbox" id="unit-toggle" ${unit === 'imperial' ? 'checked' : ''}/> 英制单位</label>
        <button class="btn-sm" id="save-btn">💾 保存记录</button>
      </div>
      ${records.length > 0 ? `
        <div class="history">
          <div class="history-header">历史记录</div>
          ${records.slice(0, 5).map(r => `
            <div class="hist-item">${r.date}: BMI ${r.bmi.toFixed(1)} (${r.weight}${unit === 'metric' ? 'kg' : 'lb'})</div>
          `).join('')}
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

  document.getElementById('height-slider')?.addEventListener('input', (e) => { height = +(e.target as HTMLInputElement).value; render(); });
  document.getElementById('weight-slider')?.addEventListener('input', (e) => { weight = +(e.target as HTMLInputElement).value; render(); });
  document.getElementById('unit-toggle')?.addEventListener('change', (e) => {
    unit = (e.target as HTMLInputElement).checked ? 'imperial' : 'metric';
    render();
  });
  document.getElementById('save-btn')?.addEventListener('click', () => {
    records.unshift({ date: new Date().toISOString().slice(0, 10), bmi: calcBMI(height, weight), weight, height });
    save(records); render();
  });
}

render();
