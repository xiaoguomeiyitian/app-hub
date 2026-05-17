# 中国象棋

纯前端中国象棋，支持**单机对战 AI**、**残局挑战**、**在线匹配对战**、**好友房间对战**、**历史复盘**和**随机观战**。

## 特性

### 单机模式
- 纯前端运行，无需后端
- AI 对战（简单 / 中等 / 困难）
- 支持选择执红 / 执黑
- 悔棋 / 重开 / 认输

### 残局挑战
- 经典残局闯关
- 提示、重试、闯关进度保存
- 完成后可继续下一关或返回列表

### 在线模式
- WebSocket 实时匹配对战
- 先选时间档位再进入匹配
- 断线重连
- 超时判负
- 匹配超时后可由机器人补位

### 好友对战 / 观战 / 复盘
- 房间码创建与加入好友对战
- 随机观战与观战列表
- 历史对局查询与复盘分析

## 启动

```bash
npm install
npm run dev          # 开发模式
npm run build        # 构建
npm run build && rm -rf /root/projects/static/xiangqi/* && cp -r dist/* /root/projects/static/xiangqi/   # 构建并部署到静态资源目录
```

## 目录

| 文件 | 说明 |
|------|------|
| `src/types.ts` | 类型定义 |
| `src/board-setup.ts` | 棋盘初始化 |
| `src/logic.ts` | 走棋规则引擎 |
| `src/ai-engine.ts` | 本地 AI（minimax/alpha-beta） |
| `src/game.ts` | 单机游戏控制器 |
| `src/puzzle-game.ts` | 残局挑战控制器 |
| `src/online-game.ts` | 在线 / 好友 / 观战控制器 |
| `src/history.ts` | 历史对局数据 |
| `src/review.ts` | 复盘分析 |
| `src/board.ts` | 棋盘渲染与视角映射 |
| `src/ui.ts` | UI 界面管理 |
| `src/main.ts` | 入口（模式选择路由） |

## 后端路由

共享后端：`/root/projects/shared-backend/src/routes/xiangqi/`

| 文件 | 说明 |
|------|------|
| `index.ts` | Express 路由 + 原生 WebSocket 入口 |
| `room.ts` | 房间管理 + 游戏状态 |
| `match-queue.ts` | 匹配队列（时间档位匹配） |
| `game-logic.ts` | 服务端走棋规则验证 |
| `bot-ai.ts` | 机器人陪玩 AI |
| `types.ts` | WebSocket 协议类型 |

## 访问

构建后通过应用大厅访问，项目展示名为"中国象棋"。

## 发布流程

每次修改代码后必须执行：

```bash
npm run build
rm -rf /root/projects/static/xiangqi/*
cp -r dist/* /root/projects/static/xiangqi/
```
