# password generator

密码生成器。

## 功能
- 当前项目以现有代码实现为准，提供对应的核心交互或游戏玩法。
- 界面与交互已集成在前端主入口中。

## 运行

```bash
cd /root/projects/apps/password-generator && npm install && npm run dev
```

## 构建

```bash
cd /root/projects/apps/password-generator && npm run build
```

## 说明
- 前端采用 Vite + TypeScript。
- 生产构建使用相对路径 `base: './'`。
- 若项目包含联机能力，请以代码中的 WebSocket 路径与共享后端路由为准。

## 功能列表
- 随机密码生成（自定义长度、字符类型）
- 密码强度检测
- 批量生成密码
- 排除易混淆字符

## 应用截图
（截图位置，部署后补充实际截图）

## 使用文档
[完整使用指南](docs/usage.md)

## 版本历史
### v1.3.0
- 完善使用文档docs/usage.md
- 添加批量生成说明
- 优化强度检测逻辑

### v1.2.0
- 支持排除易混淆字符
- 修复密码生成重复问题

### v1.1.0
- 添加密码强度检测
- 优化界面布局

### v1.0.0
- 初始版本发布，支持基础密码生成
