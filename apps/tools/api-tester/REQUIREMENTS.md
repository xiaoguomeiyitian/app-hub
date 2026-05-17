# API 测试器 — 需求文档

> 📅 创建日期: 2026-04-01
> 📁 项目目录: `/root/projects/apps/api-tester/`

## 项目概述

轻量版 Postman，纯前端 API 请求测试工具。

## 功能需求

### P0

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F01 | 请求构建 | URL + 方法(GET/POST/PUT/DELETE/PATCH) | 设置正确 |
| F02 | Headers 编辑 | 键值对添加/删除 | 格式正确 |
| F03 | Body 编辑 | JSON/form-data/raw | 支持多类型 |
| F04 | 发送请求 | fetch API 发送 | 正确发送 |
| F05 | 响应展示 | 状态码/Headers/Body，JSON 格式化 | 展示清晰 |
| F06 | 响应时间 | 显示请求耗时 | 精确到 ms |

### P1

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| F07 | 历史记录 | 自动保存请求历史 | 可回溯 |
| F08 | 收藏夹 | 保存常用请求 | 增删改 |
| F09 | 环境变量 | 定义变量如 `{{base_url}}` | 替换正确 |
| F10 | cURL 导入 | 粘贴 cURL 命令导入 | 解析正确 |

## 设备适配

- [ ] 375~1920 全部无溢出
- [ ] 移动端纵向布局
- [ ] JSON 响应可滚动

## 技术约束

| 项目 | 要求 |
|------|------|
| 前端 | Vite + TypeScript strict + `base: './'` |
| 注意 | 跨域限制，需提示用户 CORS 问题或支持代理 |
| 部署 | `cp -r dist/* /root/projects/static/api-tester/` |
| 分类 | `tool-dev` |
| 注册 | `{ icon: '📡', label_zh: 'API测试器', label_en: 'API Tester', category: 'tool-dev' }` |
