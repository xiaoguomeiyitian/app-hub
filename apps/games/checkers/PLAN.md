# 跳棋 — 实施计划

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/checkers/`

## 阶段划分

### 阶段一：跳棋引擎
T01 棋盘 8×8 | T02 棋子+移动规则 | T03 跳吃+连跳 | T04 升王 | T05 胜负判定 | T06 AI(Minimax) | T07 单元测试

### 阶段二：前端 UI
T08 Canvas 棋盘 | T09 棋子绘制 | T10 移动动画 | T11 升王皇冠 | T12 响应式

### 阶段三：联机后端
T13 后端路由 `shared-backend/src/routes/checkers/` | T14 WebSocket noServer | T15 2/4/6 人模式 | T16 好友房

### 阶段四：构建部署
T17 Vite 构建 | T18 部署 static/checkers | T19 注册广场 `{ icon: '⚫', label_zh: '跳棋', label_en: 'Checkers', category: 'game' }` | T20 外部验证
