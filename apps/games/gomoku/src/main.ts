import { Board } from './game/Board.js';
import { AIEngine } from './ai/AIEngine.js';
import { Renderer } from './ui/Renderer.js';
import { InputHandler } from './ui/InputHandler.js';
import { UIController } from './ui/UIController.js';
import { AudioManager } from './audio/AudioManager.js';
import { Game } from './game/Game.js';
import { OnlineClient } from './online/OnlineClient.js';
import { RoomStore } from './online/RoomStore.js';
import { OnlineGameController } from './online/OnlineGameController.js';
import { OnlineLobby } from './ui/OnlineLobby.js';
import './style.css';

// ===== 初始化 =====
const app = document.getElementById('app')!;

// UI 控件
const ui = new UIController(app);

// Canvas
const canvas = ui.getCanvas();

// 核心实例
const board = new Board();
const ai = new AIEngine(3); // 搜索深度 3
const renderer = new Renderer(canvas);
const audio = new AudioManager();

// 游戏控制器
const game = new Game(board, ai, renderer, ui, audio);

// 输入处理
const inputHandler = new InputHandler(renderer, game);

// 绑定 UI
ui.bindGame(game);

// ===== 联机模块 =====
const onlineClient = new OnlineClient();
const roomStore = new RoomStore();
const onlineController = new OnlineGameController(onlineClient, roomStore, renderer, ui, board);
const onlineLobby = new OnlineLobby(app, onlineClient, roomStore);

let isOnlineMode = false;

// 联机大厅启动游戏回调
onlineLobby.setOnStartGame(() => {
  isOnlineMode = true;
  ui.hideControls();
  ui.renderGameShell();
  ui.setStatusText('联机对局开始！');
});

// 重写 InputHandler，联机模式走 OnlineGameController
const origHandleClick = (inputHandler as any).handleClick.bind(inputHandler);
(canvas as any).__gomoku_online_client__ = onlineClient;
(canvas as any).__gomoku_online_controller__ = onlineController;

// 覆盖 click 处理
canvas.removeEventListener('click', () => {});
const clickHandler = (e: MouseEvent) => {
  if (isOnlineMode && onlineController.active) {
    const pos = renderer.pixelToBoard(e.clientX, e.clientY);
    if (pos) onlineController.handleClick(pos.row, pos.col);
    return;
  }
  origHandleClick(e.clientX, e.clientY);
};

canvas.addEventListener('click', clickHandler, true);

// 触摸事件覆盖
canvas.addEventListener('touchstart', (e) => {
  if (isOnlineMode && onlineController.active) {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const pos = renderer.pixelToBoard(touch.clientX, touch.clientY);
      if (pos) onlineController.handleClick(pos.row, pos.col);
    }
  }
}, { passive: false });

// ===== 入口大厅事件（通过 UIController 回调） =====

// 单机对局：直接显示游戏画面
ui.setOnStartOnline(() => {
  ui.renderGameShell();
  isOnlineMode = false;
  onlineController.activate();
  onlineClient.connect();
  onlineLobby.show();
  ui.hideControls();
  board.reset();
  renderer.render(board);
  ui.setStatusText('请选择匹配或创建房间');
});

// 返回入口：清理联机状态
ui.setOnBackToLobby(() => {
  isOnlineMode = false;
  onlineController.deactivate();
  onlineClient.disconnect();
  onlineLobby.hide();
  board.reset();
  renderer.render(board);
  ui.renderEntryScreen();
});

// 初始渲染
renderer.render(board);

// 窗口大小变化时重绘
window.addEventListener('resize', () => {
  renderer.resize();
  if (isOnlineMode) {
    renderer.render(board, onlineController.getLastMove());
  } else {
    renderer.render(board, game.getLastMove());
  }
});
