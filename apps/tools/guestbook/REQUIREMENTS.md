# 需求文档 - guestbook

> 创建日期: 2026-03-25
> 项目目录: /root/projects/apps/guestbook

## 功能需求
- 访客留言板，支持文字留言与昵称展示
- 支持 Canvas 手写签名
- 支持 websocket 实时同步留言与签名
- 支持留言列表滚动与基础交互反馈

## 技术约束
| 项目 | 要求 |
|------|------|
| 前端构建 | Vite + TypeScript (strict) |
| 前端端口 | 20009 |
| 生产构建 | `base: './'` |
| 开发访问 | `server.host: '0.0.0.0'` |
| 后端路由 | `/root/projects/shared-backend/src/routes/guestbook/` |

## 验收标准
- [ ] 可通过浏览器访问前端页面
- [ ] 留言与签名可正常提交
- [ ] websocket 实时同步正常
- [ ] TypeScript 编译无错误

