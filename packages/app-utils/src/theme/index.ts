export type Theme = 'light' | 'dark';

const THEME_KEY = 'app-hub-theme';

export function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  return media.matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.className = theme;
  localStorage.setItem(THEME_KEY, theme);
}

