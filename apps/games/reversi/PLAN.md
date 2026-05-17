# 黑白棋 — 实施计划

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/reversi/`

## 阶段划分

### 阶段一：黑白棋引擎
T01 棋盘 8×8 | T02 落子规则(必须夹住) | T03 翻转逻辑(多方向) | T04 胜负判定 | T05 AI(Minimax+位置权重) | T06 单元测试

### 阶段二：前端 UI
T07 Canvas 棋盘 | T08 翻转动画 | T09 合法落点高亮 | T10 棋子计数 | T11 响应式

### 阶段三：联机后端
T12 后端路由 `shared-backend/src/routes/reversi/` | T13 WebSocket noServer | T14 匹配+好友房 | T15 实时同步

### 阶段四：构建部署
T16 Vite 构建 | T17 部署 static/reversi | T18 注册广场 `{ icon: '🔄', label_zh: '黑白棋', label_en: 'Reversi', category: 'game' }` | T19 外部验证
