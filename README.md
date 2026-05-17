# app-hub — 应用大厅

> 统一的应用集合平台，包含 104 个前端子项目、共享后端服务和前端工具库。

## 架构概览

```
app-hub/
├── lobby-web/          # 大厅前端（Express 静态服务 + 导航栏注入）
├── hub-server/         # 共享后端（Express + SQLite + WebSocket）
├── apps/               # 业务子项目（104 个）
│   ├── games/          # 游戏类（33 个）
│   ├── tools/          # 工具类（47 个）
│   ├── art/            # 创意艺术类（10 个）
│   ├── audio/          # 音频类（4 个）
│   └── visual/         # 视觉特效类（10 个）
├── packages/           # 共享包
│   ├── app-utils/      # @app-hub/utils — 前端工具库
│   └── design-system/  # @app-hub/design-system — 设计系统
├── static/             # 部署产物（构建输出）
├── data/               # SQLite 数据库文件
├── docs/               # 技术文档
├── scripts/            # 运维脚本
└── reports/            # 报告与日志
```

## 三层架构

| 层级 | 目录 | 职责 |
|------|------|------|
| **前端层** | `lobby-web/` | 应用大厅页面服务、导航栏注入、WebSocket 代理 |
| **业务层** | `apps/<分类>/<项目>/` | 各子项目独立业务逻辑 |
| **后端层** | `hub-server/` | 统一 API 出口、项目发现、路由分发、数据统计 |

## 端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 应用大厅 + 共享后端 | `20008` | 统一入口 |

## 访问地址

### 外网访问

| 路径 | 说明 |
|------|------|
| `https://97.383636.xyz/code/20008/` | 大厅首页 |
| `https://97.383636.xyz/code/20008/health` | 健康检查 |
| `https://97.383636.xyz/code/20008/api` | 项目列表 API |
| `https://97.383636.xyz/code/20008/<项目名>/` | 子项目页面 |

### 内网访问

| 路径 | 说明 |
|------|------|
| `http://localhost:20008/` | 大厅首页 |
| `http://localhost:20008/health` | 健康检查 |
| `http://localhost:20008/api` | 项目列表 API |
| `http://localhost:20008/<项目名>/` | 子项目页面 |

## 快速开始

### 启动共享后端

```bash
cd hub-server
npm install
npm run build
npm start
```

### 启动大厅前端（独立模式）

```bash
cd lobby-web
npm install
npm run dev
# 或独立启动
OC_APP_LOBBY_STANDALONE=1 npm run standalone
```

### 构建子项目

```bash
cd apps/tools/todo-app
npm install
npm run build
cp -r dist/* /root/projects/app-hub/static/todo-app/
```

## 子项目统计

| 分类 | 数量 | 示例 |
|------|------|------|
| 游戏 (games) | 33 | sudoku, werewolf, connect4, bejeweled, wordle |
| 工具 (tools) | 47 | calculator, kanban, pomodoro, todo-app, qr-generator |
| 艺术 (art) | 10 | pixel-art, svg-editor, text-animator, doodle |
| 音频 (audio) | 4 | virtual-piano, ambient-music, sound-sculpture |
| 视觉 (visual) | 10 | game-of-life, fractal-explorer, starfield |
| **合计** | **104** | |

## 共享包

### @app-hub/utils

前端工具库，提供以下模块：

| 模块 | 说明 |
|------|------|
| `idb` | IndexedDB 封装（基于 `idb` 库） |
| `theme` | 主题切换（light/dark） |
| `charts` | Chart.js 图表封装 |
| `export` | Canvas 导出（PNG/JPG/SVG/PDF） |
| `layers` | 图层管理（LayerStack） |
| `audio-recorder` | 浏览器录音与 WAV 编码 |
| `qr` | 二维码生成 |

### @app-hub/design-system

设计系统，提供 CSS 变量和色彩系统：

- `src/style.css` — CSS 自定义属性（颜色、字体、间距、断点）
- `src/tokens.ts` — TypeScript 色彩令牌

## 技术栈

| 领域 | 技术 |
|------|------|
| 前端构建 | Vite ^8.0.0 + TypeScript ^5.9.3 |
| 后端 | Express 5 + better-sqlite3 + ws |
| 测试 | Vitest + jsdom + V8 Coverage |
| 代码规范 | ESLint + Prettier |

## npm 脚本

在项目根目录执行：

| 命令 | 说明 |
|------|------|
| `npm run init` | 完整初始化（清理 + 安装 + 构建 + 启动） |
| `npm run init:core` | 仅初始化核心服务（快速启动） |
| `npm run init:skip-clean` | 跳过清理（保留已有 node_modules） |
| `npm run init:skip-build` | 仅安装依赖，不构建 |
| `npm run start` | 启动应用大厅服务器（hub-server） |
| `npm run start:dev` | 开发模式启动（tsx watch） |
| `npm run build:all` | 安装依赖 + 构建所有子项目 |
| `npm run build:sample` | 抽样安装依赖 + 构建 10 个项目 |
| `npm run check:port` | 检查端口占用状态 |
| `npm run check:health` | 健康检查 |
| `npm run verify:deploy` | 部署验证 |

## 文档

- [技术文档](docs/应用大厅技术文档.md) — 完整技术细节
- [hub-server 文档](hub-server/README.md) — 后端服务文档
- [lobby-web 文档](lobby-web/README.md) — 大厅前端文档
