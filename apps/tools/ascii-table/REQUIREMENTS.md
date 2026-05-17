# ASCII 参考表 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/ascii-table/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | ASCII 表 | 0-127 完整字符表 | 显示正确 |
| F02 | Unicode 扩展 | 常用 Unicode 字符 | 分类展示 |
| F03 | 搜索 | 按字符/描述/编码搜索 | 实时过滤 |
| F04 | 分类过滤 | 控制字符/数字/字母/符号 | 过滤正确 |
| F05 | 编码对照 | DEC/HEX/OCT/BIN/HTML 实体 | 全部显示 |
| F06 | 一键复制 | 点击复制字符或编码 | 复制成功 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F07 | 字符信息 | Unicode 名称/区块/类别 |
| F08 | 常用符号收藏 | 收藏常用特殊字符 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/ascii-table/` |
| 分类 | `tool-dev` |
| 注册 | `{ icon: '📊', label_zh: 'ASCII参考', label_en: 'ASCII Table', category: 'tool-dev' }` |
