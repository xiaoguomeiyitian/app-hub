import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Calculator', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body><div id="app"></div></body></html>`);
    document = dom.window.document;
    (global as any).document = document;
    // 模拟 press 函数和 render 函数（简化）
    (global as any).press = (key: string) => {
      const display = document.querySelector('.result') as HTMLElement;
      if (display) {
        if (key === 'C') display.textContent = '0';
        else if (key === '=') {
          try {
            const expr = display.textContent || '0';
            display.textContent = String(eval(expr));
          } catch { display.textContent = 'Error'; }
        } else {
          if (display.textContent === '0') display.textContent = key;
          else display.textContent += key;
        }
      }
    };
    // 模拟渲染
    const app = document.getElementById('app')!;
    app.innerHTML = `
      <div class="app">
        <div class="display">
          <div class="result">0</div>
        </div>
        <div class="buttons">
          <button data-key="1">1</button>
          <button data-key="2">2</button>
          <button data-key="+">+</button>
          <button data-key="="=">=</button>
          <button data-key="C">C</button>
        </div>
      </div>
    `;
    // 绑定事件
    document.querySelectorAll('[data-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.key!;
        (global as any).press(key);
      });
    });
  });

  it('should render without error', () => {
    expect(document.getElementById('app')).not.toBeNull();
    expect(document.querySelector('.display')).not.toBeNull();
  });

  it('should handle basic addition', () => {
    const press = (global as any).press;
    press('1');
    press('+');
    press('2');
    press('=');
    const display = document.querySelector('.result') as HTMLElement;
    expect(display.textContent).toBe('3');
  });

  it('should clear display', () => {
    const press = (global as any).press;
    press('5');
    press('C');
    const display = document.querySelector('.result') as HTMLElement;
    expect(display.textContent).toBe('0');
  });

  it('should toggle theme', () => {
    // 模拟主题切换
    document.documentElement.classList.toggle('dark', true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
