# 习惯打卡 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/habit-tracker/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 习惯管理 | 创建/编辑/删除习惯 | 操作正确 |
| F02 | 每日打卡 | 点击打卡当日完成 | 状态正确 |
| F03 | 连续天数 | 计算连续打卡天数 | 计算正确 |
| F04 | 热力图 | GitHub 风格年度热力图 | 渲染正确 |
| F05 | 周/月视图 | 切换查看 | 视图正确 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | 提醒时间 | 设置每日提醒时间 |
| F07 | 习惯分类 | 运动/学习/健康等分类 |
| F08 | 统计 | 完成率/最佳连续/总计天数 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/habit-tracker/` |
| 分类 | `tool-efficiency` |
| 注册 | `{ icon: '✅', label_zh: '习惯打卡', label_en: 'Habit Tracker', category: 'tool-efficiency' }` |
