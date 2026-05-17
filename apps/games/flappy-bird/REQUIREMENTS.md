# 需求文档 - flappy-bird

> 项目目录: /root/projects/apps/flappy-bird

## 功能需求
- 提供 Flappy Bird 反应类小游戏
- 点击或空格控制小鸟跳跃
- 随机生成管道并计分
- 碰撞后显示游戏结束，可重开

## 技术约束
| 项目 | 要求 |
|------|------|
| 前端构建 | Vite + TypeScript (strict) |
| 生产构建 | `base: './'` |
| 开发访问 | `server.host: '0.0.0.0'` |

## 验收标准
- [ ] 页面可正常打开
- [ ] 点击 / 空格可跳跃
- [ ] 管道持续生成且可计分
- [ ] 碰撞后进入结束态并可重开
- [ ] TypeScript 与构建通过
