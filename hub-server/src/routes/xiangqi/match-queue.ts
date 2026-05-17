import type { WebSocket } from 'ws';
import type { QueueEntry } from './types.js';
import type { TimeTierKey } from './time-tiers.js';

// ===== 匹配队列 =====
const queue: QueueEntry[] = new Array<QueueEntry>();

/** 超时定时器存储（socketId → timeout） */
const matchTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// ===== 常量 =====
const MATCH_TIMEOUT_MS = 10_000;
const ELO_TOLERANCE = 200;
const ELO_TOLERANCE_RELAXED = 500;
const RELAX_THRESHOLD_MS = 10_000;

/** 玩家加入匹配队列 */
export function addToQueue(
  socketId: string,
  ws: WebSocket,
  nickname: string,
  elo: number,
  timeTier: TimeTierKey,
  onMatch: (p1: QueueEntry, p2: QueueEntry) => void,
  onBotMatch: (entry: QueueEntry) => void,
): void {
  // 先移除可能存在的旧条目
  removeFromQueue(socketId);

  const entry: QueueEntry = {
    socketId,
    ws,
    nickname,
    elo,
    timeTier,
    joinedAt: Date.now(),
  };
  queue.push(entry);

  // 设置匹配超时 → 触发机器人匹配
  const timeout = setTimeout(() => {
    const idx = queue.findIndex(e => e.socketId === socketId);
    if (idx !== -1) {
      const entry = queue.splice(idx, 1)[0];
      matchTimeouts.delete(socketId);
      onBotMatch(entry);
    }
  }, MATCH_TIMEOUT_MS);

  matchTimeouts.set(socketId, timeout);

  // 尝试立即匹配
  tryMatch(onMatch);
}

/** 从队列中移除 */
export function removeFromQueue(socketId: string): boolean {
  const idx = queue.findIndex(e => e.socketId === socketId);
  if (idx === -1) return false;

  queue.splice(idx, 1);

  const timeout = matchTimeouts.get(socketId);
  if (timeout) {
    clearTimeout(timeout);
    matchTimeouts.delete(socketId);
  }
  return true;
}

/** 检查是否在队列中 */
export function isInQueue(socketId: string): boolean {
  return queue.some(e => e.socketId === socketId);
}

/** 获取队列长度 */
export function getQueueSize(): number {
  return queue.length;
}

/** 尝试匹配 */
function tryMatch(onMatch: (p1: QueueEntry, p2: QueueEntry) => void): void {
  if (queue.length < 2) return;

  const now = Date.now();

  // 按等待时间降序排列（等待最久的优先）
  queue.sort((a, b) => a.joinedAt - b.joinedAt);

  for (let i = 0; i < queue.length - 1; i++) {
    const p1 = queue[i];
    const waitTime = now - p1.joinedAt;
    const tolerance = waitTime >= RELAX_THRESHOLD_MS ? ELO_TOLERANCE_RELAXED : ELO_TOLERANCE;

    for (let j = i + 1; j < queue.length; j++) {
      const p2 = queue[j];
      const eloDiff = Math.abs(p1.elo - p2.elo);

      if (p1.timeTier !== p2.timeTier) continue;

      if (eloDiff <= tolerance) {
        // 匹配成功！从队列中移除
        queue.splice(j, 1);
        queue.splice(i, 1);

        // 清除超时
        for (const entry of [p1, p2]) {
          const t = matchTimeouts.get(entry.socketId);
          if (t) { clearTimeout(t); matchTimeouts.delete(entry.socketId); }
        }

        // 随机分配红黑
        if (Math.random() < 0.5) {
          onMatch(p1, p2);
        } else {
          onMatch(p2, p1);
        }
        return;
      }
    }
  }
}
