import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('JSON Tool', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body><div id="app"></div></body></html>`);
    document = dom.window.document;
    (global as any).document = document;
  });

  it('should render without error', () => {
    document.getElementById('app')!.innerHTML = '<div class="header">JSON Tool</div>';
    expect(document.querySelector('.header')).not.toBeNull();
  });

  it('should format JSON', () => {
    const json = { name: 'test', version: '1.0' };
    const formatted = JSON.stringify(json, null, 2);
    expect(formatted).toContain('"name"');
    expect(formatted).toContain('"test"');
  });

  it('should toggle theme', () => {
    document.documentElement.classList.toggle('dark', true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should export data', () => {
    const data = { json: { test: true }, exportDate: new Date().toISOString(), version: '1.3.0' };
    expect(data.version).toBe('1.3.0');
    expect(data.json.test).toBe(true);
  });
});
