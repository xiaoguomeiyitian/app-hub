import { describe, it, expect } from 'vitest';
import { createIdbStore, IdbKvStore } from '../src/idb';

describe('IDB Utils', () => {
  it('exposes KvStore factory with required methods', () => {
    const store = createIdbStore('test-db', 'kv');
    expect(store).toBeInstanceOf(IdbKvStore);
    expect(typeof (store as IdbKvStore).get).toBe('function');
    expect(typeof (store as IdbKvStore).set).toBe('function');
    expect(typeof (store as IdbKvStore).remove).toBe('function');
    expect(typeof (store as IdbKvStore).clear).toBe('function');
    expect(typeof (store as IdbKvStore).entries).toBe('function');
  });
});