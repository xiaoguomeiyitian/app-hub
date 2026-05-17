# shared-backend 需求说明

## 核心职责

为应用大厅各前端项目提供统一后端入口与路由分发能力。

## 功能需求

### 路由分发
- 按 `/api/<项目名>/...` 路由分发到各项目
- 支持 Express Router 和 WebSocket
- 项目级 API 命名空间隔离

### 项目发现
- 自动扫描 `src/routes/` 目录
- 支持手动触发重新扫描（`POST /api/_rescan`）
- 排除特定项目（admin, auth, platform, platform-console）

### 静态资源服务
- 服务 `static/` 目录下的构建产物
- 自动导航栏注入
- 路径遍历防护
- ETag/Last-Modified 缓存

### 数据统计
- 项目点击统计（SQLite 存储）
- 30 秒缓存 TTL
- 单 flight 模式防缓存击穿

### 安全
- CSRF 防护（Cookie + Token 双验证）
- 速率限制（API 100次/分钟/IP）
- 管理员接口 API Key 认证

## 验收标准

- [ ] 新增路由可通过 `POST /api/_rescan` 发现
- [ ] `/health` 返回正常状态
- [ ] 各项目路由互不干扰
- [ ] WebSocket 项目路由可用
- [ ] CSRF 防护生效
- [ ] 速率限制生效
