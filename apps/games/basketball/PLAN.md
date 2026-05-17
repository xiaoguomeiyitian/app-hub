# 投篮大赛 — 实施计划

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/basketball/`

## 阶段划分

### 阶段一：投篮物理引擎
T01 抛物线物理(角度+力度+重力) | T02 篮筐碰撞(篮圈+篮板+篮网) | T03 进球检测 | T04 Combo 计分 | T05 单元测试

### 阶段二：前端 UI
T06 篮球场渲染 | T07 投篮轨迹 | T08 篮网抖动 | T09 拖拽瞄准 | T10 计分板 | T11 响应式

### 阶段三：联机后端
T12 后端路由 `shared-backend/src/routes/basketball/` | T13 WebSocket noServer | T14 1v1 比高分同步 | T15 好友房

### 阶段四：构建部署
T16 Vite 构建 | T17 部署 static/basketball | T18 注册广场 `{ icon: '🏀', label_zh: '投篮大赛', label_en: 'Basketball', category: 'game' }` | T19 外部验证
