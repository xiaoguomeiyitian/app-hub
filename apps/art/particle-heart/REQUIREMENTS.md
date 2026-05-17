# 粒子爱心应用需求文档

## 功能需求
- 展示13种不同风格的粒子爱心动画效果
- 左侧列表选择样式，右侧Canvas预览
- 点击切换动画效果
- 深色主题UI
- 响应式布局

## 技术约束
- Vite + TypeScript
- Canvas 2D（无需 WebGL）
- 端口 20009
- 纯前端项目，无后端

## 验收标准
- 13种样式均可正常显示和动画
- 心形方程正确（x=16sin³t, y=13cost-5cos2t-2cos3t-cos4t）
- 每种样式粒子数量≥200
- 动画流畅（requestAnimationFrame）
- UI美观，深色主题
- 响应式布局
