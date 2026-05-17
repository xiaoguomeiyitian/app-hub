# 中国象棋 - 技术规划

## 项目目标

中国象棋游戏，支持**单机 AI 对战**、**残局挑战**、**在线匹配对战**、**好友房间对战**、**历史复盘**与**观战**。

## 技术路线

### Phase 1: 核心功能（已完成）
- ✅ 棋盘渲染（Canvas）
- ✅ 棋子绘制 + 走棋规则引擎
- ✅ 单机 AI 对战（minimax/alpha-beta）
- ✅ 视角固定系统
- ✅ 悔棋 / 重开 / 认输

### Phase 2: 在线与扩展功能（已完成）
- ✅ 共享后端 WebSocket 路由 (`routes/xiangqi/`)
- ✅ 时间档位匹配（闪电 / 快棋 / 标准 / 慢棋）
- ✅ 房间管理（创建 / 加入 / 离开 / 销毁）
- ✅ 服务端走棋验证（自包含规则引擎）
- ✅ 前端在线模式 (`OnlineGame` 类)
- ✅ 模式选择大厅（单机 / 残局 / 在线 / 好友 / 历史 / 观战）
- ✅ 原生 WebSocket 协议（替代 Socket.IO）
- ✅ 断线重连
- ✅ 匹配超时机器人陪玩
- ✅ 残局挑战
- ✅ 历史对局与复盘分析
- ✅ 随机观战 / 观战列表

### Phase 3: 后续待办
- 长将 / 长捉判和
- 60 回合无吃子判和
- 对局体验继续优化
- 每次修改代码后必须执行构建并同步部署到 `/root/projects/static/xiangqi/`

## 架构

```
前端 (Vite + Canvas)
├── main.ts          — 模式选择路由
├── game.ts          — 单机游戏控制器
├── puzzle-game.ts   — 残局挑战控制器
├── online-game.ts   — 在线 / 好友 / 观战控制器
├── history.ts       — 历史对局数据
├── review.ts        — 复盘分析
├── logic.ts         — 走棋规则引擎
├── ai-engine.ts     — 本地 AI
├── board.ts         — 棋盘渲染
└── ui.ts            — UI 管理

后端 (Express + WebSocket)
├── index.ts         — 路由 + WebSocket 入口
├── room.ts          — 房间管理 + 游戏状态 + 机器人走棋
├── match-queue.ts   — 匹配队列（时间档位匹配）
├── game-logic.ts    — 服务端规则验证（自包含）
├── bot-ai.ts        — 服务端 AI 引擎（minimax/alpha-beta）
└── types.ts         — WebSocket 协议类型
```

## WebSocket 协议

连接路径: `wss://97.383636.xyz/code/20008/api/xiangqi/websocket`

采用原生 JSON 消息，支持 `ping` / `pong` 心跳、匹配、重连、观战和房间事件。
