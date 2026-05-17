import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDatabase } from '../../db.js';

export const description = 'URL Shortener - Create short links';
export const router = Router();

const db = getDatabase('url-shortener');

db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    short_code TEXT UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

router.post('/create', (req, res) => {
  const { url, customCode } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL required' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  const shortCode = customCode || nanoid(6);
  if (!/^[a-zA-Z0-9_-]+$/.test(shortCode)) return res.status(400).json({ error: 'Invalid custom code' });

  const existing = db.prepare('SELECT id FROM links WHERE short_code = ?').get(shortCode);
  if (existing) return res.status(409).json({ error: 'Code already exists' });

  const id = nanoid(12);
  db.prepare('INSERT INTO links (id, short_code, original_url) VALUES (?, ?, ?)').run(id, shortCode, url);
  res.json({ id, shortCode, url: `/api/url-shortener/r/${shortCode}` });
});

router.get('/r/:code', (req, res) => {
  const row = db.prepare('SELECT original_url FROM links WHERE short_code = ?').get(req.params.code) as { original_url: string };
  if (!row) return res.status(404).send('Not found');
  db.prepare('UPDATE links SET clicks = clicks + 1 WHERE short_code = ?').run(req.params.code);
  res.redirect(302, row.original_url);
});

router.get('/list', (_req, res) => {
  const rows = db.prepare('SELECT id, short_code as shortCode, original_url as originalUrl, clicks, created_at as createdAt FROM links ORDER BY created_at DESC LIMIT 50').all();
  res.json(rows);
});

router.delete('/delete/:id', (req, res) => {
  db.prepare('DELETE FROM links WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'url-shortener' }));
