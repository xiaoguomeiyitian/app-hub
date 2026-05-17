# bejeweled

宝石消除小游戏。

## 功能
- 当前项目以现有代码实现为准，提供对应的核心交互或游戏玩法。
- 界面与交互已集成在前端主入口中。

## 运行

```bash
cd /root/projects/apps/bejeweled && npm install && npm run dev
```

## 构建

```bash
cd /root/projects/apps/bejeweled && npm run build
```

## 说明
- 前端采用 Vite + TypeScript。
- 生产构建使用相对路径 `base: './'`。
- 若项目包含联机能力，请以代码中的 WebSocket 路径与共享后端路由为准。
