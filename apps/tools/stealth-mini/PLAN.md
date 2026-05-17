# 潜行快递 — 联机版实施计划

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/stealth-mp/`

## 阶段划分

### 阶段一：联机引擎
T01 阵营系统(快递员/保安) | T02 非对称视野 | T03 地图同步 | T04 移动同步(20Hz) | T05 碰撞+追击判定 | T06 单元测试

### 阶段二：前端适配
T07 复用 stealth-express 渲染 | T08 迷雾效果 | T09 阵营 HUD | T10 房间大厅 | T11 响应式

### 阶段三：联机后端
T12 后端路由 `shared-backend/src/routes/stealth-mp/` | T13 WebSocket noServer | T14 房间管理 | T15 游戏同步 | T16 BOT 补位

### 阶段四：构建部署
T17 Vite 构建 | T18 部署 static/stealth-express | T19 注册广场 `{ icon: '🎭', label_zh: '潜行快递', label_en: 'Stealth Express', category: 'game' }` | T20 外部验证
