# 密码生成器 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/password-generator/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 密码生成 | 按规则生成密码 | 随机性好 |
| F02 | 规则配置 | 长度/大写/小写/数字/特殊字符 | 配置生效 |
| F03 | 强度检测 | 实时检测密码强度 | 评分+颜色 |
| F04 | 一键复制 | 复制到剪贴板 | 复制成功 |
| F05 | 批量生成 | 一次生成多个 | 列表展示 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | 密码短语 | 生成易记的密码短语 |
| F07 | 排除相似 | 排除 0/O/l/1 等相似字符 |
| F08 | 密码强度表 | 常见密码模式说明 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/password-generator/` |
| 分类 | `tool-efficiency` |
| 注册 | `{ icon: '🔐', label_zh: '密码生成', label_en: 'Password Generator', category: 'tool-efficiency' }` |
