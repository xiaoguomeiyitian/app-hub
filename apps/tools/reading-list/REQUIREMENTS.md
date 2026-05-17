# 阅读清单 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/reading-list/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 书签收藏 | 添加 URL/标题/描述 | 增删改 |
| F02 | 标签分类 | 多标签管理 | 过滤正确 |
| F03 | 阅读状态 | 未读/在读/已读 | 状态切换 |
| F04 | 搜索 | 按标题/标签搜索 | 实时过滤 |
| F05 | localStorage | 持久化 | 刷新不丢失 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | 导入导出 | JSON/HTML 格式 |
| F07 | 收藏/置顶 | 标记重要条目 |
| F08 | 阅读笔记 | 为每条记录添加笔记 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/reading-list/` |
| 分类 | `tool-efficiency` |
| 注册 | `{ icon: '📚', label_zh: '阅读清单', label_en: 'Reading List', category: 'tool-efficiency' }` |
