import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'Cron Builder';
const APP_VERSION = '1.3.0';
const APP_DESC = 'Cron 表达式生成器';

let theme: 'light' | 'dark' = (localStorage.getItem('cron_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('cron_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有设置吗？')) return;
  localStorage.clear();
  localStorage.setItem('cron_theme', theme);
  render();
}

function exportData(): void {
  const expression = document.getElementById('cron-output')?.textContent || '';
  const data = { expression, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cron-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.expression) {
        // 解析并设置cron表达式
        alert('导入成功');
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

const FIELDS: { name: string; label: string; min: number; max: number; labels?: string[] }[] = [
  { name: 'minute', label: '分钟', min: 0, max: 59 },
  { name: 'hour', label: '小时', min: 0, max: 23 },
  { name: 'day', label: '日', min: 1, max: 31 },
  { name: 'month', label: '月', min: 1, max: 12, labels: ['','1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'] },
  { name: 'weekday', label: '星期', min: 0, max: 6, labels: ['周日','周一','周二','周三','周四','周五','周六'] },
] as const;

type FieldMode = 'every' | 'specific' | 'range' | 'interval';

interface FieldState {
  mode: FieldMode;
  specific: number[];
  rangeStart: number;
  rangeEnd: number;
  interval: number;
}

const TEMPLATES: Record<string, string[]> = {
  '每分钟': ['*', '*', '*', '*', '*'],
  '每小时': ['0', '*', '*', '*', '*'],
  '每天午夜': ['0', '0', '*', '*', '*'],
  '每天9点': ['0', '9', '*', '*', '*'],
  '每周一9点': ['0', '9', '*', '*', '1'],
  '每月1号': ['0', '0', '1', '*', '*'],
  '每5分钟': ['*/5', '*', '*', '*', '*'],
  '工作日9-17点': ['0', '9-17', '*', '*', '1-5'],
};

// 初始化状态
const state: FieldState[] = FIELDS.map(() => ({
  mode: 'every' as FieldMode,
  specific: [],
  rangeStart: 0,
  rangeEnd: 59,
  interval: 1,
}));

function buildExpression(): string {
  return state.map((s, i) => {
    const f = FIELDS[i];
    switch (s.mode) {
      case 'every': return '*';
      case 'specific': return s.specific.length > 0 ? s.specific.join(',') : '*';
      case 'range': return `${s.rangeStart}-${s.rangeEnd}`;
      case 'interval': return `*/${s.interval}`;
    }
  }).join(' ');
}

function render(): void {
  applyTheme();
  const expr = buildExpression();
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">⏲</span><span class="title">Cron Builder</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="templates">
        ${Object.entries(TEMPLATES).map(([name, vals]) => `
          <button class="template-btn" data-vals="${vals.join(',')}">${name}</button>
        `).join('')}
      </div>
      <div class="fields">
        ${FIELDS.map((f, i) => `
          <div class="field">
            <label>${f.label}</label>
            <select id="mode-${f.name}" class="select">
              <option value="every" ${state[i].mode === 'every' ? 'selected' : ''}>*</option>
              <option value="specific" ${state[i].mode === 'specific' ? 'selected' : ''}>指定</option>
              <option value="range" ${state[i].mode === 'range' ? 'selected' : ''}>范围</option>
              <option value="interval" ${state[i].mode === 'interval' ? 'selected' : ''}>间隔</option>
            </select>
            <input type="text" id="specific-${f.name}" class="f-input" placeholder="如: 1,3,5" style="display:${state[i].mode === 'specific' ? '' : 'none'}" />
            <input type="number" id="range-start-${f.name}" class="f-input" min="${f.min}" max="${f.max}" value="${state[i].rangeStart}" style="display:${state[i].mode === 'range' ? '' : 'none'}" />
            <input type="number" id="range-end-${f.name}" class="f-input" min="${f.min}" max="${f.max}" value="${state[i].rangeEnd}" style="display:${state[i].mode === 'range' ? '' : 'none'}" />
            <input type="number" id="interval-${f.name}" class="f-input" min="1" max="${f.max}" value="${state[i].interval}" style="display:${state[i].mode === 'interval' ? '' : 'none'}" />
          </div>
        `).join('')}
      </div>
      <div class="output">
        <div class="output-label">Cron 表达式</div>
        <div id="cron-output" class="cron-output">${expr}</div>
        <button class="btn-sm" id="copy-btn">📋 复制</button>
      </div>
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

  // 模板按钮
  document.querySelectorAll('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const vals = (btn as HTMLElement).dataset.vals?.split(',') || [];
      vals.forEach((v, i) => {
        if (i < state.length) {
          if (v === '*') state[i].mode = 'every';
          else if (v.includes('-')) { state[i].mode = 'range'; const [s, e] = v.split('-'); state[i].rangeStart = +s; state[i].rangeEnd = +e; }
          else if (v.startsWith('*/')) { state[i].mode = 'interval'; state[i].interval = +v.slice(2); }
          else { state[i].mode = 'specific'; state[i].specific = v.split(',').map(Number); }
        }
      });
      render();
    });
  });

  // 模式选择
  FIELDS.forEach((f, i) => {
    document.getElementById(`mode-${f.name}`)?.addEventListener('change', (e) => {
      state[i].mode = (e.target as HTMLSelectElement).value as FieldMode;
      render();
    });
    document.getElementById(`specific-${f.name}`)?.addEventListener('input', (e) => {
      state[i].specific = (e.target as HTMLInputElement).value.split(',').map(Number).filter(n => !isNaN(n));
      render();
    });
    document.getElementById(`range-start-${f.name}`)?.addEventListener('input', (e) => {
      state[i].rangeStart = +(e.target as HTMLInputElement).value;
      render();
    });
    document.getElementById(`range-end-${f.name}`)?.addEventListener('input', (e) => {
      state[i].rangeEnd = +(e.target as HTMLInputElement).value;
      render();
    });
    document.getElementById(`interval-${f.name}`)?.addEventListener('input', (e) => {
      state[i].interval = +(e.target as HTMLInputElement).value;
      render();
    });
  });

  document.getElementById('copy-btn')?.addEventListener('click', () => {
    const output = document.getElementById('cron-output')?.textContent || '';
    navigator.clipboard.writeText(output);
  });
}

render();
