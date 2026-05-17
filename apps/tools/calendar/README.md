# calendar

日历查看与管理工具。

## 功能
- 当前项目以现有代码实现为准，提供对应的核心交互或游戏玩法。
- 界面与交互已集成在前端主入口中。

## 运行

```bash
cd /root/projects/apps/calendar && npm install && npm run dev
```

## 构建

```bash
cd /root/projects/apps/calendar && npm run build
```

## 说明
- 前端采用 Vite + TypeScript。
- 生产构建使用相对路径 `base: './'`。
- 若项目包含联机能力，请以代码中的 WebSocket 路径与共享后端路由为准。

## 功能列表
- 月/周/日视图切换
- 事件添加、编辑、删除
- 事件提醒设置
- 事件导入导出（iCal格式）

## 应用截图
（截图位置，部署后补充实际截图）

## 使用文档
[完整使用指南](docs/usage.md)

## 版本历史
### v1.3.0
- 完善使用文档docs/usage.md
- 添加事件导入导出说明
- 优化视图切换逻辑

### v1.2.0
- 支持事件重复设置
- 修复提醒延迟问题

### v1.1.0
- 添加事件搜索功能
- 优化日历渲染性能

### v1.0.0
- 初始版本发布，支持基础日历功能
