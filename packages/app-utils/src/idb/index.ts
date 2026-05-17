import { openDB, type IDBPDatabase } from 'idb';

export interface KvStore {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  entries(): AsyncIterable<[string, any]>;
}

export class IdbKvStore implements KvStore {
  private db: IDBPDatabase | null = null;
  constructor(private dbName: string, private storeName = 'kv') {}

  private async ensureDb(): Promise<IDBPDatabase> {
    if (!this.db) {
      const storeName = this.storeName;
      this.db = await openDB(this.dbName, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        },
      });
    }
    return this.db;
  }

  async get(key: string): Promise<any> {
    const db = await this.ensureDb();
    return db.get(this.storeName, key);
  }

  async set(key: string, value: any): Promise<void> {
    const db = await this.ensureDb();
    await db.put(this.storeName, value, key);
  }

  async remove(key: string): Promise<void> {
    const db = await this.ensureDb();
    await db.delete(this.storeName, key);
  }

  async clear(): Promise<void> {
    const db = await this.ensureDb();
    await db.clear(this.storeName);
  }

  async *entries(): AsyncIterable<[string, any]> {
    const db = await this.ensureDb();
    const tx = db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    let cursor = await store.openCursor();
    while (cursor) {
      yield [cursor.key as string, cursor.value];
      cursor = await cursor.continue();
    }
  }
}

export function createIdbStore(dbName: string, storeName?: string): KvStore {
  return new IdbKvStore(dbName, storeName);
}