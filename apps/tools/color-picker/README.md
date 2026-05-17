# color picker

取色器工具。

## 功能
- 当前项目以现有代码实现为准，提供对应的核心交互或游戏玩法。
- 界面与交互已集成在前端主入口中。

## 运行

```bash
cd /root/projects/apps/color-picker && npm install && npm run dev
```

## 构建

```bash
cd /root/projects/apps/color-picker && npm run build
```

## 说明
- 前端采用 Vite + TypeScript。
- 生产构建使用相对路径 `base: './'`。
- 若项目包含联机能力，请以代码中的 WebSocket 路径与共享后端路由为准。

## 功能列表
- 颜色拾取（屏幕取色/输入色值）
- 颜色格式转换（HEX/RGB/HSL/CMYK）
- 配色方案生成
- 历史颜色记录

## 应用截图
（截图位置，部署后补充实际截图）

## 使用文档
[完整使用指南](docs/usage.md)

## 版本历史
### v1.3.0
- 完善使用文档docs/usage.md
- 添加配色方案说明
- 优化拾色器体验

### v1.2.0
- 支持CMYK格式转换
- 修复颜色转换偏差

### v1.1.0
- 添加历史颜色记录
- 优化格式转换速度

### v1.0.0
- 初始版本发布，支持基础颜色拾取
