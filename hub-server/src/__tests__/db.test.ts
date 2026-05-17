import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../db.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rmSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const TEST_DB_NAME = 'test-db-unit';

function cleanup() {
  const dbPath = join(DATA_DIR, `${TEST_DB_NAME}.db`);
  const walPath = join(DATA_DIR, `${TEST_DB_NAME}.db-wal`);
  const shmPath = join(DATA_DIR, `${TEST_DB_NAME}.db-shm`);
  [dbPath, walPath, shmPath].forEach((p) => {
    if (existsSync(p)) rmSync(p, { force: true });
  });
}

test('db: getDatabase enables WAL and foreign_keys', async () => {
  cleanup();
  const db = getDatabase(TEST_DB_NAME);
  const mode = String(db.pragma('journal_mode', { simple: true })).toLowerCase();
  assert.equal(mode, 'wal', 'journal_mode should be WAL');
  const fk = String(db.pragma('foreign_keys', { simple: true })).toLowerCase();
  // SQLite may return '0'/'1' or 'off'/'on'
  assert.ok(fk === '1' || fk === 'on', `foreign_keys should be ON (got ${fk})`);
  db.close();
  cleanup();
});
