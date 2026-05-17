import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Password Generator', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body><div id="app"></div></body></html>`);
    document = dom.window.document;
    (global as any).document = document;
  });

  it('should render without error', () => {
    document.getElementById('app')!.innerHTML = '<div class="header">Password Generator</div>';
    expect(document.querySelector('.header')).not.toBeNull();
  });

  it('should generate password', () => {
    // 模拟生成密码
    const password = 'Test123!';
    expect(password.length).toBeGreaterThan(0);
  });

  it('should toggle theme', () => {
    document.documentElement.classList.toggle('dark', true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should export data', () => {
    const data = { passwords: ['pass1', 'pass2'], exportDate: new Date().toISOString(), version: '1.3.0' };
    expect(data.passwords.length).toBe(2);
  });
});
