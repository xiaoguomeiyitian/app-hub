import type { Renderer } from './Renderer.js';
import type { Game } from '../game/Game.js';

/**
 * 输入处理
 * 监听鼠标点击和触摸事件，转换为棋盘坐标并触发落子
 */
export class InputHandler {
  private renderer: Renderer;
  private game: Game;

  constructor(renderer: Renderer, game: Game) {
    this.renderer = renderer;
    this.game = game;
    this.bindEvents();
  }

  private bindEvents(): void {
    const canvas = this.renderer.getCanvas();

    // 鼠标点击
    canvas.addEventListener('click', (e) => {
      this.handleClick(e.clientX, e.clientY);
    });

    // 触摸事件（移动端）
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        this.handleClick(touch.clientX, touch.clientY);
      }
    }, { passive: false });
  }

  private handleClick(clientX: number, clientY: number): void {
    if (!this.game.isInputEnabled()) return;

    const pos = this.renderer.pixelToBoard(clientX, clientY);
    if (!pos) return;

    this.game.onPlayerMove(pos);
  }
}
