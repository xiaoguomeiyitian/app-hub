# BMI 计算 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/bmi-calculator/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | BMI 计算 | 输入身高(cm)体重(kg)→BMI | 计算正确 |
| F02 | 健康范围 | 显示偏瘦/正常/超重/肥胖 | 参考准确 |
| F03 | 可视化 | BMI 仪表盘/进度条 | 直观 |
| F04 | 公制/英制 | 切换 cm/kg 和 ft/lb | 转换正确 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F05 | 历史趋势 | 记录多次 BMI，趋势图 |
| F06 | 健康建议 | 根据 BMI 给出建议 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/bmi-calculator/` |
| 分类 | `utility` |
| 注册 | `{ icon: '⚖️', label_zh: 'BMI计算', label_en: 'BMI Calculator', category: 'utility' }` |
