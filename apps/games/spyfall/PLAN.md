# 谁是卧底 — 实施计划

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/spyfall/`

## 阶段划分

### 阶段一：游戏引擎
T01 房间管理 | T02 词卡分配(卧底/平民/白板) | T03 描述轮轮流 | T04 投票计票 | T05 胜负判定 | T06 单元测试

### 阶段二：AI 系统
T07 AI 描述生成(基于词的近义/关联) | T08 AI 投票策略 | T09 AI 补位

### 阶段三：前端 UI
T10 房间大厅 | T11 词卡翻转显示 | T12 描述气泡 | T13 投票界面 | T14 响应式

### 阶段四：联机后端
T15 后端路由 `shared-backend/src/routes/spyfall/` | T16 WebSocket noServer | T17 房间+阶段同步 | T18 词库数据库

### 阶段五：构建部署
T19 Vite 构建 | T20 部署 static/spyfall | T21 注册广场 `{ icon: '🕵️', label_zh: '谁是卧底', label_en: 'Spyfall', category: 'game' }` | T22 外部验证
