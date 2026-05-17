# @app-hub/utils 需求说明

## 定位

app-hub 项目共享前端工具库，为各子项目提供通用的前端工具能力。

## 模块需求

### idb — IndexedDB 封装
- 提供 KV 存储接口
- 支持 get/set/remove/clear/entries
- 基于 `idb` 库实现
- 连接缓存避免重复创建

### theme — 主题管理
- 支持 light/dark 两种主题
- 自动检测系统偏好
- localStorage 持久化

### charts — 图表封装
- 基于 Chart.js
- 支持 line/bar/pie 类型
- 统一配置入口

### export — 导出功能
- Canvas 导出为 PNG/JPG
- SVG 导出
- PDF 导出（基于 jsPDF）

### layers — 图层管理
- 图层增删改查
- 可见性/锁定控制
- 图层渲染

### audio-recorder — 音频录制
- 基于 MediaRecorder API
- WAV 格式编码
- 支持采样率配置

### qr — 二维码生成
- 基于 qrcode 库
- 支持 Canvas 和 DataURL 输出
- 可配置尺寸和边距

## 技术约束

- TypeScript strict mode
- ESM 模块
- 浏览器环境
- 零运行时依赖（除声明的依赖外）
