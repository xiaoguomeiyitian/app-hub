# @app-hub/utils — 前端工具库

> app-hub 项目共享前端工具库，提供 IndexedDB 封装、主题管理、图表、导出、图层、音频录制、二维码等模块。

## 安装

```bash
npm install @app-hub/utils
```

## 功能模块

| 模块 | 说明 | 导入路径 |
|------|------|----------|
| `idb` | IndexedDB 封装（基于 `idb` 库） | `@app-hub/utils/idb` |
| `theme` | 主题切换（light/dark） | `@app-hub/utils/theme` |
| `charts` | Chart.js 图表封装 | `@app-hub/utils/charts` |
| `export` | Canvas 导出（PNG/JPG/SVG/PDF） | `@app-hub/utils/export` |
| `layers` | 图层管理（LayerStack） | `@app-hub/utils/layers` |
| `audio-recorder` | 浏览器录音与 WAV 编码 | `@app-hub/utils/audio-recorder` |
| `qr` | 二维码生成 | `@app-hub/utils/qr` |

## 使用示例

### IndexedDB

```typescript
import { createIdbStore } from '@app-hub/utils/idb';

const store = createIdbStore('my-db', 'kv');
await store.set('key', { name: 'value' });
const data = await store.get('key');
```

### 主题

```typescript
import { getPreferredTheme, applyTheme } from '@app-hub/utils/theme';

const theme = getPreferredTheme(); // 'light' | 'dark'
applyTheme(theme);
```

### 图表

```typescript
import { createChart } from '@app-hub/utils/charts';

const chart = createChart(canvas, {
  type: 'bar',
  data: { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] },
});
```

### 导出

```typescript
import { exportCanvas, exportPDF, exportSVG } from '@app-hub/utils/export';

await exportCanvas(canvas, 'png');
await exportPDF(canvas);
await exportSVG(svgElement, 'drawing.svg');
```

### 图层

```typescript
import { LayerStack } from '@app-hub/utils/layers';

const layers = new LayerStack();
const id = layers.add(imageData, 'Background');
layers.setVisibility(id, false);
layers.render(ctx);
```

### 音频录制

```typescript
import { AudioRecorder } from '@app-hub/utils/audio-recorder';

const recorder = new AudioRecorder();
await recorder.start();
const blob = await recorder.stop();
```

### 二维码

```typescript
import { generateQR, generateQRDataURL } from '@app-hub/utils/qr';

const canvas = await generateQR('https://example.com', 256);
const dataUrl = await generateQRDataURL('https://example.com');
```

## 开发

```bash
npm run build   # TypeScript 编译
npm test        # Vitest 测试
```

## 依赖

- `chart.js` ^4.4.8
- `idb` ^7.1.1
- `jspdf` ^4.2.1
- `qrcode` ^1.5.4
- `wav-encoder` ^1.3.0
