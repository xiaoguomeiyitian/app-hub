# app-hub 修复报告

## v1.3.0 — 代码清理（2026-05-17）

### 清理范围
对整个 app-hub 项目进行全面的死代码和冗余代码清理。

### 已完成的清理

| 类别 | 操作 | 文件 |
|------|------|------|
| 编译产物 | 删除 5 个 `.js` 文件 | `lobby-web/dist/index.js`, `lobby.js`, `navbar.js`, `static.js`, `ws-proxy.js` |
| 未使用导出 | 删除 3 个导出 | `design-system/src/tokens.ts` 中的 `typography`, `spacing`, `breakpoints` |
| 未使用函数 | 删除 1 个函数 | `app-utils/src/theme/index.ts` 中的 `provideTheme` |
| 无效测试 | 删除 1 个测试文件 | `apps/tools/todo-app/src/__tests__/todo-app.test.ts` |
| 注释代码 | 清理 1 处 | `apps/tools/todo-app/src/store.ts` 中 `catch { // ignore }` → `catch {}` |

### 保留说明

以下内容经评估后保留：

| 内容 | 原因 |
|------|------|
| `hub-server/src/integrations/app-lobby.ts` | 接口占位，CORS 中间件仍有实际作用 |
| `hub-server/src/http-stack.ts` 中的 `startRouteMonitoring` | 接口占位，日志输出有监控价值 |
| `catch {}` 块（各游戏/工具中） | 合理的静默错误处理（localStorage 不可用等） |
| `app-utils` 中的 `_ctx`, `_options`, `_pages` | 下划线前缀符合 TS 规范，预留扩展 |
| `design-system/src/tokens.ts` 中的 `colors` | 设计系统核心令牌 |

## v1.0-security — 安全修复（已完成）

| 优先级 | 问题 | 状态 |
|--------|------|------|
| P0 | CSRF 防护缺失 | ✅ 已实现 Cookie+Token 双验证 |
| P0 | 速率限制缺失 | ✅ 已限制 API 100次/分钟/IP |
| P0 | XSS 导航栏注入 | ✅ 已修复 |
| P0 | 路径遍历符号链接 | ✅ 已添加 realpath 校验 |
| P0 | SQLite 外键未启用 | ✅ 已启用 WAL + foreign_keys |
| P1 | 全局错误处理缺失 | ✅ 已添加 uncaughtException/unhandledRejection |
| P1 | 端口硬编码 | ✅ 已改为环境变量 |
| P2 | 文档不同步 | ✅ 已对齐 |

## v1.2.0 — 技术栈统一（已完成）

- 统一 Vite ^8.0.0 + TypeScript ^5.9.3
- 104 个子项目全部配置 Vitest
- 文档对齐完成
