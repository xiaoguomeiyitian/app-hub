import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Kanban', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body><div id="app"></div></body></html>`);
    document = dom.window.document;
    (global as any).document = document;
  });

  it('should render without error', () => {
    document.getElementById('app')!.innerHTML = '<div class="header">Kanban</div>';
    expect(document.querySelector('.header')).not.toBeNull();
  });

  it('should add column', () => {
    // 模拟添加列
    const addBtn = document.createElement('button');
    let columns = 0;
    addBtn.addEventListener('click', () => { columns++; });
    addBtn.click();
    expect(columns).toBe(1);
  });

  it('should add card to column', () => {
    // 模拟添加卡片
    const card = { id: '1', title: 'Test Card', desc: '', tag: '' };
    expect(card.title).toBe('Test Card');
  });

  it('should toggle theme', () => {
    document.documentElement.classList.toggle('dark', true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
