import { log, LogLevel } from './logger.js';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { STATIC_DISCOVERY_TTL_MS } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPS_ROOT = resolve(__dirname, '..', '..', 'apps');

const projectMeta = JSON.parse(
  readFileSync(new URL('./project-meta.json', import.meta.url), 'utf8'),
) as Record<string, Partial<ProjectEntry>>;

export interface ProjectEntry {
  name: string;
  description: string;
  hasRouter: boolean;
  hasSocket: boolean;
  supportsOnline?: boolean;
  supportsBot?: boolean;
  maxPlayers?: number;
  icon: string;
  label_zh: string;
  label_en: string;
  desc_zh: string;
  desc_en: string;
  category: string;
  clickCount: number;
}

export interface LoadedProjectLike {
  name: string;
  description: string;
  hasRouter: boolean;
  hasSocket: boolean;
}

const CATEGORY_META: Record<string, { zh: string; en: string }> = {
  game: { zh: '🎮 游戏', en: '🎮 Game' },
  art: { zh: '🎨 创意艺术', en: '🎨 Creative Art' },
  visual: { zh: '✨ 视觉特效', en: '✨ Visual' },
  audio: { zh: '🎵 音频', en: '🎵 Audio' },
  fun: { zh: '🎲 趣味娱乐', en: '🎲 Fun' },
  'tool-dev': { zh: '💻 开发工具', en: '💻 Dev Tools' },
};

const CATEGORY_ICON: Record<string, string> = {
  game: '🎮',
  art: '🎨',
  visual: '✨',
  audio: '🎵',
  fun: '🎲',
  'tool-dev': '💻',
};

function prettyName(name: string): string {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

const HIDDEN_PROJECT_NAMES = new Set(['admin', 'auth', 'app-lobby', 'platform', 'platform-console']);

// 目录名到标准分类的映射
const DIR_CATEGORY_MAP: Record<string, string> = {
  'games': 'game',
  'game': 'game',
  'audio': 'audio',
  'art': 'art',
  'visual': 'visual',
  'fun': 'fun',
  'tool-dev': 'tool-dev',
  'tools': 'tool-dev',
  'dev-tools': 'tool-dev',
};

function normalizeCategory(dirCategory: string): string {
  return DIR_CATEGORY_MAP[dirCategory] || dirCategory;
}

function inferIcon(name: string, category: string): string {
  const iconByName: Record<string, string> = {
    "admin": "🛠️",
    "auth": "🔐",
    "app-lobby": "🏛️",
    "shared-backend": "🗄️",
    "platform": "🧭",
    "platform-console": "🖥️",
    "basketball": "🏀",
    "battleship": "🚢",
    "bejeweled": "💎",
    "blackjack": "🃏",
    "bomberman": "💣",
    "checkers": "♟️",
    "connect4": "🔴",
    "darts": "🎯",
    "football": "⚽",
    "game-2048": "🟧",
    "go-game": "⚪",
    "gomoku": "⚫",
    "guandan": "🀄",
    "guestbook": "📖",
    "mahjong": "🀄",
    "minesweeper": "💣",
    "pacman": "👾",
    "paodekuai": "🃏",
    "pinball": "🎱",
    "racing": "🏎️",
    "reversi": "♟️",
    "snake-game": "🐍",
    "space-shooter": "🚀",
    "spyfall": "🕵️",
    "sudoku": "🔢",
    "tetris": "🟦",
    "typing-rpg": "⚔️",
    "werewolf": "🐺",
    "wordle": "🟩",
    "xiangqi": "♟️",
    "api-tester": "🧪",
    "ascii-art": "📊",
    "ascii-table": "📋",
    "calculator": "🧮",
    "calendar": "🗓️",
    "clipboard-manager": "📋",
    "color-picker": "🎨",
    "css-playground": "🧩",
    "cron-builder": "⏰",
    "image-converter": "🖼️",
    "mock-server": "🧪",
    "notepad": "🗒️",
    "password-generator": "🔐",
    "pastebin": "📎",
    "qr-generator": "🔲",
    "regex-tester": "🔍",
    "text-diff": "🔀",
    "code-shot": "📸",
    "flow-editor": "🔲",
    "timestamp-tool": "⏱️",
    "url-shortener": "🔗",
    "uuid-generator": "🆔",
    "bmi-calculator": "📏",
    "bookmark-manager": "🔖",
    "calorie-tracker": "🍽️",
    "countdown": "⏳",
    "expense-split": "🧾",
    "expense-tracker": "💰",
    "habit-tracker": "✅",
    "kanban": "🗂️",
    "pomodoro": "🍅",
    "pomodoro-pro": "⏲️",
    "reading-list": "📚",
    "shopping-list": "🛒",
    "sleep-tracker": "🌙",
    "todo-app": "📝",
    "typing-speed": "⌨️",
    "unit-converter": "🔄",
    "weather-widget": "☁️",
    "world-clocks": "🕐",
    "doodle": "✍️",
    "pixel-art": "🕹️",
    "cross-stitch": "🪡",
    "text-animator": "🎞️",
    "live-wallpaper": "🖼️",
    "color-palette": "🎨",
    "gradient-generator": "🌈",
    "starfield": "🌌",
    "kaleidoscope": "🔷",
    "confetti": "🎊",
    "voronoi-art": "💠",
    "fractal-explorer": "🌀",
    "earth-view": "🌍",
    "game-of-life": "🧬",
    "falling-sand": "🔥",
    "mouse-heatmap": "🌡️",
    "rain-rain": "🌧️",
    "particle-heart": "💖",
    "noise-generator": "🎵",
    "virtual-piano": "🎹",
    "ambient-music": "🎶",
    "sound-sculpture": "🌊",
    "quote-generator": "💬",
    "daily-sign": "🔮",
    "decision-wheel": "🎯",
    "random-fate": "🎴",
    "virtual-aquarium": "🐟",
    "stealth-express": "📦",
  };
  return iconByName[name] || CATEGORY_ICON[category] || '📦';
}

const PROJECT_META: Record<string, Partial<ProjectEntry>> = projectMeta;


let staticDiscoveryCache: { at: number; items: ProjectEntry[] } | null = null;


export function resetStaticDiscoveryCache(): void {
  staticDiscoveryCache = null;
}

export function toProjectEntry(name: string, base: Partial<ProjectEntry> = {}): ProjectEntry {
  const meta = PROJECT_META[name] ?? {};
  // 优先使用 base.category，其次 meta.category，最后兜底 'tool-dev'
  const category = base.category ?? meta.category ?? 'tool-dev';
  const icon = base.icon ?? meta.icon ?? inferIcon(name, category);
  const labelZh = base.label_zh ?? meta.label_zh ?? meta.desc_zh ?? prettyName(name);
  const labelEn = base.label_en ?? meta.label_en ?? meta.desc_en ?? prettyName(name);
  const descZh = base.desc_zh ?? meta.desc_zh ?? base.description ?? labelZh;
  const descEn = base.desc_en ?? meta.desc_en ?? base.description ?? labelEn;
  const resolvedDescription = base.description ?? meta.description ?? descZh;
  return {
    name,
    description: resolvedDescription,
    hasRouter: base.hasRouter ?? false,
    hasSocket: base.hasSocket ?? false,
    icon,
    label_zh: labelZh,
    label_en: labelEn,
    desc_zh: descZh,
    desc_en: descEn,
    category,
    clickCount: base.clickCount ?? meta.clickCount ?? 0,
  };
}

export function discoverStaticProjects(): ProjectEntry[] {
  const now = Date.now();
  if (staticDiscoveryCache && now - staticDiscoveryCache.at < STATIC_DISCOVERY_TTL_MS) {
    return staticDiscoveryCache.items;
  }

  const entries: ProjectEntry[] = [];
  try {
    // 扫描 apps/ 下所有分类目录
    for (const category of readdirSync(APPS_ROOT)) {
      if (category.startsWith('.')) continue;
      const categoryPath = join(APPS_ROOT, category);
      try {
        if (!statSync(categoryPath).isDirectory()) continue;
      } catch {
        continue;
      }
      // 遍历分类内的项目
      for (const name of readdirSync(categoryPath)) {
        if (name.startsWith('.')) continue;
        const appPath = join(categoryPath, name);
        try {
          if (!statSync(appPath).isDirectory()) continue;
        } catch {
          continue;
        }
        // 读取 package.json 获取基础信息
        const pkgPath = join(appPath, 'package.json');
        if (!existsSync(pkgPath)) continue;
        let description = '';
        try {
          const pkgContent = readFileSync(pkgPath, 'utf-8');
          const pkg = JSON.parse(pkgContent) as { name?: string; description?: string };
          description = pkg.description || '';
        } catch { /* ignore: pkg.json 解析失败不影响扫描 */ }
        // 使用目录名推断分类（优先），兜底到名称特征
        const normalizedCategory = normalizeCategory(category);
        const base: Partial<ProjectEntry> = {
          name,
          description,
          hasRouter: false,
          hasSocket: false,
          category: normalizedCategory,
        };
        entries.push(toProjectEntry(name, base));
      }
    }
  } catch (err) {
    log(LogLevel.ERROR,'❌ 扫描 apps 目录失败:', err);
  }

  staticDiscoveryCache = { at: now, items: entries };
  return entries;
}

export function getMergedProjects(loadedProjects: LoadedProjectLike[]): ProjectEntry[] {
  const loaded = loadedProjects.map((p) => toProjectEntry(p.name, p));
  const staticProjects = discoverStaticProjects();
  const map = new Map<string, ProjectEntry>();

  for (const p of staticProjects) map.set(p.name, p);
  for (const p of loaded) map.set(p.name, p);

  return Array.from(map.values())
    .filter((p) => p.name !== 'app-gallery' && !p.name.endsWith('-mp') && !HIDDEN_PROJECT_NAMES.has(p.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCategories(projects: ProjectEntry[]): Record<string, { zh: string; en: string }> {
  const cats = new Map<string, { zh: string; en: string }>();
  for (const p of projects) {
    if (!cats.has(p.category)) cats.set(p.category, CATEGORY_META[p.category] ?? { zh: p.category, en: p.category });
  }
  return Object.fromEntries([...cats.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
