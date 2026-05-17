export enum LogLevel { DEBUG, INFO, WARN, ERROR }

const currentLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;

/** 安全序列化，处理循环引用和特殊对象 */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, val) => {
      // 处理循环引用
      if (val instanceof Error) {
        return { name: val.name, message: val.message, stack: val.stack };
      }
      if (val instanceof Map) {
        return Object.fromEntries(val);
      }
      if (val instanceof Set) {
        return [...val];
      }
      return val;
    });
  } catch {
    return '[unserializable]';
  }
}

export function log(level: LogLevel, message: string, meta?: unknown): void {
  if (level < currentLevel) return;
  const prefix = LogLevel[level];
  const metaStr = meta !== undefined ? safeStringify(meta) : '';
  console.log(`[${prefix}] ${message}${metaStr ? ' ' + metaStr : ''}`);
}
