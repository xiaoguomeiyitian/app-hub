# 单位换算 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/unit-converter/`

## 项目概述

全品类单位换算工具，输入即换算。

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 长度 | mm/cm/m/km/inch/ft/yard/mile | 换算正确 |
| F02 | 重量 | mg/g/kg/oz/lb | 换算正确 |
| F03 | 温度 | °C/°F/K | 换算正确 |
| F04 | 面积 | m²/km²/acre/hectare/ft² | 换算正确 |
| F05 | 体积 | ml/L/gal/fl oz | 换算正确 |
| F06 | 速度 | m/s/km/h/mph/knot | 换算正确 |
| F07 | 数据量 | B/KB/MB/GB/TB/PB | 换算正确 |
| F08 | 实时换算 | 输入数字即时更新所有单位 | 无延迟 |

### P1

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F09 | 汇率 | 常用货币换算（离线/手动更新） | 可用 |
| F10 | 常用快捷 | 收藏常用换算 | localStorage |

## 设备适配

- [ ] 375~1920 全部无溢出
- [ ] 分类选择在小屏可用
- [ ] 输入框触控友好

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 部署 | `cp -r dist/* /root/projects/static/unit-converter/` |
| 分类 | `tool-dev` |
| 注册 | `{ icon: '📐', label_zh: '单位换算', label_en: 'Unit Converter', category: 'tool-dev' }` |
