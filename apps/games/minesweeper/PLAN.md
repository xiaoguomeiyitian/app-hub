# 扫雷 — 实施计划

> 📅 创建日期: 2026-04-02
> 📁 项目目录: `/root/projects/apps/minesweeper/`
> 📎 总整编主文档：本文件

---

## 总览

| 项 | 内容 |
|---|------|
| 项目 | minesweeper（扫雷） |
| 模式 | 单人经典 + 多人竞技联机 |
| 技术栈 | Vite + TypeScript strict |
| 后端 | 已有（`shared-backend/src/routes/minesweeper/index.ts`） |
| UI 风格 | 经典 Windows 扫雷（3D 凸起格子、经典数字配色、LED 计数器） |

---

## 阶段一：项目骨架与工具函数

| # | 任务 | 说明 |
|---|------|------|
| T01 | 项目初始化 | `npm create vite` → TypeScript strict，目录 `/root/projects/apps/minesweeper/` |
| T02 | 基础文件 | `vite.config.ts`（`base: './'`）、`tsconfig.json`、`package.json` |
| T03 | 布雷算法 | `generateMines(w, h, count, safeX, safeY)` — 确保安全位置周围不布雷 |
| T04 | 邻雷计数 | `countAdjacent(x, y, mines, w, h)` |
| T05 | flood-fill 展开 | `floodReveal(x, y, board, mines, w, h)` — 空白格递归展开 |
| T06 | 胜负检测 | `checkWin(board, mines)` — 所有非雷格揭示 |

**验收**：函数可独立测试，逻辑正确。

---

## 阶段二：单人模式前端 UI

| # | 任务 | 说明 |
|---|------|------|
| T07 | 棋盘渲染 | Canvas 绘制 3D 凸起格子，按下变平 |
| T08 | 数字颜色 | 1蓝 2绿 3红 4深蓝 5暗红 6青 7黑 8灰 |
| T09 | 笑脸按钮 | 😊/😮/😎/😵 四态 |
| T10 | LED 计数器 | 雷数（红色七段风格）+ 计时器 |
| T11 | 左键揭示 | 点击揭示，首次安全（重新布雷） |
| T12 | 右键插旗 | 循环：空→旗→问号→空 |
| T13 | 双键和弦 | 数字格周围旗数匹配时自动揭示周围 |
| T14 | 难度选择 | 初/中/高级预设 + 自定义宽/高/雷数输入 |
| T15 | 游戏状态 | 3D 边框、揭雷动画、踩雷标红 |
| T16 | 最佳记录 | localStorage 按难度存储最佳时间 |

**验收**：
- 单人模式完整可玩
- 三档难度 + 自定义尺寸均可正常游戏
- 首次安全保证
- 计时器从首次点击开始
- 胜利/失败状态正确

---

## 阶段三：多人竞技联机

| # | 任务 | 说明 |
|---|------|------|
| T17 | WS 连接 | `getWsUrl()` → `/api/minesweeper/websocket`（原生 WebSocket） |
| T18 | 连接确认 | 收到 `connected` 事件 |
| T19 | 创建房间 | `room:create` → 收到 `room:created`（含 gameId） |
| T20 | 加入房间 | `room:join` → 收到 `room:joined` |
| T21 | 游戏开始 | 收到 `game:start` → 根据 seed 布局棋盘 |
| T22 | 竞技揭示 | 发送 `game:reveal`，接收对手 `game:reveal`/`game:mine` |
| T23 | 游戏结束 | 收到 `game:over` → 显示排名 |
| T24 | 心跳保活 | 每 20 秒 `ping` → 服务端 `pong` |
| T25 | 昵称输入 | 进入联机模式时输入昵称 |
| T26 | UI 切换 | 单人/联机模式切换界面 |

**验收**：
- 通过外部域名 `wss://97.383636.xyz/code/20008/api/minesweeper/websocket` 连接成功
- 创建房间+加入房间流程走通
- 多人同时揭示同步正确
- 踩雷淘汰逻辑正确
- 心跳不超时断线

---

## 阶段四：响应式适配与音效

| # | 任务 | 说明 |
|---|------|------|
| T27 | 响应式布局 | 棋盘缩放适配各分辨率，小屏可滚动 |
| T28 | 触屏适配 | 长按=右键插旗，点击=左键揭示 |
| T29 | 音效 | 揭示、插旗、踩雷、胜利（可开关） |
| T30 | 8 分辨率验收 | 375/390/412/768/1024/1280/1366/1920 全部通过 |

**验收**：
- 全部 8 个分辨率无溢出、无截断
- 触屏设备长按插旗可用
- 音效正常播放

---

## 阶段五：构建部署

| # | 任务 | 说明 |
|---|------|------|
| T31 | `npm run build` | Vite 构建，`base: './'` |
| T32 | 部署静态文件 | `cp -r dist/* /root/projects/static/minesweeper/` |
| T33 | 注册检查 | 确认 `project-catalog.ts` 中 minesweeper 已注册 |
| T34 | 浏览器验收 | 打开外部 URL 逐一验证功能 |
| T35 | git 提交 | `git init`（如未初始化）+ 首次提交 + tag `v1.0` |

**验收**：
- `https://97.383636.xyz/code/20008/minesweeper/` 返回 200
- JS/CSS 资源加载正常
- 浏览器控制台无报错
- 单人模式和联机模式均可用

---

## 依赖关系

```
阶段一（骨架）→ 阶段二（单人 UI）→ 阶段三（联机）→ 阶段四（响应式）→ 阶段五（部署）
```

联机依赖单人模式已完成（棋盘渲染、揭示逻辑可复用）。

---

## 风险与回滚

| 风险 | 影响 | 应对 |
|------|------|------|
| 高级尺寸（30×16）在小屏溢出 | 手机无法完整显示 | 缩放 + 可滚动棋盘容器 |
| WebSocket 连接失败 | 联机不可用 | 降级为纯单人模式，显示"联机暂不可用" |
| 触屏右键事件 | 手机无法插旗 | 长按触发插旗 |
| 后端 seed 布雷算法不一致 | 前后端棋盘不匹配 | 前端复用后端同一套算法，用 seed 生成 |

---

## 回滚方案

如遇不可解决的技术问题：
1. 删除 `/root/projects/apps/minesweeper/` 和 `/root/projects/static/minesweeper/`
2. 从 `project-catalog.ts` 中移除 minesweeper 条目
3. 重启共享后端
