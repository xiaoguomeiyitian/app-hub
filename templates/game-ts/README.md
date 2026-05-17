# 游戏项目模板（TypeScript + WebSocket）

## 使用方式

1. 复制本模板到 `apps/<分类>/<项目名>/` 目录
2. 修改 `src/index.ts` 中的游戏逻辑
3. 更新 `package.json` 中的 `name` 和 `description`
4. 运行 `npm install` 安装依赖
5. 运行 `npm run build` 构建
6. 运行 `npm start` 启动服务

## 目录结构

```
模板目录/
├── src/
│   └── index.ts      # 游戏主入口（WebSocket + Express）
├── package.json       # 项目配置
├── vite.config.ts    # Vite 构建配置
├── tsconfig.json      # TypeScript 配置
└── README.md         # 本文件
```

## 已集成功能

- Express HTTP 服务
- WebSocket 实时通信（自动注册）
- 玩家匹配队列
- 基础房间管理
- 日志工具（logger）
- TypeScript 严格模式

## 注意事项

- 确保 `tsconfig.json` 继承 `../../tsconfig.base.json`
- 游戏数据建议存入 `data/` 目录（自动创建）
- 静态文件可放在 `public/` 目录
