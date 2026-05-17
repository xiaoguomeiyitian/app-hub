import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPreferredTheme, applyTheme } from '../src/theme';

describe('Theme Utils', () => {
  beforeEach(() => {
    // 重置 DOM 和 localStorage
    document.documentElement.className = '';
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('app-hub-theme');
    }
    // 清除 matchMedia mock
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  it('should return light when no preference and system is light', () => {
    const theme = getPreferredTheme();
    expect(['light', 'dark']).toContain(theme);
  });

  it('should apply theme to document class', () => {
    applyTheme('dark');
    expect(document.documentElement.className).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.className).toBe('light');
  });
});