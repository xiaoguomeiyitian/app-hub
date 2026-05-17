# ♟ 五子棋 (Gomoku)

经典五子棋单机对战游戏，支持人机对战和双人模式。

## 技术栈
- Vite + TypeScript strict
- HTML5 Canvas 渲染
- AI 引擎：Negamax + Alpha-Beta 剪枝

## 功能
- 15×15 棋盘，Canvas 渲染（含星位标记、渐变棋子）
- 人机对战（搜索深度 3，有攻防意识）
- 双人对战
- 悔棋 / 重来
- 移动端适配（触摸支持）
- 胜利连线高亮

## 启动
```bash
npm install
npm run dev    # 开发模式 (端口 20009)
npm run build  # 生产构建
```

## 访问地址
- 开发：https://97.383636.xyz/code/20009/gomoku/
- 生产：https://97.383636.xyz/code/20008/gomoku/
