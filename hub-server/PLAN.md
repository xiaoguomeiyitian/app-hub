# shared-backend 计划

## 当前状态

- ✅ 后端统一入口运行中
- ✅ 路由热加载机制已具备
- ✅ 34 个项目路由已加载
- ✅ 大厅初始化/引导快照接口已实现
- ✅ CSRF 防护 + 速率限制已实现
- ✅ SQLite WAL 模式已启用

## 架构

```
src/
├── index.ts                     # 入口：Express + HTTP Server 启动
├── config.ts                    # 配置（端口、路径、环境变量）
├── router.ts                    # 路由发现、加载、重扫描
├── route-loader.ts              # 项目路由模块动态加载器
├── http-stack.ts                # HTTP 中间件栈
├── static-site.ts               # 静态站点服务 + 导航栏注入
├── static-ui.ts                 # 导航栏 HTML 模板
├── lobby-snapshot.ts            # 大厅快照构建
├── project-catalog.ts           # 项目目录发现与元数据
├── project-meta.json            # 项目元数据
├── db.ts                        # SQLite 数据库连接管理
├── logger.ts                    # 日志工具
├── route-health.ts              # 健康检查路由
├── upgrade-listener-registry.ts # WebSocket 升级监听器
├── integrations/
│   └── app-lobby.ts            # app-lobby 集成层
├── types/                       # 类型定义
│   ├── constants.ts
│   ├── game.ts
│   └── messages.ts
├── routes/                      # 项目路由（34 个）
└── __tests__/                   # 测试文件（7 个）
```

## 后续计划

### P0 — 稳定性
- 完善错误处理
- 数据库备份策略

### P1 — 功能
- 项目路由自动热重载（文件监听）
- 更完善的项目元数据管理

### P2 — 优化
- 性能监控
- 日志分级存储
