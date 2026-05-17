# shared-backend — 共享后端服务

> 应用大厅的统一后端入口，负责路由分发、项目发现、静态资源服务和数据统计。

## 职责

- **路由分发**：按 `/api/<项目名>/...` 将请求分发到各项目路由
- **项目发现**：自动扫描 `src/routes/` 目录，动态加载项目路由
- **热加载**：支持运行时重新加载项目路由（`POST /api/_rescan`）
- **静态服务**：提供 `static/` 目录下的静态资源服务
- **导航栏注入**：向 HTML 页面注入统一导航栏
- **数据统计**：项目点击统计（SQLite 存储）
- **WebSocket**：支持项目级 WebSocket 升级

## 快速开始

```bash
cd hub-server
npm install
npm run build
npm start
```

服务运行在 `0.0.0.0:20008`。

### 访问地址

| 路径 | 说明 |
|------|------|
| `http://localhost:20008/` | 内网大厅首页 |
| `https://97.383636.xyz/code/20008/` | 外网大厅首页 |
| `http://localhost:20008/health` | 内网健康检查 |
| `https://97.383636.xyz/code/20008/health` | 外网健康检查 |

## API 路由

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/health` | 健康检查（含项目列表+点击统计） | 无 |
| GET | `/api` | 项目列表+分类 | 无 |
| GET | `/api/projects` | 项目列表+分类 | 无 |
| GET | `/api/foundation` | 大厅初始化快照 | 无 |
| GET | `/api/onboarding` | 大厅引导快照 | 无 |
| POST | `/api/click` | 项目点击统计 | 无 |
| POST | `/api/_rescan` | 重新扫描项目 | Admin API Key |
| GET | `/debug-query` | 调试路由（仅开发环境） | 无 |
| GET | `/debug-loaded` | 已加载项目调试（仅开发环境） | 无 |

## 项目路由约定

路由文件位于 `src/routes/<项目名>/index.ts`，每个项目导出：

```typescript
export const description: string = "项目描述";
export const router: Router = express.Router();
// 可选：WebSocket 支持
export const socketSetup: (httpServer: HttpServer, wsPath: string) => void;
```

## 配置

通过环境变量配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `20008` | 服务端口 |
| `STATIC_ROOT` | `/root/projects/app-hub/static` | 静态资源根目录 |
| `HOME_URL` | `/openclaw/20008/` | 首页 URL 前缀 |
| `ADMIN_API_KEY` | (空) | 管理员 API Key |
| `STATIC_DISCOVERY_TTL_MS` | `60000` | 静态发现缓存 TTL |

## 数据库

使用 SQLite（WAL 模式），数据文件位于 `data/` 目录：

| 文件 | 用途 |
|------|------|
| `analytics.db` | 点击统计 |
| `<项目名>.db` | 各项目独立数据库 |

## 安全

- CSRF 防护：Cookie + Token 双验证
- 速率限制：API 接口 100次/分钟/IP
- 路径遍历防护：realpath 校验
- 管理员接口：API Key 认证

## 已加载路由（34 个）

`basketball`, `battleship`, `bejeweled`, `blackjack`, `bomberman`, `checkers`, `connect4`, `darts`, `flappy-bird`, `football`, `game-2048-mp`, `go-game`, `gomoku-mp`, `guandan-mp`, `guestbook`, `mahjong`, `minesweeper`, `pacman`, `paodekuai`, `pastebin`, `pinball`, `pong`, `racing`, `reversi`, `snake-mp`, `space-shooter`, `spyfall`, `sudoku`, `tetris-mp`, `typing-speed`, `url-shortener`, `werewolf`, `wordle`, `xiangqi`

## 测试

```bash
npm test
```

测试文件位于 `src/__tests__/`，使用 Node.js 原生 test runner + tsx。
