# @app-hub/utils 计划

## 当前状态

- ✅ 7 个模块全部实现
- ✅ 统一导出入口 `src/index.ts`
- ✅ package.json exports 配置完成
- ✅ Vitest 测试配置完成

## 模块清单

| 模块 | 状态 | 说明 |
|------|------|------|
| `idb` | ✅ | IndexedDB KV 存储封装 |
| `theme` | ✅ | 主题切换（light/dark） |
| `charts` | ✅ | Chart.js 图表封装 |
| `export` | ✅ | Canvas 导出（PNG/JPG/SVG/PDF） |
| `layers` | ✅ | 图层管理（LayerStack） |
| `audio-recorder` | ✅ | 浏览器录音与 WAV 编码 |
| `qr` | ✅ | 二维码生成 |

## 已清理

- ❌ `provideTheme` 函数 — 未被任何代码使用，已删除

## 后续计划

### P0 — 稳定性
- 完善各模块错误处理
- 补充单元测试

### P1 — 功能增强
- `idb`：支持索引查询
- `charts`：支持更多图表类型
- `export`：支持批量导出

### P2 — 优化
- 减小打包体积
- Tree-shaking 优化
