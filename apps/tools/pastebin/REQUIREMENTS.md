# 粘贴板 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/pastebin/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 文本粘贴 | 粘贴代码/文本 | 保存成功 |
| F02 | 语法高亮 | 自动检测语言+高亮 | 高亮正确 |
| F03 | 过期时间 | 10分钟/1小时/1天/永不过期 | 过期自动删除 |
| F04 | 分享链接 | 生成唯一链接 | 可访问 |
| F05 | 一键复制 | 复制内容/链接 | 复制成功 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | 密码保护 | 设置访问密码 |
| F07 | 行号 | 显示行号 |
| F08 | 历史管理 | 查看/删除自己创建的粘贴 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 后端 | `shared-backend/src/routes/pastebin/` + SQLite 存储 |
| 部署 | `cp -r dist/* /root/projects/static/pastebin/` |
| 分类 | `utility` |
| 注册 | `{ icon: '📋', label_zh: '粘贴板', label_en: 'Pastebin', category: 'utility' }` |
