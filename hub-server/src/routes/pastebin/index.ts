import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDatabase } from '../../db.js';

export const description = 'Pastebin - Text sharing service';
export const router = Router();

const db = getDatabase('pastebin');

db.exec(`
  CREATE TABLE IF NOT EXISTS pastes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    expires_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

// Clean expired pastes periodically
setInterval(() => {
  db.prepare('DELETE FROM pastes WHERE expires_at IS NOT NULL AND expires_at < strftime(\'%s\', \'now\')').run();
}, 60000);

router.post('/create', (req, res) => {
  const { content, expiresIn } = req.body;
  if (!content || typeof content !== 'string') return res.status(400).json({ error: 'Content required' });
  if (content.length > 100000) return res.status(400).json({ error: 'Content too large (max 100KB)' });

  const id = nanoid(8);
  let expires_at: number | null = null;
  const now = Math.floor(Date.now() / 1000);

  switch (expiresIn) {
    case '10m': expires_at = now + 600; break;
    case '1h': expires_at = now + 3600; break;
    case '1d': expires_at = now + 86400; break;
    default: expires_at = null;
  }

  db.prepare('INSERT INTO pastes (id, content, expires_at) VALUES (?, ?, ?)').run(id, content, expires_at);
  res.json({ id, url: `/pastebin?id=${id}` });
});

router.get('/get/:id', (req, res) => {
  const row = db.prepare('SELECT content, expires_at FROM pastes WHERE id = ?').get(req.params.id) as { content: string; expires_at: number } | undefined;
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000)) {
    db.prepare('DELETE FROM pastes WHERE id = ?').run(req.params.id);
    return res.status(404).json({ error: 'Expired' });
  }
  res.json({ content: row.content });
});

router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'pastebin' }));
