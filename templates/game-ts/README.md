# 游戏项目模板（TypeScript + Vite）

## 使用方式

1. 复制本模板到 `apps/<分类>/<项目名>/` 目录
2. 修改 `package.json` 中的 `name`
3. 修改 `index.html` 中的 `<title>`
4. 在 `src/` 中编写游戏逻辑
5. 运行 `npm install && npm run build` 构建

## 目录结构

```
项目目录/
├── index.html          # 页面入口
├── package.json        # 项目配置
├── tsconfig.json       # TypeScript 配置
├── vite.config.ts      # Vite 构建配置
├── vitest.config.ts    # Vitest 测试配置
└── src/
    ├── main.ts         # 应用主入口
    ├── style.css       # 全局样式
    └── __tests__/      # 测试文件
        └── main.test.ts
```

## 技术栈

- Vite 8 + TypeScript 5.9
- Vitest 4 + jsdom
- V8 代码覆盖率（阈值：lines 70%, statements 70%）
