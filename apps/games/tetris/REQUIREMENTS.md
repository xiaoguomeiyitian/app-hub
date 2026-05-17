# 需求文档 - tetris

> 项目目录: /root/projects/apps/tetris
> 后端路由: /root/projects/shared-backend/src/routes/tetris-mp/

## 功能需求
- 提供俄罗斯方块游戏
- 支持无尽模式、40 行竞速模式与联机模式
- 支持方向键、Space、Z/X、C、P 等操作
- 联机模式下通过 WebSocket 进行对战

## 技术约束
| 项目 | 要求 |
|------|------|
| 前端构建 | Vite + TypeScript (strict) |
| 前端端口 | 20010 |
| 生产构建 | `base: './'` |
| 开发访问 | `server.host: '0.0.0.0'` |
| 联机通信 | 原生 WebSocket，路径 `/api/tetris-mp/websocket` |

## 验收标准
- [ ] 无尽模式可正常游玩
- [ ] 40 行竞速模式可正常切换
- [ ] 联机模式可连接并进入对局
- [ ] 键盘控制与暂停功能正常
- [ ] TypeScript 与构建通过
