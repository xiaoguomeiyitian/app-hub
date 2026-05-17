# UUID 生成器 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/uuid-generator/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | UUID v4 | 随机 UUID | 生成正确 |
| F02 | UUID v1 | 时间戳 UUID | 生成正确 |
| F03 | 批量生成 | 一次生成 1-100 个 | 批量正确 |
| F04 | 一键复制 | 单个/批量复制 | 复制成功 |
| F05 | 大小写 | 大写/小写切换 | 切换正确 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | ULID | 生成 ULID |
| F07 | NanoID | 生成 NanoID |
| F08 | 自定义格式 | 自定义模板如 `XXXX-XXXX` |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/uuid-generator/` |
| 分类 | `tool-dev` |
| 注册 | `{ icon: '🆔', label_zh: 'UUID生成器', label_en: 'UUID Generator', category: 'tool-dev' }` |
