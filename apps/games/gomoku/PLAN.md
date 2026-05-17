# 五子棋（Gomoku）单机对战游戏 — 开发方案

> 📋 **规划者** · 2026-03-24  
> 状态：待审批

---

## 1. 目录结构

```
/root/projects/apps/gomoku/
├── README.md               # 项目说明（启动方式、依赖、端口）
├── REQUIREMENTS.md         # 需求文档（功能需求、技术约束、验收标准）
├── PLAN.md                 # 本文件
├── package.json
├── tsconfig.json            # strict 模式
├── vite.config.ts
├── index.html
├── public/
│   └── sounds/              # 音效文件（可选）
│       ├── place.mp3        # 落子音效
│       ├── win.mp3          # 胜利音效
│       └── lose.mp3         # 失败音效
└── src/
    ├── main.ts              # 入口：初始化游戏
    ├── types/
    │   └── index.ts         # 全局类型定义（Player, Cell, GameState, AIMove 等）
    ├── game/
    │   ├── Board.ts         # 棋盘逻辑（15×15 棋盘状态管理、胜负判定）
    │   ├── Game.ts          # 游戏流程控制器（回合管理、模式切换、悔棋）
    │   └── constants.ts     # 常量（棋盘大小、棋子类型、评分权重）
    ├── ai/
    │   ├── AIEngine.ts      # AI 入口：选点、调用搜索
    │   ├── Evaluator.ts     # 评估函数（棋型识别与评分）
    │   └── Search.ts        # 搜索算法（Negamax + Alpha-Beta 剪枝）
    ├── ui/
    │   ├── Renderer.ts      # Canvas 渲染器（棋盘网格、棋子、动画、高亮最后落子）
    │   ├── InputHandler.ts  # 输入处理（鼠标点击 + 触摸事件 → 坐标转换）
    │   └── UIController.ts  # UI 控件（开始/重来/悔棋按钮、状态提示）
    ├── audio/
    │   └── AudioManager.ts  # 音效管理（可选，容错静默失败）
    └── style.css            # 样式（移动端适配）
```

---

## 2. 功能模块划分

### 模块职责矩阵

| 模块 | 职责 | 对外依赖 |
|------|------|----------|
| **types/index.ts** | Player, Cell, GameState, Position, SearchResult, ScoreType 枚举 | 无 |
| **constants.ts** | BOARD_SIZE=15, DIRECTIONS, SCORE_WEIGHTS, MAX_SEARCH_DEPTH | 无 |
| **Board** | 棋盘二维数组管理、落子、撤子、四方向连珠检测、胜负判定 | constants |
| **Game** | 游戏状态机、回合切换、人机模式流程、悔棋栈 | Board, AIEngine |
| **Evaluator** | 棋型识别（活四/冲四/活三/眠三/活二）、单行评分、全盘评分 | constants |
| **Search** | Negamax + Alpha-Beta 剪枝、候选点生成（邻域启发）、迭代深化可选 | Evaluator, Board |
| **AIEngine** | 对外统一接口 `getBestMove(board): Position`，封装搜索调用 | Search |
| **Renderer** | Canvas 绘制：网格线、坐标标记、黑白棋子（径向渐变）、最后落子标记、胜利连线高亮 | types |
| **InputHandler** | 监听 click/touchstart → 像素坐标 → 棋盘行列 → 触发落子 | Renderer, Game |
| **UIController** | DOM 按钮事件、游戏状态文本更新（"轮到你" / "AI 思考中..." / "胜利!"） | Game |
| **AudioManager** | 预加载音效、播放（AudioContext）、失败静默 | 无 |
| **main.ts** | 创建实例、组装依赖、启动游戏 | 所有模块 |

### 数据流

```
用户点击/触摸
    ↓
InputHandler（坐标转换）
    ↓
Game.placePiece(row, col)
    ↓
Board.setCell() → Renderer.render()
    ↓
Game.checkWin() → 是 → UIController.showResult()
    ↓ 否
Game.switchTurn() → AIEngine.getBestMove()
    ↓
Search.negamax(depth, α, β) → Evaluator.evaluate()
    ↓
返回 bestMove → Board.setCell() → Renderer.render()
    ↓
循环...
```

---

## 3. AI 算法选型

### 3.1 核心算法：Negamax + Alpha-Beta 剪枝

**选择理由**：
- Negamax 是 Min-Max 的对称简化实现，代码更简洁
- Alpha-Beta 剪枝可将搜索空间从 O(b^d) 降低到 O(b^(d/2))
- 15×15 五子棋的分支因子约 225，深度 3-4 层在浏览器中可接受

| 参数 | 值 | 说明 |
|------|------|------|
| 搜索深度 | 3（基础难度） | 即 AI 看 3 步（自己的 2 步 + 对手 1 步），响应时间 < 1s |
| 候选点范围 | 以已有棋子为中心，2 格邻域 | 有效减少分支因子从 225 → ~50 |
| 排序策略 | 按候选点评分预排序，优先搜高分点 | 提升剪枝效率 |

### 3.2 评估函数设计

**棋型识别**：扫描棋盘每个位置的 4 个方向（横/竖/左斜/右斜），识别连续同色棋子模式：

| 棋型 | 分值 | 定义 |
|------|------|------|
| **连五 (Five)** | 100,000,000 | 5 子连续，必胜 |
| **活四 (Live Four)** | 10,000,000 | 4 子连续，两端均空，必胜（下一步就能连五） |
| **冲四 (Dead Four)** | 1,000,000 | 4 子连续，一端被堵或有缺口，需防守 |
| **活三 (Live Three)** | 100,000 | 3 子连续，两端均空，可发展为活四 |
| **眠三 (Dead Three)** | 10,000 | 3 子连续，一端被堵 |
| **活二 (Live Two)** | 1,000 | 2 子连续，两端均空 |
| **眠二 (Dead Two)** | 100 | 2 子连续，一端被堵 |
| **单子 (One)** | 10 | 孤子 |

**全盘评分**：

```
score = Σ(我方棋型得分) - Σ(对方棋型得分) × 1.2
```

> 对方分数乘以 1.2 的防守系数：AI 优先防守对方的威胁，体现"防守优先"策略。

### 3.3 候选点生成优化

```typescript
function getCandidates(board: Board): Position[] {
  const occupied = board.getOccupiedCells();
  const candidateSet = new Set<string>();
  for (const [r, c] of occupied) {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && board.isEmpty(nr, nc)) {
          candidateSet.add(`${nr},${nc}`);
        }
      }
    }
  }
  // 按预评估分数降序排列
  return sortByScore(parsePositions(candidateSet));
}
```

### 3.4 特殊处理

- **第一步**：AI 若先手（理论上玩家先手，但兜底），默认下天元 (7,7)
- **必胜/必防判断**：搜索前快速检查是否存在连五/活四，直接返回，跳过搜索
- **开局库**：可选，暂不实现（基础难度不需要）

---

## 4. 实现阶段计划

### Phase 1：项目初始化与类型定义（Day 1 上午）

**任务**：
1. `npm create vite@latest gomoku -- --template vanilla-ts` 创建项目
2. 配置 `tsconfig.json`（strict: true）
3. 配置 `vite.config.ts`（server.host: '0.0.0.0', server.port: 20009, base: './'）
4. 定义 `src/types/index.ts`：Player, Cell, Position, GameState, Move 枚举/接口
5. 定义 `src/game/constants.ts`：BOARD_SIZE, DIRECTIONS, SCORE_WEIGHTS
6. Git init + 首次提交

**验收**：项目可 `npm run dev` 启动，无类型错误

### Phase 2：棋盘逻辑与渲染（Day 1 下午）

**任务**：
1. 实现 `Board.ts`：
   - 15×15 二维数组管理
   - `setCell(row, col, player)` / `getCell(row, col)`
   - `checkWin(row, col, player)`：四方向扫描 5 连珠
   - `undo()` 撤销
2. 实现 `Renderer.ts`：
   - Canvas 自适应尺寸（取 min(containerWidth, containerHeight)）
   - 绘制网格线（含星位标记）
   - 绘制棋子（径向渐变，黑白分明）
   - 最后落子红色圆点标记
   - 胜利时高亮连珠线
3. 实现 `InputHandler.ts`：
   - click 事件 → 像素转棋盘坐标（四舍五入到最近交叉点）
   - touchstart 事件 → 同上（移动端支持）
   - 点击有效性检查（空位、游戏进行中）

**验收**：可手动双人对弈，落子有渲染，五连珠判定正确

### Phase 3：AI 引擎（Day 2 上午）

**任务**：
1. 实现 `Evaluator.ts`：
   - `evaluateLine(board, start, direction, player)`：单行评分
   - `evaluateBoard(board, player)`：全盘评分（含防守系数）
   - 棋型识别：用滑动窗口扫描每个方向
2. 实现 `Search.ts`：
   - `negamax(board, depth, α, β, maximizingPlayer)` 核心函数
   - `getCandidates(board)` 候选点生成 + 排序
   - 必胜/必防快速判断
3. 实现 `AIEngine.ts`：
   - `getBestMove(board): Position` 对外接口
   - AI 思考时显示 loading 状态

**验收**：AI 可正常落子，有基本攻防意识，响应 < 2 秒

### Phase 4：游戏流程控制（Day 2 下午）

**任务**：
1. 实现 `Game.ts`：
   - 状态机：WAITING → PLAYING → WIN/LOSE/DRAW
   - 回合管理：玩家落子 → 检查胜负 → AI 落子 → 检查胜负
   - 悔棋功能：撤销最后两步（玩家 + AI）
   - 重新开始：重置棋盘
2. 实现 `UIController.ts`：
   - 按钮：开始/重新开始/悔棋
   - 状态文本："轮到你落子" / "AI 思考中..." / "你赢了！" / "AI 赢了！"
   - 胜利/失败弹窗

**验收**：完整对弈流程可跑通，悔棋/重来正常

### Phase 5：音效与移动端适配（Day 3 上午）

**任务**：
1. 实现 `AudioManager.ts`：
   - AudioContext 创建与复用
   - 预加载音效文件
   - 容错：加载失败静默，不影响游戏
2. 移动端适配 `style.css`：
   - `viewport` meta 标签
   - Canvas 尺寸自适应（max-width: 100vw, aspect-ratio: 1）
   - 按钮尺寸适配触摸（min 44px × 44px）
   - 棋子点击热区增大
3. 细节打磨：
   - 落子动画（棋子缩放渐现）
   - AI 思考时禁用点击
   - 平局检测（棋盘满）

**验收**：手机浏览器可正常游玩，音效正常播放

### Phase 6：构建部署与文档（Day 3 下午）

**任务**：
1. `npm run build` 构建
2. `cp -r dist/* /root/projects/static/gomoku/`
3. 重启静态服务器
4. 验证部署：`curl` + 浏览器访问 `https://97.383636.xyz/code/20008/gomoku/`
5. 编写 `README.md`：启动方式、技术栈、截图
6. 编写 `REQUIREMENTS.md`：功能需求清单、技术约束、验收标准
7. 更新 `PLAN.md`：标记所有阶段完成
8. Git commit + tag `v1.0-core`

**验收**：线上可访问，所有功能正常

---

## 5. 风险评估

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| **AI 响应慢**（深度 3 仍超 2s） | 中 | 用户体验差 | ① 限制候选点为 2 格邻域（~50 点）② 候选点预排序提升剪枝效率 ③ 必胜/必防快判跳过搜索 ④ 可降深度至 2 |
| **移动端触摸精度差** | 中 | 落子错位 | ① 像素坐标四舍五入到最近交叉点 ② 增大触摸热区 ③ 添加确认提示（可选） |
| **Canvas 高 DPI 模糊** | 低 | 棋盘渲染模糊 | 使用 `devicePixelRatio` 缩放 Canvas 内部分辨率 |
| **音效加载失败** | 低 | 无音效但功能正常 | AudioManager 容错静默失败（R16 规则） |
| **评估函数棋型识别不准** | 中 | AI 棋力弱 | ① 充分测试各棋型边界（跳棋、隔子等）② 可参考开源实现验证 |
| **浏览器兼容性** | 低 | 部分浏览器不支持 | ① 使用标准 Canvas API ② AudioContext 回退 |
| **TypeScript strict 报错** | 低 | 开发阻塞 | 先定义好类型再写实现，使用 `as const` 和 `satisfies` |

---

## 6. 技术选型总结

| 项 | 选择 | 理由 |
|------|------|------|
| 构建工具 | Vite | AGENTS.md R17 规范，HMR 热更新 |
| 语言 | TypeScript strict | AGENTS.md R13 规范 |
| 渲染 | Canvas 2D API | 轻量、性能好、无额外依赖 |
| AI 算法 | Negamax + Alpha-Beta | 经典博弈搜索，JS 中实现简单高效 |
| 评估函数 | 棋型模式匹配 + 加权评分 | 五子棋标准方案，效果好于纯位置评分 |
| 音效 | Web Audio API | 低延迟、可复用 |
| 样式 | 纯 CSS | 无框架依赖，移动端媒体查询适配 |
| 端口 | 开发 20009 / 生产 20008 | AGENTS.md R17a/R17b 规范 |

---

## 7. 文件清单与交付物

| 文件 | 说明 |
|------|------|
| `/root/projects/apps/gomoku/README.md` | 项目说明 |
| `/root/projects/apps/gomoku/REQUIREMENTS.md` | 需求文档 |
| `/root/projects/apps/gomoku/PLAN.md` | 执行方案（本文件） |
| `/root/projects/apps/gomoku/src/` | 全部源码 |
| `/root/projects/static/gomoku/` | 生产构建部署 |

---

_📋 规划者 · 方案完成，等待协调者审批_
