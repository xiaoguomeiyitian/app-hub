/** Phase 22: 成长系统 — XP/等级/皮肤/每日任务 */

const XP_PER_LEVEL_BASE = 50;
const SKINS = [
  { level: 0, name: '经典绿', color: '#00d4aa' },
  { level: 5, name: '火焰红', color: '#ff6b6b' },
  { level: 10, name: '冰霜蓝', color: '#74b9ff' },
  { level: 15, name: '暗紫', color: '#a29bfe' },
  { level: 20, name: '黄金', color: '#ffd93d' },
  { level: 25, name: '粉樱', color: '#fd79a8' },
  { level: 30, name: '翠绿', color: '#55efc4' },
  { level: 40, name: '霓虹', color: '#00ff88' },
];

const DAILY_TASKS = [
  { id: 'eat50', desc: '吃 50 个食物', target: 50, xp: 30 },
  { id: 'score100', desc: '得分达到 100', target: 100, xp: 50 },
  { id: 'play3', desc: '完成 3 局游戏', target: 3, xp: 20 },
  { id: 'survive60', desc: '存活超过 60 秒', target: 60, xp: 40 },
  { id: 'useSkill5', desc: '使用 5 次技能', target: 5, xp: 25 },
];

interface PlayerProgress {
  xp: number;
  level: number;
  equippedSkin: string;
  completedTasks: string[]; // date-taskId
  taskProgress: Record<string, number>; // taskId -> current
}

function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem('snake_progress');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { xp: 0, level: 0, equippedSkin: '#00d4aa', completedTasks: [], taskProgress: {} };
}

function saveProgress(p: PlayerProgress): void {
  localStorage.setItem('snake_progress', JSON.stringify(p));
}

export function getXpForLevel(level: number): number {
  return Math.floor(XP_PER_LEVEL_BASE * Math.sqrt(level + 1));
}

export function addXp(score: number, duration: number, isWin: boolean): PlayerProgress {
  const p = loadProgress();
  const gained = Math.floor(score * 0.5 + duration / 10 + (isWin ? 50 : 0));
  p.xp += gained;
  p.level = Math.floor(Math.sqrt(p.xp / XP_PER_LEVEL_BASE));
  saveProgress(p);
  return p;
}

export function getProgress(): PlayerProgress {
  return loadProgress();
}

export function getAvailableSkins(): typeof SKINS {
  const p = loadProgress();
  return SKINS.filter(s => p.level >= s.level);
}

export function equipSkin(color: string): void {
  const p = loadProgress();
  p.equippedSkin = color;
  saveProgress(p);
}

export function getEquippedSkin(): string {
  return loadProgress().equippedSkin;
}

/** 每日任务 */
export function getTodayTasks(): { task: typeof DAILY_TASKS[0]; progress: number; completed: boolean }[] {
  const p = loadProgress();
  const today = new Date().toISOString().slice(0, 10);
  return DAILY_TASKS.map(task => {
    const key = `${today}-${task.id}`;
    const progress = p.taskProgress[task.id] || 0;
    return { task, progress, completed: p.completedTasks.includes(key) };
  });
}

export function updateTaskProgress(taskId: string, value: number): void {
  const p = loadProgress();
  p.taskProgress[taskId] = (p.taskProgress[taskId] || 0) + value;
  const today = new Date().toISOString().slice(0, 10);
  const taskDef = DAILY_TASKS.find(t => t.id === taskId);
  if (taskDef && p.taskProgress[taskId] >= taskDef.target) {
    const key = `${today}-${taskId}`;
    if (!p.completedTasks.includes(key)) {
      p.completedTasks.push(key);
      p.xp += taskDef.xp;
      p.level = Math.floor(Math.sqrt(p.xp / XP_PER_LEVEL_BASE));
    }
  }
  saveProgress(p);
}
