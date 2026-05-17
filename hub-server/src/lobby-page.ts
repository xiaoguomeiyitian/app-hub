import { discoverStaticProjects, type ProjectEntry } from './project-catalog.js';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CATEGORY_META: Record<string, { zh: string; icon: string }> = {
  game:        { zh: '游戏',     icon: '🎮' },
  art:         { zh: '创意艺术', icon: '🎨' },
  visual:      { zh: '视觉特效', icon: '✨' },
  audio:       { zh: '音频',     icon: '🎵' },
  fun:         { zh: '趣味娱乐', icon: '🎲' },
  'tool-dev':  { zh: '开发工具', icon: '💻' },
  social:      { zh: '社交',     icon: '💬' },
  'tool-efficiency': { zh: '效率工具', icon: '⚡' },
};

const CATEGORY_ORDER = ['game', 'art', 'visual', 'audio', 'fun', 'tool-dev', 'social', 'tool-efficiency'];

interface LobbyCategory {
  key: string;
  label: string;
  icon: string;
  projects: ProjectEntry[];
}

function groupByCategory(projects: ProjectEntry[]): LobbyCategory[] {
  const map = new Map<string, ProjectEntry[]>();
  for (const p of projects) {
    const list = map.get(p.category) ?? [];
    list.push(p);
    map.set(p.category, list);
  }
  const categories: LobbyCategory[] = [];
  for (const key of CATEGORY_ORDER) {
    const projs = map.get(key);
    if (projs && projs.length > 0) {
      const meta = CATEGORY_META[key] ?? { zh: key, icon: '📦' };
      categories.push({ key, label: meta.zh, icon: meta.icon, projects: projs });
    }
  }
  for (const [key, projs] of map.entries()) {
    if (!CATEGORY_ORDER.includes(key)) {
      const meta = CATEGORY_META[key] ?? { zh: key, icon: '📦' };
      categories.push({ key, label: meta.zh, icon: meta.icon, projects: projs });
    }
  }
  return categories;
}

const PROJECT_ICONS: Record<string, string> = {
  'tetris': '🧱', 'snake-game': '🐍', 'pacman': '👾', 'minesweeper': '💣',
  'sudoku': '🔢', 'gomoku': '⚫', 'go-game': '⚪', 'xiangqi': '♟️',
  'checkers': '🔴', 'reversi': '⚫', 'connect4': '🟡', 'bejeweled': '💎',
  'game-2048': '🎲', 'wordle': '📝', 'typing-rpg': '⌨️', 'typing-speed': '🏎️',
  'blackjack': '🃏', 'mahjong': '🀄', 'guandan': '🃏', 'paodekuai': '🃏',
  'werewolf': '🐺', 'spyfall': '🕵️', 'flappy-bird': '🐦', 'pong': '🏓',
  'pinball': '🎱', 'racing': '🏎️', 'football': '⚽', 'basketball': '🏀',
  'darts': '🎯', 'bomberman': '💥', 'space-shooter': '🚀', 'battleship': '🚢',
  'stealth-express': '🥷', 'pixel-art': '🖼️', 'svg-editor': '✏️', 'doodle': '🖌️',
  'color-palette': '🎨', 'gradient-generator': '🌈', 'confetti': '🎊',
  'cross-stitch': '🧵', 'particle-heart': '💖', 'live-wallpaper': '🌅',
  'text-animator': '✨', 'ascii-art': '📐', 'ascii-table': '📊',
  'calculator': '🔢', 'unit-converter': '📏', 'bmi-calculator': '⚖️',
  'calendar': '📅', 'countdown': '⏱️', 'pomodoro': '🍅', 'pomodoro-pro': '⏰',
  'timestamp-tool': '🕐', 'cron-builder': '⚙️', 'json-tool': '{}', 'text-diff': '📋',
  'regex-tester': '🔍', 'css-playground': '🎨', 'flow-editor': '📊',
  'api-tester': '🔌', 'mock-server': '🖥️', 'url-shortener': '🔗',
  'qr-generator': '📱', 'uuid-generator': '🔑', 'password-generator': '🔒',
  'code-shot': '📸', 'image-converter': '🖼️', 'notepad': '📝',
  'md-editor': '📝', 'todo-app': '✅', 'kanban': '📋', 'habit-tracker': '📈',
  'reading-list': '📚', 'shopping-list': '🛒', 'expense-tracker': '💰',
  'expense-split': '🧮', 'bookmark-manager': '🔖', 'clipboard-manager': '📋',
  'color-picker': '🎯', 'decision-wheel': '🎡', 'random-fate': '🃏',
  'quote-generator': '💬', 'daily-sign': '📜', 'guestbook': '📖',
  'pastebin': '📋', 'weather-widget': '🌤️', 'world-clocks': '🕐',
  'sleep-tracker': '😴', 'calorie-tracker': '🍎', 'ambient-music': '🎵',
  'noise-generator': '🌊', 'sound-sculpture': '🎶', 'virtual-piano': '🎹',
  'earth-view': '🌍', 'fractal-explorer': '🔬', 'game-of-life': '🧬',
  'kaleidoscope': '🔮', 'mouse-heatmap': '🖱️', 'rain-rain': '🌧️',
  'starfield': '🌟', 'voronoi-art': '🎨', 'falling-sand': '⏳',
  'virtual-aquarium': '🐠', 'stealth-mini': '🥷',
};

function getProjectIcon(name: string): string {
  return PROJECT_ICONS[name] ?? '📦';
}

export function buildLobbyHtml(baseUrl: string): string {
  const projects = discoverStaticProjects();
  const categories = groupByCategory(projects);
  const total = projects.length;

  const catCounts = categories.map(c => ({ key: c.key, label: c.label, icon: c.icon, count: c.projects.length }));

  const filterChipsHtml = catCounts
    .map((c) => `<button class="category-chip" data-cat="${escapeHtml(c.key)}" onclick="Lobby.filterBy('${escapeHtml(c.key)}')">${c.icon} ${escapeHtml(c.label)} <span class="chip-count">${c.count}</span></button>`)

    .join('\n        ');

  const projectsHtml = categories
    .map((cat) =>
      cat.projects
        .map((p) => {
          const icon = getProjectIcon(p.name);
          const desc = escapeHtml(p.desc_zh || '');
          const name = escapeHtml(p.label_zh);
          return `
      <div class="project-card" data-cat="${escapeHtml(cat.key)}" data-name="${escapeHtml(p.name)}" data-label="${name}">
        <a class="project-link" href="${baseUrl}${p.name}/" title="${name}">
          <div class="card-top">
            <div class="card-icon">${icon}</div>
          </div>
          <h3>${name}</h3>
          ${desc ? `<p>${desc}</p>` : '<p>&nbsp;</p>'}
          <div class="card-meta">
            <span class="card-badge">${escapeHtml(cat.label)}</span>
            <span class="click-count">👆 ${p.clickCount}</span>
          </div>
        </a>
      </div>`;
        })
        .join('')
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>应用大厅 — app-hub</title>
  <style>
    :root {
      --bg: #0b1020; --bg-grad: #0a1020; --bg-grad-end: #0d1428;
      --panel: rgba(15,23,42,0.82); --panel-2: rgba(15,23,42,0.94);
      --topbar: rgba(7,11,24,0.72); --topbar-border: rgba(255,255,255,0.06);
      --card: linear-gradient(180deg,rgba(17,24,39,0.96),rgba(10,14,28,0.96));
      --card-border: rgba(148,163,184,0.14);
      --chip: rgba(255,255,255,0.04); --chip-border: rgba(255,255,255,0.08);
      --chip-hover: rgba(129,140,248,0.12); --chip-active: linear-gradient(135deg,rgba(99,102,241,0.32),rgba(129,140,248,0.18));
      --chip-hover-border: rgba(129,140,248,0.22); --chip-active-border: rgba(129,140,248,0.36);
      --chip-text-hover: #fff; --chip-text-active: #fff;
      --search-bg: rgba(15,23,42,0.76); --empty-bg: rgba(15,23,42,0.72);
      --dropdown-bg: rgba(6,10,22,0.96); --placeholder: #7c8aa4;
      --line: rgba(148,163,184,0.18); --line-strong: rgba(148,163,184,0.28);
      --text: #e5e7eb; --muted: #94a3b8; --muted-2: #cbd5e1;
      --brand: #818cf8; --brand-2: #6366f1; --brand-3: #4f46e5;
      --good: #22c55e; --warn: #f59e0b; --danger: #ef4444;
      --shadow: 0 14px 38px rgba(0,0,0,0.34);
      --card-hover-shadow: 0 14px 40px rgba(0,0,0,0.42),0 0 16px rgba(129,140,248,0.08);
      --toast-bg: rgba(15,23,42,0.96);
      --radius-lg: 16px; --radius-md: 12px;
    }
    [data-theme="light"] {
      --bg: #f5f7fa; --bg-grad: #f5f7fa; --bg-grad-end: #e8ecf1;
      --panel: rgba(255,255,255,0.85); --panel-2: rgba(255,255,255,0.95);
      --topbar: rgba(255,255,255,0.78); --topbar-border: rgba(0,0,0,0.08);
      --card: linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,247,250,0.96));
      --card-border: rgba(0,0,0,0.10);
      --chip: rgba(0,0,0,0.04); --chip-border: rgba(0,0,0,0.08);
      --chip-hover: rgba(99,102,241,0.08); --chip-active: linear-gradient(135deg,rgba(99,102,241,0.16),rgba(129,140,248,0.10));
      --chip-hover-border: rgba(99,102,241,0.22); --chip-active-border: rgba(99,102,241,0.34);
      --chip-text-hover: #4f46e5; --chip-text-active: #4f46e5;
      --search-bg: rgba(255,255,255,0.80); --empty-bg: rgba(255,255,255,0.72);
      --dropdown-bg: rgba(255,255,255,0.96); --placeholder: #94a3b8;
      --line: rgba(0,0,0,0.10); --line-strong: rgba(0,0,0,0.18);
      --text: #1e293b; --muted: #64748b; --muted-2: #475569;
      --brand: #6366f1; --brand-2: #6366f1; --brand-3: #4f46e5;
      --good: #16a34a; --warn: #d97706; --danger: #dc2626;
      --shadow: 0 14px 38px rgba(0,0,0,0.12);
      --card-hover-shadow: 0 14px 40px rgba(0,0,0,0.18),0 0 16px rgba(99,102,241,0.06);
      --toast-bg: rgba(255,255,255,0.96);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
      background: radial-gradient(circle at top, rgba(99,102,241,0.14), transparent 32%), linear-gradient(180deg, var(--bg-grad) 0%, var(--bg-grad-end) 100%);
      color: var(--text); -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; text-decoration: none; }
    button, input { font: inherit; }
    button { cursor: pointer; }

    /* Top Bar */
    .top-bar { position: sticky; top: 0; z-index: 30; backdrop-filter: blur(16px); background: var(--topbar); border-bottom: 1px solid var(--topbar-border); }
    .top-bar-inner { width: min(1200px, calc(100vw - 28px)); margin: 0 auto; min-height: 64px; display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 10px 0; }
    .logo-link { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
    .logo-icon { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; background: linear-gradient(135deg, rgba(129,140,248,0.22), rgba(99,102,241,0.08)); border: 1px solid rgba(129,140,248,0.25); box-shadow: 0 8px 24px rgba(79,70,229,0.2); font-size: 18px; }
    .logo-text { font-size: 18px; font-weight: 800; letter-spacing: 0.02em; white-space: nowrap; }
    .top-actions { display: inline-flex; gap: 10px; align-items: center; flex-shrink: 0; }
    .top-chip { height: 36px; padding: 0 14px; display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; color: var(--muted-2); background: var(--chip); border: 1px solid var(--chip-border); outline: none; transition: transform .16s, background .16s, border-color .16s, color .16s; white-space: nowrap; }
    .top-chip:hover { transform: translateY(-1px); background: var(--chip-hover); border-color: var(--chip-hover-border); color: var(--chip-text-hover); }
    .top-chip.active { background: var(--chip-active); border-color: var(--chip-active-border); color: var(--chip-text-active); box-shadow: 0 8px 24px rgba(79,70,229,0.22); }

    /* Shell */
    .shell { width: min(1200px, calc(100vw - 28px)); margin: 0 auto; padding: 14px 0 22px; }

    /* Search */
    .search-row { display: grid; grid-template-columns: minmax(0,1fr); gap: 12px; align-items: center; margin-top: 10px; }
    .search-area { position: relative; min-width: 0; }
    .search-input { width: 100%; height: 48px; padding: 0 16px; border-radius: 16px; color: var(--text); background: var(--search-bg); border: 1px solid rgba(148,163,184,0.16); outline: none; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03); }
    .search-input::placeholder { color: var(--placeholder); }
    .search-input:focus { border-color: rgba(129,140,248,0.34); box-shadow: 0 0 0 3px rgba(129,140,248,0.14); }
    .search-dropdown { position: absolute; left: 0; right: 0; top: calc(100% + 8px); z-index: 50; display: none; padding: 8px; border-radius: 16px; background: var(--dropdown-bg); border: 1px solid rgba(148,163,184,0.18); box-shadow: var(--shadow); max-height: 320px; overflow-y: auto; }
    .search-result { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; color: var(--text); cursor: pointer; }
    .search-result:hover { background: rgba(129,140,248,0.12); }
    .search-result.empty { color: var(--muted); cursor: default; }

    /* Category Filter */
    .category-row { margin-top: 10px; }
    .filter-bar { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
    .filter-bar::-webkit-scrollbar { display: none; }
    .category-chip { height: 36px; padding: 0 14px; display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; color: var(--muted-2); background: var(--chip); border: 1px solid var(--chip-border); outline: none; transition: transform .16s, background .16s, border-color .16s, color .16s; white-space: nowrap; flex-shrink: 0; }
    .category-chip:hover { transform: translateY(-1px); background: var(--chip-hover); border-color: var(--chip-hover-border); color: var(--chip-text-hover); }
    .category-chip.active { background: var(--chip-active); border-color: var(--chip-active-border); color: var(--chip-text-active); box-shadow: 0 8px 24px rgba(79,70,229,0.22); }
    .chip-count { font-size: 11px; opacity: 0.7; }

    /* Projects Grid */
    .content-section { margin-top: 14px; }
    .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-top: 16px; }
    .project-card { position: relative; min-height: 182px; border-radius: var(--radius-lg); background: var(--card); border: 1px solid var(--card-border); box-shadow: var(--shadow); overflow: hidden; transition: transform .16s, border-color .16s, box-shadow .16s; }
    .project-card:hover { transform: translateY(-3px); border-color: rgba(129,140,248,0.34); box-shadow: var(--card-hover-shadow); }
    .project-card.hidden { display: none; }
    .project-link { display: flex; flex-direction: column; gap: 10px; padding: 16px; min-height: 100%; }
    .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .card-icon { width: 48px; height: 48px; display: inline-flex; align-items: center; justify-content: center; border-radius: 16px; background: rgba(99,102,241,0.12); border: 1px solid rgba(129,140,248,0.16); font-size: 22px; flex: none; }
    .project-card h3 { margin: 4px 0 0; font-size: 17px; line-height: 1.3; }
    .project-card p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.5; min-height: 38px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); margin-top: auto; }
    .card-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; background: rgba(99,102,241,0.12); color: var(--brand); font-size: 11px; }
    .click-count { white-space: nowrap; }

    /* Empty State */
    .empty-state { margin-top: 18px; padding: 34px 18px; text-align: center; border-radius: var(--radius-lg); background: var(--empty-bg); border: 1px dashed rgba(148,163,184,0.2); display: none; }
    .empty-state.show { display: block; }
    .empty-icon { font-size: 28px; margin-bottom: 10px; }
    .empty-state p { margin: 0 0 10px; color: var(--muted-2); }
    .btn-primary { height: 40px; padding: 0 16px; border-radius: 999px; color: #fff; background: linear-gradient(135deg, var(--brand-2), var(--brand)); border: none; box-shadow: 0 10px 24px rgba(79,70,229,0.25); }

    /* Footer */
    .footer { padding: 20px 0 28px; color: var(--muted); }
    .footer-inner { width: min(1200px, calc(100vw - 28px)); margin: 0 auto; padding-top: 14px; border-top: 1px solid var(--line); text-align: center; font-size: 12px; }

    /* Toast */
    .toast { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%) translateY(16px); background: var(--toast-bg); color: #fff; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 8px 30px rgba(0,0,0,0.36); border-radius: 999px; padding: 10px 16px; opacity: 0; transition: opacity .18s, transform .18s; pointer-events: none; z-index: 999; }
    .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

    /* Responsive */
    @media (max-width: 1024px) { .top-bar-inner, .shell, .footer-inner { width: min(100vw - 20px, 1200px); } .projects-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); } }
    @media (max-width: 720px) { .top-bar-inner { min-height: 58px; gap: 10px; } .logo-text { font-size: 16px; } .projects-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); } }
    @media (max-width: 480px) { .projects-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); } .project-card { min-height: 160px; } .project-link { padding: 12px; } .card-icon { width: 40px; height: 40px; font-size: 18px; } .project-card h3 { font-size: 15px; } }
  </style>
</head>
<body>
  <header class="top-bar" id="topBar">
    <div class="top-bar-inner">
      <a href="${baseUrl}" class="logo-link" aria-label="返回应用大厅首页">
        <span class="logo-icon">🎮</span>
        <span class="logo-text">应用大厅</span>
      </a>
      <div class="top-actions">
        <button class="top-chip" id="recentBtn" onclick="Lobby.showRecent()">最近</button>
        <button class="top-chip" id="favBtn" onclick="Lobby.showFavorites()">收藏</button>
        <button class="top-chip" id="themeBtn" onclick="Lobby.toggleTheme()" title="切换主题">🌙</button>
        <button class="top-chip" id="langBtn" onclick="Lobby.toggleLang()" title="切换语言">EN</button>
      </div>
    </div>
  </header>

  <main class="shell">
    <section class="search-row" aria-label="搜索">
      <div class="search-area">
        <input id="searchInput" class="search-input" placeholder="🔍 搜索应用..." autocomplete="off" oninput="Lobby.handleSearch(this.value)" onfocus="Lobby.openSearchDropdown()">
        <div id="searchDropdown" class="search-dropdown" aria-live="polite"></div>
      </div>
    </section>

    <section class="category-row" aria-label="分类栏">
      <div id="filterBar" class="filter-bar">
        <button class="category-chip active" data-cat="all" onclick="Lobby.filterBy('all')">📦 全部 <span class="chip-count">${total}</span></button>
        ${filterChipsHtml}
      </div>
    </section>

    <section class="content-section">
      <div id="emptyState" class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>没有找到匹配的应用</p>
        <button class="btn-primary" onclick="Lobby.resetFilters()">显示全部</button>
      </div>
      <div id="projectsGrid" class="projects-grid">
        ${projectsHtml}
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="footer-inner">
      <p>应用大厅 · 轻量高效入口 · 共 ${total} 个应用</p>
    </div>
  </footer>

  <div id="toast" class="toast"></div>

  <script>
    const Lobby = (() => {
      const grid = document.getElementById('projectsGrid');
      const emptyState = document.getElementById('emptyState');
      const searchInput = document.getElementById('searchInput');
      const searchDropdown = document.getElementById('searchDropdown');
      const filterBar = document.getElementById('filterBar');
      const toast = document.getElementById('toast');
      const themeBtn = document.getElementById('themeBtn');
      let currentCat = 'all';
      let searchTimer = null, toastTimer = null;

      function getTheme() { return localStorage.getItem('lobby-theme') || 'dark'; }
      function setTheme(t) { document.documentElement.setAttribute('data-theme', t); themeBtn.textContent = t === 'light' ? '☀️' : '🌙'; localStorage.setItem('lobby-theme', t); }
      function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }
      setTheme(getTheme());

      let lang = localStorage.getItem('lobby-lang') || 'zh';
      function toggleLang() { lang = lang === 'zh' ? 'en' : 'zh'; localStorage.setItem('lobby-lang', lang); showToast(lang === 'zh' ? '已切换为中文' : 'Switched to English'); }

      function getFavs() { try { return JSON.parse(localStorage.getItem('lobby-favs') || '[]'); } catch { return []; } }
      function toggleFav(name) { const favs = getFavs(); const idx = favs.indexOf(name); if (idx >= 0) { favs.splice(idx, 1); showToast('已取消收藏'); } else { favs.push(name); showToast('已收藏 ⭐'); } localStorage.setItem('lobby-favs', JSON.stringify(favs)); }
      function showFavorites() { const favs = new Set(getFavs()); let visible = 0; grid.querySelectorAll('.project-card').forEach(card => { const match = favs.has(card.dataset.name); card.classList.toggle('hidden', !match); if (match) visible++; }); updateEmpty(visible); filterBar.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active')); }

      function getRecent() { try { return JSON.parse(localStorage.getItem('lobby-recent') || '[]'); } catch { return []; } }
      function addRecent(name) { let recent = getRecent(); recent = recent.filter(n => n !== name); recent.unshift(name); localStorage.setItem('lobby-recent', JSON.stringify(recent.slice(0, 20))); }
      function showRecent() { const recent = getRecent(); if (!recent.length) { showToast('暂无最近访问'); return; } const set = new Set(recent); let visible = 0; grid.querySelectorAll('.project-card').forEach(card => { const match = set.has(card.dataset.name); card.classList.toggle('hidden', !match); if (match) visible++; }); updateEmpty(visible); filterBar.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active')); }

      function filterBy(cat) { currentCat = cat; applyFilter(searchInput.value.trim().toLowerCase()); filterBar.querySelectorAll('.category-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === cat)); }
      function applyFilter(q) { let visible = 0; grid.querySelectorAll('.project-card').forEach(card => { const matchCat = currentCat === 'all' || card.dataset.cat === currentCat; const matchSearch = !q || card.dataset.name.toLowerCase().includes(q) || card.dataset.label.toLowerCase().includes(q); card.classList.toggle('hidden', !(matchCat && matchSearch)); if (matchCat && matchSearch) visible++; }); updateEmpty(visible); }
      function resetFilters() { searchInput.value = ''; searchDropdown.style.display = 'none'; filterBy('all'); }
      function updateEmpty(v) { emptyState.classList.toggle('show', v === 0); }

      function handleSearch(q) { clearTimeout(searchTimer); searchTimer = setTimeout(() => { applyFilter(q.trim().toLowerCase()); updateDropdown(q.trim().toLowerCase()); }, 120); }
      function updateDropdown(q) { if (!q) { searchDropdown.style.display = 'none'; return; } const results = []; grid.querySelectorAll('.project-card').forEach(card => { if (card.dataset.name.toLowerCase().includes(q) || card.dataset.label.toLowerCase().includes(q)) results.push({ name: card.dataset.name, label: card.dataset.label }); }); if (!results.length) { searchDropdown.innerHTML = '<div class="search-result empty">没有找到匹配的应用</div>'; } else { searchDropdown.innerHTML = results.slice(0, 12).map(r => '<div class="search-result" onclick="Lobby.goTo(\\'' + r.name + '\\')"><span>' + r.label + '</span><span style="color:var(--muted);font-size:12px">' + r.name + '</span></div>').join(''); } searchDropdown.style.display = 'block'; }
      function openSearchDropdown() { const q = searchInput.value.trim().toLowerCase(); if (q) updateDropdown(q); }
      function goTo(name) { addRecent(name); window.location.href = '${baseUrl}' + name + '/'; }

      function showToast(msg) { toast.textContent = msg; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2000); }

      grid.addEventListener('click', (e) => { const card = e.target.closest('.project-card'); if (card) addRecent(card.dataset.name); });
      document.addEventListener('click', (e) => { if (!e.target.closest('.search-area')) searchDropdown.style.display = 'none'; });

      return { filterBy, resetFilters, handleSearch, openSearchDropdown, goTo, toggleTheme, toggleLang, showFavorites, showRecent };
    })();
  </script>
</body>
</html>`;
}
