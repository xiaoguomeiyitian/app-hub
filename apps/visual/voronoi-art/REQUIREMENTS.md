# 需求文档 - voronoi-art

> 创建日期: 2026-03-25
> 项目目录: /root/projects/apps/voronoi-art

## 功能需求
- 沃罗诺伊艺术展示页
- 支持生成 Voronoi 图案
- 支持基础配色与视觉效果

## 技术约束
| 项目 | 要求 |
|------|------|
| 前端构建 | Vite + TypeScript (strict) |
| 前端端口 | 20009 |
| 生产构建 | `base: './'` |
| 开发访问 | `server.host: '0.0.0.0'` |

## 验收标准
- [ ] 可通过浏览器访问前端页面
- [ ] Voronoi 图案生成正常
- [ ] 配色/视觉效果正常
- [ ] TypeScript 编译无错误
