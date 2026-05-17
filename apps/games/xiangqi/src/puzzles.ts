import type { PieceType, Color } from './types';

export interface Puzzle {
  id: string;
  name: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  turn: 'red' | 'black';
  goal: 'win';
  maxMoves: number;
  pieces: { type: PieceType; color: Color; col: number; row: number }[];
  solution: { from: { col: number; row: number }; to: { col: number; row: number } }[];
  tags: string[];
}

/**
 * 黑方将在 col:5, row:8 附近，士/象/车等在后方开阔区域，避免黑方无棋可走。
 * 红方进攻路线不变，solution 坐标保持。
 */
export const PUZZLES: Puzzle[] = [
  {
    id: 'p01', name: '马后炮杀', difficulty: 1, turn: 'red', goal: 'win', maxMoves: 3,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'horse', color: 'red', col: 3, row: 2 },
      { type: 'cannon', color: 'red', col: 4, row: 3 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'elephant', color: 'black', col: 0, row: 8 },
      { type: 'elephant', color: 'black', col: 2, row: 8 },
      { type: 'rook', color: 'black', col: 7, row: 2 },
    ],
    solution: [{ from: { col: 3, row: 2 }, to: { col: 5, row: 0 } }],
    tags: ['马炮配合', '基础杀法'],
  },
  {
    id: 'p02', name: '双车错杀', difficulty: 1, turn: 'red', goal: 'win', maxMoves: 3,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'rook', color: 'red', col: 0, row: 8 },
      { type: 'rook', color: 'red', col: 8, row: 8 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'rook', color: 'black', col: 7, row: 2 },
    ],
    solution: [{ from: { col: 0, row: 8 }, to: { col: 0, row: 0 } }],
    tags: ['双车', '基础杀法'],
  },
  {
    id: 'p03', name: '车马冷着', difficulty: 2, turn: 'red', goal: 'win', maxMoves: 5,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'rook', color: 'red', col: 8, row: 5 },
      { type: 'horse', color: 'red', col: 3, row: 4 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'elephant', color: 'black', col: 0, row: 8 },
      { type: 'elephant', color: 'black', col: 2, row: 8 },
    ],
    solution: [{ from: { col: 8, row: 5 }, to: { col: 5, row: 5 } }],
    tags: ['车马配合', '冷着'],
  },
  {
    id: 'p04', name: '炮兵巧胜', difficulty: 2, turn: 'red', goal: 'win', maxMoves: 5,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'cannon', color: 'red', col: 0, row: 7 },
      { type: 'pawn', color: 'red', col: 3, row: 6 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'elephant', color: 'black', col: 0, row: 9 },
      { type: 'elephant', color: 'black', col: 2, row: 9 },
    ],
    solution: [{ from: { col: 3, row: 6 }, to: { col: 3, row: 5 } }],
    tags: ['炮兵', '巧胜'],
  },
  {
    id: 'p05', name: '马兵攻士象全', difficulty: 3, turn: 'red', goal: 'win', maxMoves: 7,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'horse', color: 'red', col: 6, row: 5 },
      { type: 'pawn', color: 'red', col: 5, row: 6 },
      { type: 'pawn', color: 'red', col: 3, row: 5 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'elephant', color: 'black', col: 0, row: 8 },
      { type: 'elephant', color: 'black', col: 2, row: 8 },
      { type: 'pawn', color: 'black', col: 8, row: 5 },
    ],
    solution: [{ from: { col: 6, row: 5 }, to: { col: 7, row: 3 } }],
    tags: ['马兵', '攻防'],
  },
  {
    id: 'p06', name: '车炮胜单车', difficulty: 2, turn: 'red', goal: 'win', maxMoves: 7,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'rook', color: 'red', col: 8, row: 5 },
      { type: 'cannon', color: 'red', col: 0, row: 7 },
      { type: 'rook', color: 'black', col: 5, row: 3 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
    ],
    solution: [{ from: { col: 8, row: 5 }, to: { col: 8, row: 0 } }],
    tags: ['车炮', '残局定式'],
  },
  {
    id: 'p07', name: '车马胜单车', difficulty: 3, turn: 'red', goal: 'win', maxMoves: 9,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'rook', color: 'red', col: 8, row: 5 },
      { type: 'horse', color: 'red', col: 2, row: 5 },
      { type: 'rook', color: 'black', col: 7, row: 2 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
    ],
    solution: [{ from: { col: 2, row: 5 }, to: { col: 4, row: 3 } }],
    tags: ['车马', '残局定式'],
  },
  {
    id: 'p08', name: '三兵胜士象全', difficulty: 3, turn: 'red', goal: 'win', maxMoves: 9,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'pawn', color: 'red', col: 3, row: 7 },
      { type: 'pawn', color: 'red', col: 4, row: 6 },
      { type: 'pawn', color: 'red', col: 5, row: 7 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'elephant', color: 'black', col: 0, row: 8 },
      { type: 'elephant', color: 'black', col: 2, row: 8 },
    ],
    solution: [{ from: { col: 4, row: 6 }, to: { col: 4, row: 5 } }],
    tags: ['三兵', '攻防'],
  },
  {
    id: 'p09', name: '车兵胜车士', difficulty: 4, turn: 'red', goal: 'win', maxMoves: 11,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'rook', color: 'red', col: 3, row: 5 },
      { type: 'pawn', color: 'red', col: 4, row: 6 },
      { type: 'rook', color: 'black', col: 7, row: 2 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
    ],
    solution: [{ from: { col: 4, row: 6 }, to: { col: 4, row: 5 } }],
    tags: ['车兵', '复杂残局'],
  },
  {
    id: 'p10', name: '马炮兵胜马炮', difficulty: 4, turn: 'red', goal: 'win', maxMoves: 11,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'horse', color: 'red', col: 6, row: 4 },
      { type: 'cannon', color: 'red', col: 1, row: 7 },
      { type: 'pawn', color: 'red', col: 4, row: 5 },
      { type: 'horse', color: 'black', col: 7, row: 2 },
      { type: 'cannon', color: 'black', col: 1, row: 3 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
    ],
    solution: [{ from: { col: 6, row: 4 }, to: { col: 5, row: 2 } }],
    tags: ['马炮兵', '综合'],
  },
  {
    id: 'p11', name: '闷宫杀', difficulty: 1, turn: 'red', goal: 'win', maxMoves: 1,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 4, row: 0 },
      { type: 'cannon', color: 'red', col: 4, row: 8 },
      { type: 'rook', color: 'black', col: 8, row: 0 },
      { type: 'pawn', color: 'red', col: 3, row: 1 },
      { type: 'pawn', color: 'red', col: 5, row: 1 },
      { type: 'advisor', color: 'black', col: 3, row: 0 },
      { type: 'advisor', color: 'black', col: 5, row: 0 },
      { type: 'horse', color: 'black', col: 8, row: 7 },
    ],
    solution: [{ from: { col: 4, row: 8 }, to: { col: 4, row: 0 } }],
    tags: ['闷宫', '基础杀法'],
  },
  {
    id: 'p12', name: '铁门栓', difficulty: 1, turn: 'red', goal: 'win', maxMoves: 3,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'rook', color: 'red', col: 4, row: 3 },
      { type: 'cannon', color: 'red', col: 4, row: 6 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'rook', color: 'black', col: 7, row: 2 },
    ],
    solution: [{ from: { col: 4, row: 3 }, to: { col: 4, row: 0 } }],
    tags: ['铁门栓', '基础杀法'],
  },
  {
    id: 'p13', name: '卧槽马杀', difficulty: 2, turn: 'red', goal: 'win', maxMoves: 3,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'horse', color: 'red', col: 6, row: 2 },
      { type: 'rook', color: 'red', col: 8, row: 8 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
    ],
    solution: [{ from: { col: 6, row: 2 }, to: { col: 7, row: 0 } }],
    tags: ['卧槽马', '基础杀法'],
  },
  {
    id: 'p14', name: '天地炮', difficulty: 2, turn: 'red', goal: 'win', maxMoves: 5,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'cannon', color: 'red', col: 4, row: 2 },
      { type: 'cannon', color: 'red', col: 4, row: 8 },
      { type: 'rook', color: 'red', col: 0, row: 5 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'elephant', color: 'black', col: 0, row: 8 },
      { type: 'elephant', color: 'black', col: 2, row: 8 },
    ],
    solution: [{ from: { col: 4, row: 8 }, to: { col: 4, row: 1 } }],
    tags: ['天地炮', '炮配合'],
  },
  {
    id: 'p15', name: '双将', difficulty: 2, turn: 'red', goal: 'win', maxMoves: 3,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'horse', color: 'red', col: 5, row: 2 },
      { type: 'cannon', color: 'red', col: 4, row: 6 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'rook', color: 'black', col: 7, row: 2 },
    ],
    solution: [{ from: { col: 5, row: 2 }, to: { col: 3, row: 0 } }],
    tags: ['双将', '配合杀'],
  },
  {
    id: 'p16', name: '车炮抽杀', difficulty: 3, turn: 'red', goal: 'win', maxMoves: 7,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'rook', color: 'red', col: 4, row: 5 },
      { type: 'cannon', color: 'red', col: 0, row: 3 },
      { type: 'rook', color: 'black', col: 7, row: 2 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
    ],
    solution: [{ from: { col: 4, row: 5 }, to: { col: 4, row: 2 } }],
    tags: ['车炮', '抽杀'],
  },
  {
    id: 'p17', name: '大刀剜心', difficulty: 3, turn: 'red', goal: 'win', maxMoves: 5,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'rook', color: 'red', col: 4, row: 4 },
      { type: 'rook', color: 'red', col: 8, row: 8 },
      { type: 'cannon', color: 'red', col: 1, row: 7 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'elephant', color: 'black', col: 0, row: 8 },
      { type: 'elephant', color: 'black', col: 2, row: 8 },
      { type: 'rook', color: 'black', col: 7, row: 2 },
    ],
    solution: [{ from: { col: 4, row: 4 }, to: { col: 4, row: 0 } }],
    tags: ['大刀剜心', '经典杀法'],
  },
  {
    id: 'p18', name: '车马炮联杀', difficulty: 4, turn: 'red', goal: 'win', maxMoves: 9,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'rook', color: 'red', col: 0, row: 6 },
      { type: 'horse', color: 'red', col: 3, row: 3 },
      { type: 'cannon', color: 'red', col: 7, row: 5 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'elephant', color: 'black', col: 0, row: 8 },
      { type: 'elephant', color: 'black', col: 2, row: 8 },
    ],
    solution: [{ from: { col: 3, row: 3 }, to: { col: 4, row: 1 } }],
    tags: ['车马炮', '联攻'],
  },
  {
    id: 'p19', name: '炮碾丹砂', difficulty: 4, turn: 'red', goal: 'win', maxMoves: 7,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'cannon', color: 'red', col: 0, row: 0 },
      { type: 'cannon', color: 'red', col: 8, row: 0 },
      { type: 'rook', color: 'red', col: 4, row: 5 },
      { type: 'horse', color: 'red', col: 2, row: 3 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
    ],
    solution: [{ from: { col: 0, row: 0 }, to: { col: 0, row: 1 } }],
    tags: ['双炮', '碾杀'],
  },
  {
    id: 'p20', name: '绝杀无解', difficulty: 5, turn: 'red', goal: 'win', maxMoves: 1,
    pieces: [
      { type: 'general', color: 'red', col: 4, row: 9 },
      { type: 'general', color: 'black', col: 5, row: 8 },
      { type: 'rook', color: 'red', col: 4, row: 1 },
      { type: 'cannon', color: 'red', col: 8, row: 8 },
      { type: 'advisor', color: 'black', col: 4, row: 7 },
      { type: 'advisor', color: 'black', col: 6, row: 7 },
      { type: 'elephant', color: 'black', col: 0, row: 8 },
      { type: 'elephant', color: 'black', col: 2, row: 8 },
      { type: 'horse', color: 'black', col: 7, row: 2 },
    ],
    solution: [{ from: { col: 4, row: 1 }, to: { col: 4, row: 0 } }],
    tags: ['绝杀', '一步杀'],
  },
];

// ===== 进度存储 =====
const STORAGE_KEY = 'xiangqi:puzzle-progress';

export function getPuzzleProgress(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

export function savePuzzleProgress(id: string, stars: number): void {
  const progress = getPuzzleProgress();
  if ((progress[id] || 0) < stars) {
    progress[id] = stars;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }
}
