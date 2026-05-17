# 购物清单 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/shopping-list/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 清单管理 | 创建/删除清单 | 操作正确 |
| F02 | 商品 | 添加商品(名称+数量+分类) | 增删改 |
| F03 | 勾选划掉 | 点击勾选，已购商品划掉 | 交互正确 |
| F04 | 分类 | 食品/日用品/其他 | 自动分组展示 |
| F05 | localStorage | 持久化 | 刷新不丢失 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | 价格 | 记录单价+总价计算 |
| F07 | 历史复用 | 复制历史清单 |
| F08 | 排序 | 按名称/分类/添加时间排序 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/shopping-list/` |
| 分类 | `tool-efficiency` |
| 注册 | `{ icon: '🛒', label_zh: '购物清单', label_en: 'Shopping List', category: 'tool-efficiency' }` |
