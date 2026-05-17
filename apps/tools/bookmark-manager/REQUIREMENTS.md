# 书签管理 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/bookmark-manager/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 书签增删改 | URL+标题+描述+图标 | 操作正确 |
| F02 | 文件夹 | 文件夹分类，树形结构 | 层级正确 |
| F03 | 标签 | 多标签管理 | 过滤正确 |
| F04 | 搜索 | 按标题/URL/标签搜索 | 实时过滤 |
| F05 | 导入导出 | 导入/导出 HTML 书签格式 | 兼容浏览器 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | 网站图标 | 自动获取 favicon |
| F07 | 拖拽排序 | 文件夹/书签拖拽 |
| F08 | 收藏置顶 | 常用书签置顶 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/bookmark-manager/` |
| 分类 | `utility` |
| 注册 | `{ icon: '🔖', label_zh: '书签管理', label_en: 'Bookmarks', category: 'utility' }` |
