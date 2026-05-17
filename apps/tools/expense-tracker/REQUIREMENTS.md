# 记账本 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/expense-tracker/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 记账 | 收入/支出记录，金额+分类+日期+备注 | 记录正确 |
| F02 | 分类 | 预设分类(餐饮/交通/购物等)+自定义 | 分类管理 |
| F03 | 月度统计 | 本月收支汇总+分类占比 | 统计正确 |
| F04 | 图表 | 饼图(分类占比)+折线图(趋势) | 图表正确 |
| F05 | localStorage | 本地持久化 | 刷新不丢失 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | 预算 | 设置月度预算，超支提醒 |
| F07 | 导出 CSV | 导出记账数据 |
| F08 | 多账户 | 现金/银行卡/支付宝等 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/expense-tracker/` |
| 分类 | `tool-efficiency` |
| 注册 | `{ icon: '💰', label_zh: '记账本', label_en: 'Expense Tracker', category: 'tool-efficiency' }` |
