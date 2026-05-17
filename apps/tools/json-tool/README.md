# json-tool

PROJ_DESC。

## 功能
- 当前项目以现有代码实现为准，提供对应的核心交互或游戏玩法。
- 界面与交互已集成在前端主入口中。

## 运行
cd /root/projects/apps/json-tool && npm install && npm run dev

## 构建
cd /root/projects/apps/json-tool && npm run build

## 说明
- 前端采用 Vite + TypeScript。
- 生产构建使用相对路径 base: './'。
- 若项目包含联机能力，请以代码中的 WebSocket 路径与共享后端路由为准。

## 功能列表
- JSON格式化与压缩
- JSON语法校验
- JSON转CSV/XML/YAML
- JSON对比

## 应用截图
（截图位置，部署后补充实际截图）

## 使用文档
[完整使用指南](docs/usage.md)

## 版本历史
### v1.3.0
- 完善使用文档docs/usage.md
- 添加格式转换说明
- 优化校验提示

### v1.2.0
- 支持JSON转YAML
- 修复大文件处理卡顿

### v1.1.0
- 添加JSON对比功能
- 优化格式化效果

### v1.0.0
- 初始版本发布，支持基础JSON处理
