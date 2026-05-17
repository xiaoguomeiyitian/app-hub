# Mock API — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/mock-server/`

## 项目概述

前端开发 Mock 数据服务，纯前端配置+本地存储。

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 路由配置 | 添加路由(方法+路径+状态码) | 配置正确 |
| F02 | 响应模板 | JSON 响应体编辑 | 格式化+高亮 |
| F03 | 延迟模拟 | 设置响应延迟(0-5000ms) | 延迟生效 |
| F04 | 本地存储 | localStorage 保存所有配置 | 刷新不丢失 |
| F05 | 导出/导入 | 导出 JSON 配置文件 | 可导入恢复 |

### P1

| # | 功能 | 描述 |
|---|------|------|
| F06 | 随机数据 | 内置 faker 生成随机姓名/地址/邮箱等 |
| F07 | 请求日志 | 记录每次 mock 请求 |
| F08 | 分组管理 | 路由按项目分组 |

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 注意 | 纯前端配置工具，实际 mock 需配合 Service Worker 或浏览器扩展 |
| 部署 | `cp -r dist/* /root/projects/static/mock-server/` |
| 分类 | `tool-dev` |
| 注册 | `{ icon: '🔌', label_zh: 'Mock API', label_en: 'Mock Server', category: 'tool-dev' }` |
