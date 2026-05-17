# pomodoro

PROJ_DESC。

## 功能
- 当前项目以现有代码实现为准，提供对应的核心交互或游戏玩法。
- 界面与交互已集成在前端主入口中。

## 运行
cd /root/projects/apps/pomodoro && npm install && npm run dev

## 构建
cd /root/projects/apps/pomodoro && npm run build

## 说明
- 前端采用 Vite + TypeScript。
- 生产构建使用相对路径 base: './'。
- 若项目包含联机能力，请以代码中的 WebSocket 路径与共享后端路由为准。

## 功能列表
- 标准番茄钟计时（25分钟工作+5分钟休息）
- 自定义计时时长
- 任务关联与完成统计
- 计时结束提醒

## 应用截图
（截图位置，部署后补充实际截图）

## 使用文档
[完整使用指南](docs/usage.md)

## 版本历史
### v1.3.0
- 完善使用文档docs/usage.md
- 添加任务关联功能说明
- 优化统计面板

### v1.2.0
- 支持自定义计时时长
- 修复计时偏差问题

### v1.1.0
- 添加统计功能
- 优化通知逻辑

### v1.0.0
- 初始版本发布，支持基础番茄钟计时
