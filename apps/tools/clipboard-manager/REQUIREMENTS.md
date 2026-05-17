# 剪贴板历史 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/clipboard-manager/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 手动粘贴 | 粘贴文本到工具 | 保存成功 |
| F02 | 历史记录 | 自动保存粘贴内容 | 按时间排列 |
| F03 | 搜索 | 搜索历史内容 | 实时过滤 |
| F04 | 置顶 | 常用内容置顶 | 置顶正确 |
| F05 | 一键复制 | 点击复制 | 复制成功 |
| F06 | localStorage | 持久化 | 刷新不丢失 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F07 | 分类 | 文本/链接/代码分类 |
| F08 | 清空 | 清空历史 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/clipboard-manager/` |
| 分类 | `utility` |
| 注册 | `{ icon: '📎', label_zh: '剪贴板', label_en: 'Clipboard', category: 'utility' }` |
