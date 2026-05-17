# 需求文档 - game-2048

> 项目目录: /root/projects/apps/game-2048
> 后端路由: /root/projects/shared-backend/src/routes/game-2048-mp/

## 功能需求
- 提供 2048 数字合并游戏
- 支持单人模式与联机模式
- 支持键盘方向键与触摸滑动
- 联机模式下可通过 WebSocket 与对手交互

## 技术约束
| 项目 | 要求 |
|------|------|
| 前端构建 | Vite + TypeScript (strict) |
| 前端端口 | 20011 |
| 生产构建 | `base: './'` |
| 开发访问 | `server.host: '0.0.0.0'` |
| 联机通信 | 原生 WebSocket，路径 `/api/game-2048-mp/websocket` |

## 验收标准
- [ ] 单人模式可正常进行并计分
- [ ] 联机模式可连接后端并进入对局
- [ ] 方向键与触摸滑动可用
- [ ] WebSocket 连接、消息往返、断开清理正常
- [ ] TypeScript 与构建通过
