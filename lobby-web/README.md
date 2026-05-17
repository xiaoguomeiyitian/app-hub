# app-lobby — 应用大厅前端

> 应用大厅的前端入口层，负责静态页面服务、导航栏注入和 WebSocket 代理。

## 职责

- **静态页面服务**：服务 `static/` 目录下的 HTML 页面
- **导航栏注入**：向所有 HTML 页面注入统一导航栏
- **CSRF 注入**：向页面注入 CSRF Token meta 标签
- **WebSocket 代理**：将 `/sio/<project>/websocket` 代理到后端
- **CORS 配置**：限制为应用大厅域名

## 架构

```
lobby-web/
├── src/
│   ├── index.ts      # 入口：Express + HTTP Server
│   ├── static.ts     # 静态文件服务 + 导航栏注入
│   ├── navbar.ts     # 导航栏 HTML 模板
│   └── ws-proxy.ts   # WebSocket 反向代理
├── package.json
└── tsconfig.json
```

## 快速开始

```bash
cd lobby-web
npm install
npm run dev
```

## 独立启动

默认不监听端口，由 hub-server 复用。需要独立运行时：

```bash
OC_APP_LOBBY_STANDALONE=1 npm run standalone
```

## 导航栏

导航栏通过 `navbar.ts` 中的 `NAV_BAR` 模板注入到所有 HTML 页面：

- 固定在顶部
- 包含返回大厅首页链接
- 响应式布局（移动端适配）
- 动态计算基础 URL

## WebSocket 代理

路径规则：`/sio/<project>/websocket` → `ws://<backend>/api/<project>/websocket`

## CORS 配置

通过环境变量 `CORS_ORIGINS` 配置，逗号分隔多个域名：

```
CORS_ORIGINS=https://97.383636.xyz,https://97.testgame.online
```

## 测试

```bash
npm test
```

测试文件：`src/__tests__/app-lobby.test.ts`
