# 需求文档 - space-shooter

> 项目目录: /root/projects/apps/space-shooter

## 功能需求
- 提供太空射击小游戏
- 支持左右移动与 Space 射击
- 敌机持续出现并可被击毁
- 敌机下落到边界后结束游戏，可重开

## 技术约束
| 项目 | 要求 |
|------|------|
| 前端构建 | Vite + TypeScript (strict) |
| 生产构建 | `base: './'` |
| 开发访问 | `server.host: '0.0.0.0'` |

## 验收标准
- [ ] 页面可正常打开
- [ ] 飞船可左右移动
- [ ] 子弹可发射并击中敌机
- [ ] 计分与结束态正常
- [ ] TypeScript 与构建通过
