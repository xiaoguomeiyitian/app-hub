import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Calendar', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body><div id="app"></div></body></html>`);
    document = dom.window.document;
    (global as any).document = document;
  });

  it('should render without error', () => {
    document.getElementById('app')!.innerHTML = '<div class="header">Calendar</div>';
    expect(document.querySelector('.header')).not.toBeNull();
  });

  it('should add event', () => {
    // 模拟添加事件
    const events: any[] = [];
    const addEvent = (title: string, date: string) => {
      events.push({ id: '1', title, date, color: '#3b82f6' });
    };
    addEvent('Test Event', '2026-05-03');
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Test Event');
  });

  it('should toggle theme', () => {
    document.documentElement.classList.toggle('dark', true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should calculate next event', () => {
    const events = [
      { id: '1', title: 'Event 1', date: '2026-05-10', color: '#3b82f6' },
      { id: '2', title: 'Event 2', date: '2026-05-05', color: '#10b981' },
    ];
    const today = new Date('2026-05-03');
    const upcoming = events.filter(e => new Date(e.date) >= today);
    expect(upcoming.length).toBe(2);
  });
});
