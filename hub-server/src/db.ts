import { log, LogLevel } from './logger.js';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// 数据库连接缓存，避免重复创建连接
const dbCache = new Map<string, Database.Database>();

/**
 * 获取项目的 SQLite 数据库实例（WAL 模式）
 * 数据文件：app-hub/data/<projectName>.db
 * 使用连接缓存避免重复创建
 */
export function getDatabase(projectName: string): Database.Database {
  // 缓存命中直接返回
  if (dbCache.has(projectName)) {
    return dbCache.get(projectName)!;
  }

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const dbPath = join(DATA_DIR, `${projectName}.db`);
  const db = new Database(dbPath);
  // WAL 模式：读写不互锁，写操作不阻塞读
  db.pragma('journal_mode = WAL');
  // 启用外键约束（级联删除等生效）
  db.pragma('foreign_keys = ON');
  // 其他优化
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000'); // 写冲突时等 5 秒而非立即报错

  const mode = String(db.pragma('journal_mode', { simple: true })).toLowerCase();
  if (mode !== 'wal') {
    console.warn(`⚠️ [${projectName}] WAL 模式未生效，当前: ${mode}`);
  } else {
    log(LogLevel.INFO, `✅ [${projectName}] SQLite journal_mode=${mode}`);
  }

  // 缓存连接
  dbCache.set(projectName, db);
  return db;
}

/**
 * 关闭所有数据库连接（优雅退出时调用）
 */
export function closeAllDatabases(): void {
  for (const [name, db] of dbCache) {
    try {
      db.close();
      log(LogLevel.INFO, `✅ [${name}] 数据库连接已关闭`);
    } catch (e) {
      log(LogLevel.ERROR, `❌ [${name}] 关闭数据库连接失败:`, e);
    }
  }
  dbCache.clear();
}
