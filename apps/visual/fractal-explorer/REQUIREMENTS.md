# 需求文档 - fractal-explorer

> 创建日期: 2026-03-25
> 项目目录: /root/projects/apps/fractal-explorer

## 功能需求
- 分形浏览器页面
- 支持 Mandelbrot / Julia 分形图渲染
- 支持滚轮无限缩放
- 支持随缩放变化的色彩方案

## 技术约束
| 项目 | 要求 |
|------|------|
| 前端构建 | Vite + TypeScript (strict) |
| 前端端口 | 20009 |
| 生产构建 | `base: './'` |
| 开发访问 | `server.host: '0.0.0.0'` |

## 验收标准
- [ ] 可通过浏览器访问前端页面
- [ ] 分形渲染正常
- [ ] 缩放与配色正常
- [ ] TypeScript 编译无错误
