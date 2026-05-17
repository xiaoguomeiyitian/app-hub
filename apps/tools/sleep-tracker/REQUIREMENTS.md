# 睡眠记录 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/sleep-tracker/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 记录睡眠 | 入睡时间+起床时间 | 记录正确 |
| F02 | 睡眠时长 | 自动计算 | 精确到分钟 |
| F03 | 质量评分 | 1-5 星评分 | 可选 |
| F04 | 趋势图 | 周/月睡眠时长折线图 | 图表正确 |
| F05 | localStorage | 持久化 | 刷新不丢失 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | 统计 | 平均睡眠/最佳/最差 |
| F07 | 提醒 | 就寝提醒 |
| F08 | 备注 | 记录睡眠相关备注 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/sleep-tracker/` |
| 分类 | `utility` |
| 注册 | `{ icon: '😴', label_zh: '睡眠记录', label_en: 'Sleep Tracker', category: 'utility' }` |
