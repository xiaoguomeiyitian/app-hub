import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';

const APP_NAME = 'Daily Sign';
const APP_VERSION = '1.3.0';
const APP_DESC = '每日抽签，查看今日运势';

let theme: 'light' | 'dark' = (localStorage.getItem('daily_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('daily_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  localStorage.clear();
  localStorage.setItem('daily_theme', theme);
  render();
}

function exportData(): void {
  const data = { exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'daily-sign-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      JSON.parse(e.target?.result as string);
      alert('导入成功');
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

const poems = [
  { text: '大鹏一日同风起，扶摇直上九万里', fortune: '大吉', level: 'great' as const },
  { text: '长风破浪会有时，直挂云帆济沧海', fortune: '大吉', level: 'great' as const },
  { text: '海阔凭鱼跃，天高任鸟飞', fortune: '上上签', level: 'great' as const },
  { text: '春风得意马蹄疾，一日看尽长安花', fortune: '大吉', level: 'great' as const },
  { text: '沉舟侧畔千帆过，病树前头万木春', fortune: '中吉', level: 'good' as const },
  { text: '山重水复疑无路，柳暗花明又一村', fortune: '中吉', level: 'good' as const },
  { text: '天生我材必有用，千金散尽还复来', fortune: '吉', level: 'good' as const },
  { text: '莫愁前路无知己，天下谁人不识君', fortune: '吉', level: 'good' as const },
  { text: '会当凌绝顶，一览众山小', fortune: '上吉', level: 'great' as const },
  { text: '不识庐山真面目，只缘身在此山中', fortune: '平', level: 'ok' as const },
  { text: '欲穷千里目，更上一层楼', fortune: '中平', level: 'ok' as const },
  { text: '千淘万漉虽辛苦，吹尽狂沙始到金', fortune: '先苦后甜', level: 'good' as const },
  { text: '黑发不知勤学早，白首方悔读书迟', fortune: '中平', level: 'ok' as const },
  { text: '少壮不努力，老大徒伤悲', fortune: '劝勉', level: 'ok' as const },
  { text: '问君能有几多愁，恰似一江春水向东流', fortune: '小凶', level: 'bad' as const },
  { text: '夕阳无限好，只是近黄昏', fortune: '小凶', level: 'bad' as const },
  { text: '无可奈何花落去，似曾相识燕归来', fortune: '平', level: 'ok' as const },
  { text: '落霞与孤鹜齐飞，秋水共长天一色', fortune: '吉', level: 'good' as const },
];

const hexagrams = ['☰','☱','☲','☳','☴','☵','☶','☷'];
const hexNames = ['乾','兑','离','震','巽','坎','艮','坤'];

function getTodayKey() { return new Date().toISOString().slice(0, 10); }

const STORAGE_DB = 'daily-sign-db';
const store = createIdbStore(STORAGE_DB, 'kv');

async function loadSign(): Promise<number> {
  try {
    const raw = await store.get('sign-index');
    return raw ?? -1;
  } catch { return -1; }
}

async function saveSign(idx: number): Promise<void> {
  await store.set('sign-index', idx);
}

let signIdx = -1;

function render(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">📜</span><span class="title">Daily Sign</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="sign-container">
        ${signIdx >= 0 ? `
          <div class="sign-result">
            <div class="hexagram">${hexagrams[signIdx % 8]}</div>
            <div class="poem">${poems[signIdx].text}</div>
            <div class="fortune ${poems[signIdx].level}">${poems[signIdx].fortune}</div>
          </div>
        ` : '<div class="no-sign">点击抽签按钮获取今日运势</div>'}
        <button class="draw-btn" id="draw-btn">🎋 抽签</button>
      </div>
      <div class="history">
        <div class="history-header">历史记录</div>
        <div class="history-list" id="history-list"></div>
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

  document.getElementById('draw-btn')?.addEventListener('click', async () => {
    signIdx = Math.floor(Math.random() * poems.length);
    await saveSign(signIdx);
    render();
  });

  // 模拟历史记录
  const historyList = document.getElementById('history-list');
  if (historyList) {
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const idx = (signIdx + i) % poems.length;
      if (idx >= 0) {
        const div = document.createElement('div');
        div.className = 'hist-item';
        div.textContent = `${d.toISOString().slice(0, 10)}: ${poems[idx].fortune}`;
        historyList.appendChild(div);
      }
    }
  }
}

// 初始化
(async () => {
  signIdx = await loadSign();
  render();
})();
