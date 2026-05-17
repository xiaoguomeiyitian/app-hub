import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { getDatabase } from '../../db.js';
import { createGuestbookMessage, ensureGuestbookSchema, listGuestbookMessages, type GuestbookMessageInput } from './service.js';

export const description = '留言板 - 访客签名和留言，Canvas 手写签名，WebSocket 实时同步';

const db = getDatabase('guestbook');
ensureGuestbookSchema(db);

export const router = Router();

router.get('/messages', (_req, res) => {
  res.json(listGuestbookMessages(db));
});

router.post('/messages', (req, res) => {
  const input = req.body as Partial<GuestbookMessageInput>;
  if (!input.name || !input.message) {
    return res.status(400).json({ error: 'Name and message required' });
  }

  const row = createGuestbookMessage(db, {
    name: input.name,
    message: input.message,
    signature: input.signature,
  });

  if (!row) {
    return res.status(400).json({ error: 'Name and message required' });
  }

  res.json(row);
});

// WebSocket setup (native)
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';

let wss: WebSocketServer | null = null;

export function socketSetup(httpServer: HttpServer, wsPath: string) {
  void httpServer;
  const targetPath = wsPath.replace(/\/$/, '') + '/websocket';
  wss = new WebSocketServer({ noServer: true });

  // 手动处理 upgrade（避免 ws 库的 request handler 冲突）
  httpServer.on('upgrade', (req, socket, head) => {
    const url = (req.url || '').split('?')[0];
    if (url !== targetPath) return;
    wss!.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      wss!.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    log(LogLevel.INFO, '[guestbook] client connected');

    ws.send(JSON.stringify({ type: 'messages', data: listGuestbookMessages(db) }));

    ws.on('message', (raw: RawData) => {
      try {
        const text = raw.toString();
        const msg = JSON.parse(text);
        if (msg.type === 'new-message') {
          const data = msg.data as { name?: string; message?: string; signature?: string | null } | undefined;
          if (!data || !data.name || !data.message) return;
          const row = createGuestbookMessage(db, { name: data.name, message: data.message, signature: data.signature ?? null });
          if (!row) return;
          broadcast({ type: 'new-message', data: row });
        }
      } catch (e) {
        log(LogLevel.ERROR,'[guestbook] message error:', e);
      }
    });

    ws.on('close', () => {
      log(LogLevel.INFO, '[guestbook] client disconnected');
    });

    ws.on('error', (error: Error) => {
      log(LogLevel.ERROR,'[guestbook] client error:', error);
    });
  });
}

function broadcast(payload: { type: string; data: unknown }) {
  if (!wss) return;
  const text = JSON.stringify(payload);
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) client.send(text);
  });
}
