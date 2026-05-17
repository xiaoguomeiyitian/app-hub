# 需求文档 - typing-speed

> 创建日期: 2026-03-25
> 项目目录: /root/projects/apps/typing-speed

## 功能需求
- 打字测速页面
- 实时 WPM 统计
- 错误高亮提示
- 支持排行榜记录（localStorage）

## 技术约束
| 项目 | 要求 |
|------|------|
| 前端构建 | Vite + TypeScript (strict) |
| 前端端口 | 20009 |
| 生产构建 | `base: './'` |
| 开发访问 | `server.host: '0.0.0.0'` |

## 验收标准
- [ ] 可通过浏览器访问前端页面
- [ ] WPM 统计正常
- [ ] 错误高亮正常
- [ ] TypeScript 编译无错误

