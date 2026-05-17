# tetris

俄罗斯方块，支持单机与联机模式。

## 功能
- 当前项目以现有代码实现为准，提供对应的核心交互或游戏玩法。
- 界面与交互已集成在前端主入口中。

## 运行

```bash
cd /root/projects/apps/tetris && npm install && npm run dev
```

## 构建

```bash
cd /root/projects/apps/tetris && npm run build
```

## 说明
- 前端采用 Vite + TypeScript。
- 生产构建使用相对路径 `base: './'`。
- 联机后端路由位于 `/root/projects/shared-backend/src/routes/tetris-mp/`。
- WebSocket 连接路径为 `/api/tetris-mp/websocket`。
