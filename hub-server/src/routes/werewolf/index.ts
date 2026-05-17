import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';

export const description = '狼人杀 - 经典社交推理';
export const router = Router();

const clients = new Map<string, WebSocket>();
const rooms = new Map<string, any>();
const matchQ: any[] = [];

const ROLES = ['werewolf', 'werewolf', 'seer', 'witch', 'guard', 'villager', 'villager', 'villager'];

function send(ws: WebSocket, t: string, d?: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: t, data: d }));
}

function bc(r: any, t: string, d?: unknown) {
  for (const p of r.players) {
    if (!p.isBot && p.ws?.readyState === WebSocket.OPEN) send(p.ws, t, d);
  }
}

function assignRoles(players: any[]) {
  const shuffled = ROLES.slice(0, players.length).sort(() => Math.random() - 0.5);
  players.forEach((p, i) => { p.role = shuffled[i]; p.alive = true; p.voted = null; });
}

function handleMsg(msg: any, sid: string, ws: WebSocket) {
  if (msg.type === 'match:join') {
    matchQ.push({ id: sid, ws, nick: msg.data?.nick || '匿名' });
    send(ws, 'match:queued', { position: matchQ.length });
    setTimeout(() => {
      const idx = matchQ.findIndex(q => q.id === sid);
      if (idx < 0) return;
      while (matchQ.length < 6) matchQ.push({ id: 'bot-' + nanoid(4), ws: null, isBot: true, nick: 'AI' + (matchQ.length + 1) });
      const m = matchQ.splice(0, 8);
      const id = nanoid(8);
      assignRoles(m);
      const r = { id, players: m, phase: 'night', day: 1, votes: new Map() };
      rooms.set(id, r);
      m.filter((x: any) => !x.isBot).forEach((x: any) => send(x.ws, 'game:start', {
        role: x.role,
        players: m.map((p: any) => ({ id: p.id, nick: p.nick, alive: p.alive })),
      }));
      bc(r, 'game:phase', { phase: 'night', day: 1 });
    }, 10000);
  }
  if (msg.type === 'game:vote') {
    for (const [, r] of rooms) {
      const p = r.players.find((p: any) => p.id === sid);
      if (p && p.alive) {
        r.votes.set(sid, msg.data?.target);
        const aliveCount = r.players.filter((pl: any) => pl.alive && !pl.isBot).length;
        if (r.votes.size >= aliveCount) {
          const counts = new Map<string, number>();
          for (const [, target] of r.votes) counts.set(target, (counts.get(target) || 0) + 1);
          let maxVotes = 0;
          let eliminated = '';
          for (const [target, count] of counts) {
            if (count > maxVotes) { maxVotes = count; eliminated = target; }
          }
          r.votes.clear();
          const ep = r.players.find((p: any) => p.id === eliminated);
          if (ep) ep.alive = false;
          bc(r, 'game:eliminated', { id: eliminated, nick: ep?.nick, role: ep?.role });
          const wolves = r.players.filter((p: any) => p.role === 'werewolf' && p.alive).length;
          const villagers = r.players.filter((p: any) => p.role !== 'werewolf' && p.alive).length;
          if (wolves === 0) bc(r, 'game:over', { winner: 'villagers' });
          else if (wolves >= villagers) bc(r, 'game:over', { winner: 'werewolves' });
          else { r.day++; bc(r, 'game:phase', { phase: 'night', day: r.day }); }
        }
        break;
      }
    }
  }
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'werewolf' }));

export function socketSetup(httpServer: HttpServer, wsPath: string): void {
  const tp = wsPath.replace(/\/$/, '') + '/websocket';
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, s, head) => {
    const u = (req.url || '').split('?')[0];
    if (u !== tp) return;
    wss.handleUpgrade(req, s, head, (ws) => wss.emit('connection', ws, req));
  });
  wss.on('connection', (ws: WebSocket) => {
    const sid = nanoid(12);
    clients.set(sid, ws);
    send(ws, 'connected', { socketId: sid });
    ws.on('message', (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') return send(ws, 'pong');
        handleMsg(msg, sid, ws);
      } catch (e) { console.warn('[werewolf] msg error:', e); }
    });
    ws.on('close', () => clients.delete(sid));
    ws.on('error', () => clients.delete(sid));
  });
  console.log(`🔌 WebSocket 已注册: ${tp}`);
}
