import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room, GameMessage } from '../../types/game.js';
import { JoinData, VoteData } from '../../types/messages.js';

interface SpyfallPlayer extends Player {
  role?: string;
  alive?: boolean;
  voted?: string | null;
  side?: number;
}

interface SpyfallRoom extends Room {
  cur?: number;
  currentLocation?: Location;
  votes?: Map<string, string>;
  day?: number;
  timer?: number;
  round: number;
}

export const description = '谁是卧底 - 经典社交推理';
export const router = Router();

interface Location {
  place: string;
  words: string[];
}

const LOCS: Location[] = [
  { place: '飞机', words: ['机长', '空姐', '头等舱', '安全带', '行李架'] },
  { place: '医院', words: ['医生', '护士', '手术', '病房', '处方'] },
  { place: '学校', words: ['老师', '学生', '黑板', '课本', '考试'] },
  { place: '餐厅', words: ['菜单', '服务员', '厨师', '点菜', '买单'] },
];

const clients = new Map<string, WebSocket>();
const rooms = new Map<string, Room>();
const matchQueue: Player[] = [];

function send(ws: WebSocket, t: string, d?: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: t, data: d }));
  }
}

function broadcast(room: Room, t: string, d?: unknown): void {
  for (const p of room.players) {
    if (!p.isBot && p.ws?.readyState === WebSocket.OPEN) {
      send(p.ws, t, d);
    }
  }
}

function handleMessage(msg: GameMessage, sid: string, ws: WebSocket): void {
  if (msg.type === 'match:join' || msg.type === 'room:create') {
    const player: Player = {
      id: sid,
      ws,
      nick: ((msg.data as JoinData)?.nick) || '匿名',
      isBot: false,
      score: 0,
    };
    matchQueue.push(player);
    send(ws, 'match:queued', { position: matchQueue.length });
    setTimeout(() => {
      const idx = matchQueue.findIndex((q) => q.id === sid);
      if (idx < 0) return;
      while (matchQueue.length < 6) {
        matchQueue.push({
          id: 'bot-' + nanoid(4),
          ws: null,
          isBot: true,
          nick: 'AI' + (matchQueue.length + 1),
          score: 0,
        });
      }
      const m = matchQueue.splice(0, 6);
      const loc = LOCS[Math.floor(Math.random() * LOCS.length)];
      const spyIdx = Math.floor(Math.random() * m.length);
      m.forEach((p, i) => {
        (p as SpyfallPlayer).word = i === spyIdx ? '卧底' : loc.words[Math.floor(Math.random() * loc.words.length)];
        (p as SpyfallPlayer).alive = true;
        (p as SpyfallPlayer).voted = null;
      });
      const id = nanoid(8);
      const room: Room = {
        id,
        players: m.map((x) => ({ ...x })),
        board: null,
        phase: 'desc',
        cur: 0,
        round: 1,
        location: loc.place,
        spy: spyIdx,
      };
      rooms.set(id, room);
      m.filter((x) => !x.isBot).forEach((x) => {
        if (x.ws) send(x.ws, 'match:found', { roomId: id, position: m.indexOf(x) });
      });
      broadcast(room, 'game:start', {
        word: m[0].word,
        total: m.length,
        location: loc.place,
      });
      broadcast(room, 'game:turn', { position: 0, nick: m[0].nick });
    }, 10000);
  }

  if (msg.type === 'game:desc') {
    for (const [, room] of rooms) {
      const p = room.players.find((pl) => pl.id === sid);
      if (p) {
        broadcast(room, 'game:desc', { id: sid, nick: (p as SpyfallPlayer).nick, text: (msg.data as { text?: string })?.text });
        let cur = (room as SpyfallRoom).cur ?? 0;
        cur++;
        (room as SpyfallRoom).cur = cur;
        if (cur >= room.players.length) {
          (room as SpyfallRoom).phase = 'vote';
          broadcast(room, 'game:phase', { phase: 'vote' });
        } else {
          broadcast(room, 'game:turn', {
            position: (room as SpyfallRoom).cur!,
            nick: room.players[(room as SpyfallRoom).cur!].nick,
          });
        }
        break;
      }
    }
  }

  if (msg.type === 'game:vote') {
    for (const [, room] of rooms) {
      const p = room.players.find((pl) => pl.id === sid);
      if (p) {
        const voteData = msg.data as VoteData;
        (p as SpyfallPlayer).voted = voteData!.target;
        const allVoted = room.players.every((pl) => (pl as SpyfallPlayer).voted !== null);
        if (allVoted) {
          const counts = new Map<string, number>();
          room.players.forEach((pl) => {
            const target = (pl as SpyfallPlayer).voted;
            if (target) counts.set(target, (counts.get(target) || 0) + 1);
          });
          let max = 0, elim = '';
          for (const [tid, c] of counts) {
            if (c > max) { max = c; elim = tid; }
          }
          const ep = room.players.find((pl) => pl.id === elim);
          if (ep) (ep as SpyfallPlayer).alive = false;
          room.players.forEach((pl) => { (pl as SpyfallPlayer).voted = null; });
          broadcast(room, 'game:eliminated', {
            id: elim,
            nick: (ep as SpyfallPlayer).nick,
            isSpy: room.players.indexOf(ep!) === (room as SpyfallRoom).spy,
          });
          const alive = room.players.filter((pl) => (pl as SpyfallPlayer).alive);
          if (alive.length <= 1) {
            (room as SpyfallRoom).phase = 'finished';
            broadcast(room, 'game:over', {
              winner: alive.length ? room.players.indexOf(alive[0]) : null,
              scores: room.players.map((pl) => ({
                nick: (pl as SpyfallPlayer).nick,
                word: (pl as SpyfallPlayer).word,
              })),
            });
          } else {
            const spyfallRoom = room as SpyfallRoom;
            spyfallRoom.cur = 0;
            spyfallRoom.round++;
            spyfallRoom.phase = 'desc';
            broadcast(room, 'game:turn', {
              position: 0,
              nick: room.players[0].nick,
            });
          }
        }
        break;
      }
    }
  }

  if (msg.type === 'game:state') {
    for (const [, room] of rooms) {
      const p = room.players.find((pl) => pl.id === sid);
      if (p) {
        broadcast(room, 'game:state', { id: sid, state: msg.data as { state?: unknown } });
        break;
      }
    }
  }
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'spyfall' }));

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
        handleMessage(msg, sid, ws);
      } catch (err) {
        console.error('[spyfall] 消息处理错误:', err);
      }
    });
    ws.on('close', () => {
      clients.delete(sid);
      const i = matchQueue.findIndex((q) => q.id === sid);
      if (i >= 0) matchQueue.splice(i, 1);
    });
    ws.on('error', () => clients.delete(sid));
  });
  log(LogLevel.INFO, `🔌 WebSocket 已注册: ${tp}`);
}
