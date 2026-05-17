# notepad

轻量记事本。

## 功能
- 当前项目以现有代码实现为准，提供对应的核心交互或游戏玩法。
- 界面与交互已集成在前端主入口中。

## 运行

```bash
cd /root/projects/apps/notepad && npm install && npm run dev
```

## 构建

```bash
cd /root/projects/apps/notepad && npm run build
```

## 说明
- 前端采用 Vite + TypeScript。
- 生产构建使用相对路径 `base: './'`。
- 若项目包含联机能力，请以代码中的 WebSocket 路径与共享后端路由为准。

## 功能列表
- Markdown编辑与实时预览
- 自动保存到本地存储
- 多笔记管理与搜索
- 笔记导出（TXT/MD格式）

## 应用截图
（截图位置，部署后补充实际截图）

## 使用文档
[完整使用指南](docs/usage.md)

## 版本历史
### v1.3.0
- 完善使用文档docs/usage.md
- 添加Markdown预览功能说明
- 优化笔记管理逻辑

### v1.2.0
- 支持笔记搜索功能
- 修复自动保存延迟问题

### v1.1.0
- 添加笔记导出功能
- 优化编辑界面布局

### v1.0.0
- 初始版本发布，支持基础文本编辑
