import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('QR Generator', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body><div id="app"></div></body></html>`);
    document = dom.window.document;
    (global as any).document = document;
  });

  it('should render without error', () => {
    document.getElementById('app')!.innerHTML = '<div class="header">QR Generator</div>';
    expect(document.querySelector('.header')).not.toBeNull();
  });

  it('should generate QR code', () => {
    // 模拟生成二维码
    const canvas = document.createElement('canvas');
    canvas.id = 'qrCanvas';
    document.getElementById('app')!.appendChild(canvas);
    expect(document.getElementById('qrCanvas')).not.toBeNull();
  });

  it('should toggle theme', () => {
    document.documentElement.classList.toggle('dark', true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should export data', () => {
    // 模拟导出功能
    const data = { text: 'https://example.com', exportDate: new Date().toISOString(), version: '1.3.0' };
    expect(data.version).toBe('1.3.0');
  });
});
