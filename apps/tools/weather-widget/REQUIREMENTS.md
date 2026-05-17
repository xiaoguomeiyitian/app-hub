# 天气组件 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/weather-widget/`

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 城市搜索 | 搜索城市 | 实时建议 |
| F02 | 当前天气 | 温度/湿度/风速/天气状况 | 数据准确 |
| F03 | 3 日预报 | 未来 3 天天气 | 显示正确 |
| F04 | 天气图标 | 不同天气不同图标/动画 | 图标匹配 |
| F05 | 多城市 | 收藏多个城市 | 切换查看 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | 定位 | 自动获取当前位置天气 |
| F07 | 小时预报 | 24 小时预报 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| API | 使用 wttr.in 或 Open-Meteo（免费无需 key） |
| 部署 | `cp -r dist/* /root/projects/static/weather-widget/` |
| 分类 | `utility` |
| 注册 | `{ icon: '🌤️', label_zh: '天气', label_en: 'Weather', category: 'utility' }` |
