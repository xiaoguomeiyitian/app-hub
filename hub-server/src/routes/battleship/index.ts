import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room, GameMessage } from '../../types/game.js';
import { JoinData, PlaceData, FireData } from '../../types/messages.js';

interface BattleshipPlayer extends Player {
  ships: Array<ShipPlacement>;
  hits: Set<string>;
  shots: Set<string>;
  placed: boolean;
  side: number;
}

interface BattleshipRoom extends Room {
  gridSize?: number;
  currentPlayer?: number;
}

export const description = '海战棋 - 双人战舰对战';
export const router = Router();

const clients = new Map<string, WebSocket>();
const rooms = new Map<string, Room>();
const matchQueue: Player[] = [];
const socketToRoom = new Map<string, string>();

interface ShipPlacement {
  name: string;
  size: number;
  x: number;
  y: number;
  horizontal: boolean;
}

const SHIPS: ShipPlacement[] = [
  { name: '航母', size: 5, x: 0, y: 0, horizontal: true },
  { name: '战列舰', size: 4, x: 0, y: 0, horizontal: true },
  { name: '巡洋舰', size: 3, x: 0, y: 0, horizontal: true },
  { name: '潜艇', size: 3, x: 0, y: 0, horizontal: true },
  { name: '驱逐舰', size: 2, x: 0, y: 0, horizontal: true },
];

function send(ws: WebSocket, type: string, data?: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

function broadcast(room: Room, type: string, data?: unknown): void {
  for (const p of room.players) {
    if (!p.isBot && p.ws?.readyState === WebSocket.OPEN) {
      send(p.ws, type, data);
    }
  }
}

function validatePlacement(ships: ShipPlacement[], gridSize: number): boolean {
  const occupied = new Set<string>();
  for (const ship of ships) {
    for (let i = 0; i < ship.size; i++) {
      const x = ship.horizontal ? ship.x + i : ship.x;
      const y = ship.horizontal ? ship.y : ship.y + i;
      const key = `${x},${y}`;
      if (x < 0 || x >= gridSize || y < 0 || y >= gridSize || occupied.has(key)) {
        return false;
      }
      occupied.add(key);
    }
  }
  return true;
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
      if (matchQueue.length < 2) {
        matchQueue.push({
          id: 'bot-' + nanoid(4),
          ws: null,
          isBot: true,
          nick: 'AI',
          score: 0,
        });
      }
      const m = matchQueue.splice(0, 2);
      const roomId = nanoid(8);
      const room: Room = {
        id: roomId,
        players: m.map((x, i) => ({
          ...x,
          ships: [],
          hits: new Set<string>(),
          shots: new Set<string>(),
          placed: false,
          side: i,
        })),
        board: null,
        phase: 'placing',
        timeLeft: 120,
        seed: nanoid(8),
      };
      rooms.set(roomId, room);
      m.filter((x) => !x.isBot).forEach((x) => {
        if (x.ws) {
          send(x.ws, 'match:found', {
            roomId,
            position: m.indexOf(x),
            ships: SHIPS,
            gridSize: 10,
            seed: room.seed,
          });
          socketToRoom.set(x.id, roomId);
        }
      });
      // Bot auto-place
      const botIdx = room.players.findIndex((p) => p.isBot);
      if (botIdx >= 0) {
        (room.players[botIdx] as BattleshipPlayer).placed = true;
      }
    }, 8000);
  }

  if (msg.type === 'game:place') {
    for (const [, room] of rooms) {
      const pos = room.players.findIndex((p) => p.id === sid);
      if (pos >= 0 && room.phase === 'placing') {
        const ships = (msg.data as PlaceData)?.ships as ShipPlacement[];
        const gridSize = (room as BattleshipRoom).gridSize || 10;
        if (!validatePlacement(ships, gridSize)) {
          return send(ws, 'error', { message: '布局无效' });
        }
        (room.players[pos] as BattleshipPlayer).ships = ships;
        (room.players[pos] as BattleshipPlayer).placed = true;
        send(ws, 'game:placed', { ships });
        if (room.players.every((p) => (p as BattleshipPlayer).placed)) {
          room.phase = 'playing';
          (room as BattleshipRoom).currentPlayer = 0;
          broadcast(room, 'game:start', { currentPlayer: 0 });
        }
        break;
      }
    }
  }

  if (msg.type === 'game:fire') {
    for (const [, room] of rooms) {
      const pos = room.players.findIndex((p) => p.id === sid);
      if (pos >= 0 && pos === (room as BattleshipRoom).currentPlayer && room.phase === 'playing') {
        const player = room.players[pos]! as BattleshipPlayer;
        const { x, y } = msg.data as FireData;
        const target = 1 - pos;
        const targetPlayer = room.players[target]! as BattleshipPlayer;
        const key = `${x},${y}`;
        if (player.shots!.has(key)) {
          return send(ws, 'error', { message: '已射击过' });
        }
        player.shots!.add(key);
        // Check hit
        let hit = false;
        let sunk = null;
        const targetShips = targetPlayer.ships as ShipPlacement[];
        for (const ship of targetShips) {
          for (let i = 0; i < ship.size; i++) {
            const sx = ship.horizontal ? ship.x + i : ship.x;
            const sy = ship.horizontal ? ship.y : ship.y + i;
            if (sx === x && sy === y) {
              hit = true;
              targetPlayer.hits.add(key);
              // Check sunk
              let allHit = true;
              for (let j = 0; j < ship.size; j++) {
                const cx = ship.horizontal ? ship.x + j : ship.x;
                const cy = ship.horizontal ? ship.y : ship.y + j;
              if (!targetPlayer.hits.has(`${cx},${cy}`)) {
                  allHit = false;
                }
              }
              if (allHit) sunk = ship.name;
            }
          }
        }
        broadcast(room, 'game:fire', { shooter: pos, x, y, hit, sunk });
        // Check win
        const allSunk = targetPlayer.ships.every((ship: ShipPlacement) => {
          for (let i = 0; i < ship.size; i++) {
            const sx = ship.horizontal ? ship.x + i : ship.x;
            const sy = ship.horizontal ? ship.y : ship.y + i;
            if (!((room.players[target] as BattleshipPlayer).hits as Set<string>).has(`${sx},${sy}`)) {
              return false;
            }
          }
          return true;
        });
        if (allSunk) {
          room.phase = 'finished';
          broadcast(room, 'game:over', { winner: pos });
          return;
        }
        (room as BattleshipRoom).currentPlayer = target;
        broadcast(room, 'game:turn', { position: (room as BattleshipRoom).currentPlayer });
        break;
      }
    }
  }

  if (msg.type === 'game:state') {
    for (const [, room] of rooms) {
      const p = room.players.find((player) => player.id === sid);
      if (p) {
        broadcast(room, 'game:state', { id: sid, state: msg.data as FireData });
        break;
      }
    }
  }
}

router.get('/health', (_req, res) => res.json({ status: 'ok', game: 'battleship' }));

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
        console.error('[battleship] 消息处理错误:', err);
      }
    });
    ws.on('close', () => {
      clients.delete(sid);
      socketToRoom.delete(sid);
      const i = matchQueue.findIndex((q) => q.id === sid);
      if (i >= 0) matchQueue.splice(i, 1);
    });
    ws.on('error', () => clients.delete(sid));
  });
  log(LogLevel.INFO, `🔌 WebSocket 已注册: ${tp}`);
}
