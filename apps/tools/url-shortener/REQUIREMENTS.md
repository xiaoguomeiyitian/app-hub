# 短链接 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/url-shortener/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 生成短链 | 输入长 URL → 生成短码 | 短码唯一 |
| F02 | 自定义短码 | 可选自定义短码 | 不冲突 |
| F03 | 重定向 | 访问短码→跳转原 URL | 跳转正确 |
| F04 | 管理列表 | 查看/删除短链接 | 操作正确 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F05 | 点击统计 | 记录访问次数 |
| F06 | 过期时间 | 设置短链接有效期 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 后端 | `shared-backend/src/routes/url-shortener/` + SQLite |
| 部署 | `cp -r dist/* /root/projects/static/url-shortener/` |
| 分类 | `utility` |
| 注册 | `{ icon: '🔗', label_zh: '短链接', label_en: 'URL Shortener', category: 'utility' }` |
