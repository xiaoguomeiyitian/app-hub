# @app-hub/design-system 需求说明

## 定位

app-hub 项目共享设计系统，为所有子项目提供统一的设计令牌（Design Tokens）。

## 核心需求

### CSS 变量
- 颜色系统（主色、功能色、灰度）
- 字体系统（字体族、字号、字重、行高）
- 间距系统（4px 基准的 8 级间距）
- 断点系统（响应式断点）

### TypeScript 令牌
- 色彩对象导出
- 类型安全

## 技术约束

- CSS 自定义属性（`:root` 作用域）
- TypeScript ESM
- Vite 构建
- 零运行时依赖
