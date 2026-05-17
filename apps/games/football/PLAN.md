# 像素足球 — 实施计划

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/football/`

## 阶段划分

### 阶段一：核心引擎
T01 球场数据 | T02 球员移动 | T03 球物理 | T04 传球/射门 | T05 AI 跑位 | T06 单元测试

### 阶段二：前端 UI
T07 Canvas 渲染 | T08 球员精灵 | T09 进球特效 | T10 虚拟摇杆 | T11 响应式(横屏优先)

### 阶段三：联机后端
T12 后端路由 `shared-backend/src/routes/football/` | T13 WebSocket noServer | T14 实时同步 20Hz | T15 好友房

### 阶段四：构建部署
T16 Vite 构建 | T17 部署 static/football | T18 注册广场 `{ icon: '⚽', label_zh: '像素足球', label_en: 'Football', category: 'game' }` | T19 外部验证
