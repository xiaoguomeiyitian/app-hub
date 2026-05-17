import '@app-hub/design-system/src/style.css';
import './style.css';

const APP_NAME = 'Password Generator';
const APP_VERSION = '1.3.0';
const APP_DESC = '安全密码生成器，支持强度评估和分类保存';

const CHARS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

const WORDS = ['apple','brave','cloud','dance','eagle','flame','grape','house','ivory','joker','kite','lemon','mango','night','ocean','piano','queen','river','storm','tiger','unity','vivid','wheat','xenon','yacht','zebra','blaze','charm','delta','frost','globe','honey','ivory','jewel','krill','lunar','maple','noble','olive','pearl','quest','rover','solar','tempo','ultra','valor','waltz','xerox','yield'];

let theme: 'light' | 'dark' = (localStorage.getItem('pwd_theme') as 'light' | 'dark') || 'light';
let history: string[] = JSON.parse(localStorage.getItem('pwd_history') || '[]');
let categories: Record<string, string[]> = JSON.parse(localStorage.getItem('pwd_categories') || '{}');
let selectedCategory = '';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('pwd_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  history = []; categories = {}; selectedCategory = '';
  localStorage.clear();
  localStorage.setItem('pwd_theme', theme);
  render();
}

// 导入/导出
function exportData(): void {
  const data = { history, categories, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'password-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.history) { history = data.history; localStorage.setItem('pwd_history', JSON.stringify(history)); }
      if (data.categories) { categories = data.categories; localStorage.setItem('pwd_categories', JSON.stringify(categories)); }
      render();
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

// 泄漏检查（模拟）
function checkLeak(password: string): void {
  // 简单模拟：检查是否为常见弱密码
  const commonPasswords = ['123456', 'password', '12345678', 'qwerty', 'abc123'];
  if (commonPasswords.includes(password.toLowerCase())) {
    alert('⚠️ 警告：此密码过于常见，可能已泄露！');
  } else {
    alert('✅ 未检测到常见泄漏模式（完整检查需连接泄漏数据库）');
  }
}

let state = {
  length: 16,
  upper: true, lower: true, digits: true, symbols: true,
  count: 5,
  passwords: [] as string[],
  mode: 'password' as 'password' | 'phrase',
  phraseWords: 4,
};

function generatePassword(len: number, opts: { upper: boolean; lower: boolean; digits: boolean; symbols: boolean }): string {
  let pool = '';
  if (opts.upper) pool += CHARS.upper;
  if (opts.lower) pool += CHARS.lower;
  if (opts.digits) pool += CHARS.digits;
  if (opts.symbols) pool += CHARS.symbols;
  if (!pool) pool = CHARS.lower;
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, v => pool[v % pool.length]).join('');
}

function generatePhrase(words: number): string {
  const arr = new Uint32Array(words);
  crypto.getRandomValues(arr);
  return Array.from(arr, v => WORDS[v % WORDS.length]).join('-');
}

function strength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 2) return { score, label: '弱', color: '#f85149' };
  if (score <= 4) return { score, label: '中等', color: '#d29922' };
  return { score, label: '强', color: '#3fb950' };
}

function saveToCategory(pw: string): void {
  const cat = prompt('输入分类名称（如：工作、个人）：', selectedCategory);
  if (!cat) return;
  if (!categories[cat]) categories[cat] = [];
  categories[cat].push(pw);
  localStorage.setItem('pwd_categories', JSON.stringify(categories));
  selectedCategory = cat;
  render();
}

function render(): void {
  applyTheme();
  const s = state;
  const sample = s.passwords[0] || (s.mode === 'password' ? generatePassword(s.length, s) : generatePhrase(s.phraseWords));
  const str = strength(sample);

  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🔐</span><span class="title">Password Generator</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="result-box">
        <div class="result-pw" id="result-pw">${sample}</div>
        <div class="strength-bar"><div class="strength-fill" style="width:${str.score/6*100}%;background:${str.color}"></div></div>
        <div class="strength-label" style="color:${str.color}">强度：${str.label}</div>
        <div class="result-actions">
          <button class="btn-sm" id="copy-btn">📋 复制</button>
          <button class="btn-sm" id="regen-btn">🔄 重新生成</button>
          <button class="btn-sm" id="save-cat-btn">💾 保存分类</button>
          <button class="btn-sm" id="check-leak-btn">🔍 泄漏检查</button>
        </div>
      </div>
      <div class="options">
        <div class="mode-tabs">
          <button class="mode-btn ${s.mode==='password'?'active':''}" data-mode="password">密码</button>
          <button class="mode-btn ${s.mode==='phrase'?'active':''}" data-mode="phrase">短语</button>
        </div>
        ${s.mode === 'password' ? `
          <div class="opt-row"><label>长度: ${s.length}</label><input type="range" id="len-slider" min="4" max="64" value="${s.length}" class="slider" /></div>
          <div class="opt-checks">
            <label class="check-label"><input type="checkbox" id="chk-upper" ${s.upper?'checked':''} /> 大写</label>
            <label class="check-label"><input type="checkbox" id="chk-lower" ${s.lower?'checked':''} /> 小写</label>
            <label class="check-label"><input type="checkbox" id="chk-digits" ${s.digits?'checked':''} /> 数字</label>
            <label class="check-label"><input type="checkbox" id="chk-symbols" ${s.symbols?'checked':''} /> 符号</label>
          </div>
        ` : `
          <div class="opt-row"><label>单词数: ${s.phraseWords}</label><input type="range" id="words-slider" min="3" max="8" value="${s.phraseWords}" class="slider" /></div>
        `}
        <div class="opt-row"><label>生成数量: ${s.count}</label><input type="range" id="count-slider" min="1" max="20" value="${s.count}" class="slider" /></div>
      </div>
      ${s.passwords.length > 1 ? `
        <div class="batch">
          <div class="batch-header">已生成 <button class="btn-xs" id="copy-all">全部复制</button></div>
          ${s.passwords.map(p => `<div class="batch-item"><code>${p}</code><button class="copy-one" data-pw="${p}">📋</button></div>`).join('')}
        </div>
      ` : ''}
      ${history.length > 0 ? `
        <div class="history">
          <div class="history-header">历史记录 <button class="btn-xs" id="clear-history">清空</button></div>
          ${history.slice(0, 5).map(h => `<div class="hist-item"><code>${h.slice(0, 20)}...</code></div>`).join('')}
        </div>
      ` : ''}
      ${Object.keys(categories).length > 0 ? `
        <div class="categories">
          <div class="cat-header">分类保存</div>
          ${Object.entries(categories).map(([cat, pws]) => `
            <div class="cat-item"><strong>${cat}</strong> (${pws.length})</div>
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

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = (btn as HTMLElement).dataset.mode as 'password' | 'phrase';
      render();
    });
  });

  document.getElementById('len-slider')?.addEventListener('input', (e) => {
    state.length = +(e.target as HTMLInputElement).value; render();
  });
  document.getElementById('words-slider')?.addEventListener('input', (e) => {
    state.phraseWords = +(e.target as HTMLInputElement).value; render();
  });
  document.getElementById('count-slider')?.addEventListener('input', (e) => {
    state.count = +(e.target as HTMLInputElement).value; render();
  });

  ['chk-upper', 'chk-lower', 'chk-digits', 'chk-symbols'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      const key = id.replace('chk-', '') as keyof typeof state;
      (state as any)[key] = (e.target as HTMLInputElement).checked;
      render();
    });
  });

  document.getElementById('copy-btn')?.addEventListener('click', () => {
    const pw = document.getElementById('result-pw')?.textContent || '';
    navigator.clipboard.writeText(pw);
    history.unshift(pw); if (history.length > 20) history.pop();
    localStorage.setItem('pwd_history', JSON.stringify(history));
  });

  document.getElementById('regen-btn')?.addEventListener('click', () => {
    const newPw = state.mode === 'password' ? generatePassword(state.length, state) : generatePhrase(state.phraseWords);
    state.passwords = [newPw];
    render();
  });

  document.getElementById('save-cat-btn')?.addEventListener('click', () => {
    const pw = document.getElementById('result-pw')?.textContent || '';
    saveToCategory(pw);
  });

  document.getElementById('check-leak-btn')?.addEventListener('click', () => {
    const pw = document.getElementById('result-pw')?.textContent || '';
    checkLeak(pw);
  });

  document.getElementById('copy-all')?.addEventListener('click', () => {
    const all = state.passwords.join('\n');
    navigator.clipboard.writeText(all);
  });

  document.querySelectorAll('.copy-one').forEach(btn => {
    btn.addEventListener('click', () => {
      const pw = (btn as HTMLElement).dataset.pw || '';
      navigator.clipboard.writeText(pw);
    });
  });

  document.getElementById('clear-history')?.addEventListener('click', () => {
    history = []; localStorage.setItem('pwd_history', JSON.stringify(history)); render();
  });
}

render();
