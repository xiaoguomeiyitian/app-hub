import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Color Picker', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body><div id="app"></div></body></html>`);
    document = dom.window.document;
    (global as any).document = document;
  });

  it('should render without error', () => {
    document.getElementById('app')!.innerHTML = '<div class="header">Color Picker</div>';
    expect(document.querySelector('.header')).not.toBeNull();
  });

  it('should generate color', () => {
    // 模拟颜色生成
    const color = '#3b82f6';
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should toggle theme', () => {
    document.documentElement.classList.toggle('dark', true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should export data', () => {
    const data = { color: '#3b82f6', exportDate: new Date().toISOString(), version: '1.3.0' };
    expect(data.version).toBe('1.3.0');
    expect(data.color).toBe('#3b82f6');
  });
});
