# 代码截图 — 实施计划

> 📅 创建日期: 2026-04-02
> 📁 项目目录: `/root/projects/apps/code-shot/`

## 阶段一：骨架 + 核心

| # | 任务 | 说明 |
|---|------|------|
| T01 | Vite 初始化 | `base: './'`，strict |
| T02 | 语法高亮引擎 | 基于正则的轻量高亮（不引入大型库），支持 JS/TS/Python/HTML/CSS/JSON/Go/Rust/Java/C++ |
| T03 | 主题系统 | 5+ 暗色主题（Dracula/Monokai/Nord/Gruvbox/GitHub Dark） |
| T04 | 编辑器 | textarea + 行号 + 高亮 overlay |

## 阶段二：截图功能

| # | 任务 | 说明 |
|---|------|------|
| T05 | 预览容器 | 渲染美化后的代码块 |
| T06 | macOS 窗口样式 | 三色圆点 + 标题栏 |
| T07 | PNG 导出 | html2canvas 或 Canvas API |
| T08 | 透明背景选项 | 支持导出透明 PNG |

## 阶段三：增强

| # | 任务 | 说明 |
|---|------|------|
| T09 | 字体/字号选择 | 等宽字体列表 + 滑块 |
| T10 | 内边距调整 | 滑块控制预览留白 |
| T11 | 行号开关 | 可切换 |
| T12 | 水印 | 可选文字水印 |

## 阶段四：适配部署

| # | 任务 | 说明 |
|---|------|------|
| T13 | 响应式 | 8 分辨率通过，小屏上下堆叠 |
| T14 | 构建部署 | → `/root/projects/static/code-shot/` |
| T15 | git | init + commit + tag v1.0 |
