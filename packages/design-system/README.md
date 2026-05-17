# @app-hub/design-system — 设计系统

> app-hub 项目共享设计系统，提供 CSS 变量和 TypeScript 色彩令牌。

## 安装

```bash
npm install @app-hub/design-system
```

## 使用

### CSS 变量

```css
@import '@app-hub/design-system/src/style.css';

.my-component {
  color: var(--color-primary);
  font-family: var(--font-sans);
  padding: var(--space-4);
}
```

### TypeScript 令牌

```typescript
import { colors } from '@app-hub/design-system';

const primary = colors.primary; // '#3b82f6'
```

## 设计令牌

### 颜色

| 变量 | 值 | 说明 |
|------|-----|------|
| `--color-primary` | `#3b82f6` | 主色 |
| `--color-primary-dark` | `#2563eb` | 主色深色 |
| `--color-success` | `#10b981` | 成功 |
| `--color-warning` | `#f59e0b` | 警告 |
| `--color-error` | `#ef4444` | 错误 |
| `--color-neutral-*` | 灰度色板 | 50-900 |

### 字体

| 变量 | 值 |
|------|-----|
| `--font-sans` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| `--font-mono` | `'Fira Code', 'Courier New', monospace` |
| `--text-xs` ~ `--text-3xl` | `12px` ~ `30px` |

### 间距

| 变量 | 值 |
|------|-----|
| `--space-1` ~ `--space-16` | `4px` ~ `64px` |

### 断点

| 变量 | 值 |
|------|-----|
| `--breakpoint-xs` | `320px` |
| `--breakpoint-sm` | `640px` |
| `--breakpoint-md` | `768px` |
| `--breakpoint-lg` | `1024px` |
| `--breakpoint-xl` | `1280px` |

## 开发

```bash
npm run build   # tsc + vite build
npm run dev     # vite dev server
```
