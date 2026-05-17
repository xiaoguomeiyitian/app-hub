# calculator

基础计算器。

## 功能
- 当前项目以现有代码实现为准，提供对应的核心交互或游戏玩法。
- 界面与交互已集成在前端主入口中。

## 运行

```bash
cd /root/projects/apps/calculator && npm install && npm run dev
```

## 构建

```bash
cd /root/projects/apps/calculator && npm run build
```

## 说明
- 前端采用 Vite + TypeScript。
- 生产构建使用相对路径 `base: './'`。
- 若项目包含联机能力，请以代码中的 WebSocket 路径与共享后端路由为准。

## 功能列表
- 四则运算（加、减、乘、除）
- 括号优先级支持
- 键盘快捷键操作
- 历史计算记录
- 一键清除/重置

## 应用截图
（截图位置，部署后补充实际截图）

## 使用文档
[完整使用指南](docs/usage.md)

## 版本历史
### v1.3.0
- 完善使用文档docs/usage.md
- 添加键盘快捷键说明
- 优化界面交互逻辑

### v1.2.0
- 支持括号运算
- 修复连续运算错误bug

### v1.1.0
- 添加键盘输入支持
- 优化按钮布局与响应式适配

### v1.0.0
- 初始版本发布，支持基础四则运算
