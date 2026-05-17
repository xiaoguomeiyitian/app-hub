# app-hub — 应用大厅

> 统一的应用集合平台，包含 99 个前端子项目、共享后端服务和前端工具库。
> 大厅前端已整合到 hub-server 中，通过 `static/<项目名>/` 提供静态文件服务。

---

## 目录

1. [架构总览](#一-架构总览)
2. [项目目录与端口](#二-项目目录与端口)
3. [访问地址](#三-访问地址)
4. [npm 脚本](#四-npm-脚本)
5. [快速开始](#五-快速开始)
6. [hub-server 架构](#六-hub-server-架构)
7. [共享包](#七-共享包)
8. [部署流程](#八-部署流程)
9. [子项目统计](#九-子项目统计)

---

## 一、架构总览

应用大厅采用前后端一体化架构，hub-server 同时承担后端 API 和前端静态服务：

| 层级 | 目录 | 定位 |
|------|------|------|
| **业务层** | `apps/<分类>/<项目名>/` | 99 个独立前端应用 |
| **服务层** | `hub-server/` | 统一后端 + 大厅页面 + 静态文件服务 |
| **共享包** | `packages/` | app-utils（前端工具库）+ design-system（设计系统） |
| **部署产物** | `static/<项目名>/` | 各应用构建输出，由 hub-server 统一服务 |

```
app-hub/
├── hub-server/         # 统一后端服务（Express + SQLite + WebSocket）
│   ├── src/
│   │   ├── index.ts           # 入口
│   │   ├── config.ts          # 配置
│   │   ├── router.ts          # 路由发现与加载
│   │   ├── route-loader.ts    # 项目路由动态加载
│   │   ├── http-stack.ts      # HTTP 中间件栈
│   │   ├── static-site.ts     # 静态文件服务 + 导航栏注入
│   │   ├── static-ui.ts       # 导航栏 HTML 模板
│   │   ├── lobby-page.ts      # 大厅首页 HTML 生成
│   │   ├── project-catalog.ts # 项目目录发现与元数据
│   │   ├── project-meta.json  # 项目元数据
│   │   ├── db.ts              # SQLite 数据库
│   │   ├── logger.ts          # 日志
│   │   ├── routes/            # 后端路由（34 个 API 项目）
│   │   └── __tests__/         # 测试文件
│   └── dist/                  # 编译输出
├── apps/               # 业务子项目（99 个）
│   ├── games/          # 游戏类（33 个）
│   ├── tools/          # 工具类（45 个）
│   ├── art/            # 创意艺术类（9 个）
│   ├── audio/          # 音频类（4 个）
│   └── visual/         # 视觉特效类（8 个）
├── packages/           # 共享包
│   ├── app-utils/      # @app-hub/utils
│   └── design-system/  # @app-hub/design-system
├── static/             # 部署产物（99 个应用目录）
├── scripts/            # 运维脚本
└── data/               # SQLite 数据库文件
```

---

## 二、项目目录与端口

### 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| 应用大厅 + 共享后端 | `20008` | 统一入口，前后端一体化 |

### 项目目录

| 类型 | 路径 |
|------|------|
| 统一后端 | `<项目根目录>/hub-server/` |
| 子项目源码 | `<项目根目录>/apps/<分类>/<项目名>/` |
| 静态资源 | `<项目根目录>/static/<项目名>/` |
| 数据库 | `<项目根目录>/data/<项目名>.db` |
| 共享包 | `<项目根目录>/packages/` |

---

## 三、访问地址

### 内网访问

| 路径 | 说明 |
|------|------|
| `http://localhost:20008/` | 大厅首页（应用列表） |
| `http://localhost:20008/health` | 健康检查 |
| `http://localhost:20008/api` | 项目列表 API |
| `http://localhost:20008/<项目名>/` | 子项目页面 |

### 外网访问

| 路径 | 说明 |
|------|------|
| `https://97.383636.xyz/code/20008/` | 大厅首页 |
| `https://97.383636.xyz/code/20008/health` | 健康检查 |
| `https://97.383636.xyz/code/20008/api` | 项目列表 API |
| `https://97.383636.xyz/code/20008/<项目名>/` | 子项目页面 |

---

## 四、npm 脚本

在项目根目录执行：

| 命令 | 说明 |
|------|------|
| `npm run init` | 完整初始化（清理 + 安装 + 构建 + 启动） |
| `npm run init:core` | 仅初始化核心服务（快速启动） |
| `npm run start` | 启动应用大厅服务器（hub-server） |
| `npm run start:dev` | 开发模式启动（tsx watch） |
| `npm run build:all` | 安装依赖 + 构建所有子项目并同步到 static |
| `npm run build:sample` | 抽样安装依赖 + 构建 10 个项目 |
| `npm run check:port` | 检查端口占用状态 |
| `npm run check:health` | 健康检查 |
| `npm run verify:deploy` | 部署验证 |

---

## 五、快速开始

### 启动应用大厅

```bash
cd hub-server
npm install
npm run build
npm start
```

### 构建所有应用并同步到 static

```bash
# 在项目根目录执行
node scripts/build-all-apps.js
```

该脚本会：
1. 扫描 `apps/` 目录下所有应用
2. 安装依赖（如果 node_modules 不存在）
3. 执行 `npm run build`（失败则尝试 `npx vite build` 跳过 tsc）
4. 将 `dist/` 内容复制到 `static/<项目名>/`

---

## 六、hub-server 架构

### 源文件结构

```
hub-server/src/
├── index.ts                     # 入口：Express + HTTP Server 启动
├── config.ts                    # 配置（端口、路径、环境变量）
├── router.ts                    # 路由发现、加载、重扫描
├── route-loader.ts              # 项目路由模块动态加载器
├── http-stack.ts                # HTTP 中间件栈（CSRF/限流/静态/API）
├── static-site.ts               # 静态站点服务 + 导航栏注入
├── static-ui.ts                 # 导航栏 HTML 模板（右上角浮动）
├── lobby-page.ts                # 大厅首页 HTML 生成（内嵌应用列表）
├── lobby-snapshot.ts            # 大厅初始化/引导快照构建
├── project-catalog.ts           # 项目目录发现与元数据管理
├── project-meta.json            # 项目元数据（图标、名称、描述）
├── db.ts                        # SQLite 数据库连接管理（WAL 模式）
├── logger.ts                    # 日志工具
├── route-health.ts              # 健康检查路由注册
├── upgrade-listener-registry.ts # WebSocket 升级监听器注册表
├── types/                       # 类型定义
├── routes/                      # 后端 API 路由（34 个）
└── __tests__/                   # 测试文件（7 个）
```

### 静态文件服务

| 路由 | 处理 |
|------|------|
| `GET /` | 返回大厅首页（内嵌应用列表 HTML） |
| `/<项目名>/*` | 从 `static/<项目名>/` 提供静态文件 |
| HTML 页面 | 自动注入导航栏（返回应用大厅）+ CSRF Token |

### 大厅首页

大厅首页由 `lobby-page.ts` 动态生成，包含：
- 顶部导航栏（logo + 最近/收藏/主题/语言按钮）
- 搜索框（实时过滤）
- 分类筛选 chip 按钮
- 应用卡片网格（图标/名称/描述/分类/访问次数）
- 深色/亮色双主题支持

---

## 七、共享包

### @app-hub/utils

前端工具库，提供 7 个模块：`idb`、`theme`、`charts`、`export`、`layers`、`audio-recorder`、`qr`

### @app-hub/design-system

设计系统，提供 CSS 自定义属性和 TypeScript 色彩令牌。

---

## 八、部署流程

### 1. 构建所有应用

```bash
node scripts/build-all-apps.js
```

### 2. 构建并启动 hub-server

```bash
cd hub-server
npm install
npm run build
npm start
```

---

## 九、子项目统计

> 最后更新：2026-05-17

### 按分类统计

| 分类 | 数量 |
|------|------|
| games（游戏类） | 33 |
| tools（工具类） | 45 |
| art（创意艺术类） | 9 |
| audio（音频类） | 4 |
| visual（视觉特效类） | 8 |
| **合计** | **99** |

### 构建失败已删除（4 个）

- decision-wheel、doodle、text-diff、weather-widget（源代码语法错误）

### 后端 API 路由（34 个）

basketball, battleship, bejeweled, blackjack, bomberman, checkers, connect4, darts, flappy-bird, football, game-2048-mp, go-game, gomoku-mp, guandan-mp, guestbook, mahjong, minesweeper, pacman, paodekuai, pastebin, pinball, pong, racing, reversi, snake-mp, space-shooter, spyfall, sudoku, tetris-mp, typing-speed, url-shortener, werewolf, wordle, xiangqi
