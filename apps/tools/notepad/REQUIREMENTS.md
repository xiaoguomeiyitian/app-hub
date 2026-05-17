# 云笔记 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/notepad/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | Markdown 编辑 | 编辑+实时预览 | 渲染正确 |
| F02 | 笔记管理 | 创建/删除/重命名 | 操作正确 |
| F03 | 文件夹 | 文件夹分类 | 树形结构 |
| F04 | 搜索 | 全文搜索 | 实时过滤 |
| F05 | localStorage 持久化 | 本地存储 | 刷新不丢失 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | 标签 | 多标签分类 |
| F07 | 导出 | 导出 MD/TXT/HTML |
| F08 | 快捷键 | 常用编辑快捷键 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/notepad/` |
| 分类 | `tool-efficiency` |
| 注册 | `{ icon: '📓', label_zh: '云笔记', label_en: 'Notepad', category: 'tool-efficiency' }` |
