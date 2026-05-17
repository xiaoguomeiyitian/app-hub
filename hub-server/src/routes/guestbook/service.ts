import Database from 'better-sqlite3';

export interface GuestbookMessageRow {
  id: number;
  name: string;
  message: string;
  signature: string | null;
  created_at: string;
}

export interface GuestbookMessageInput {
  name: string;
  message: string;
  signature?: string | null;
}

const LIST_LIMIT = 100;
const NAME_MAX_LENGTH = 50;
const MESSAGE_MAX_LENGTH = 500;

export function ensureGuestbookSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      signature TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

export function listGuestbookMessages(db: Database.Database): GuestbookMessageRow[] {
  return db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT ?').all(LIST_LIMIT) as GuestbookMessageRow[];
}

export function createGuestbookMessage(
  db: Database.Database,
  input: GuestbookMessageInput,
): GuestbookMessageRow | null {
  const name = input.name.trim().slice(0, NAME_MAX_LENGTH);
  const message = input.message.trim().slice(0, MESSAGE_MAX_LENGTH);
  const signature = input.signature ?? null;

  if (!name || !message) return null;

  const stmt = db.prepare('INSERT INTO messages (name, message, signature) VALUES (?, ?, ?)');
  const result = stmt.run(name, message, signature);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid) as GuestbookMessageRow | undefined ?? null;
}
