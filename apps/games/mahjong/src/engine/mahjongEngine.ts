import type { Tile, Suit, Seat, Player, GameState, Meld } from './types';
import { SEATS, NEXT_SEAT, SEAT_LABEL } from './types';

// ===== 牌面标签 =====
const WAN_LABEL = ['', '一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万'];
const TIAO_LABEL = ['', '一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条'];
const TONG_LABEL = ['', '一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒'];
const FENG_LABEL = ['', '东', '南', '西', '北', '中', '发', '白'];
const HUA_LABEL = ['', '春', '夏', '秋', '冬', '梅', '兰', '竹', '菊'];

const WAN_SHORT = ['','一','二','三','四','五','六','七','八','九'];
const TIAO_SHORT = ['','①','②','③','④','⑥','⑦','⑧','⑨'];
const TONG_SHORT = ['','⑴','⑵','⑶','⑷','⑸','⑹','⑺','⑻','⑼'];

function makeTile(suit: Suit, value: number, id: number): Tile {
  let label = '';
  if (suit === 'wan') label = WAN_LABEL[value] || `${value}万`;
  else if (suit === 'tiao') label = TIAO_LABEL[value] || `${value}条`;
  else if (suit === 'tong') label = TONG_LABEL[value] || `${value}筒`;
  else if (suit === 'feng') label = FENG_LABEL[value] || '';
  else if (suit === 'hua') label = HUA_LABEL[value] || '';
  return { id, suit, value, label };
}

// ===== 创建牌组 =====
export function createTiles(chuanma = false): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  // 万/条/筒 各4张
  for (const suit of ['wan', 'tiao', 'tong'] as Suit[]) {
    for (let v = 1; v <= 9; v++) {
      for (let i = 0; i < 4; i++) tiles.push(makeTile(suit, v, id++));
    }
  }
  // 风牌+三元牌 各4张
  for (let v = 1; v <= 7; v++) {
    for (let i = 0; i < 4; i++) tiles.push(makeTile('feng', v, id++));
  }
  // 花牌（川麻无花牌）
  if (!chuanma) {
    for (let v = 1; v <= 8; v++) {
      tiles.push(makeTile('hua', v, id++));
    }
  }
  return tiles;
}

// ===== 洗牌 =====
export function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ===== 发牌 =====
export function deal(mode: 'guobiao' | 'chuanma'): GameState {
  const tiles = createTiles(mode === 'chuanma');
  shuffle(tiles);

  const players: Record<Seat, Player> = {} as Record<Seat, Player>;
  let idx = 0;
  for (const seat of SEATS) {
    const handSize = 13;
    players[seat] = {
      seat, name: SEAT_LABEL[seat] + '家',
      hand: tiles.slice(idx, idx + handSize),
      melds: [], isHuman: seat === 'south',
      discards: []
    };
    idx += handSize;
  }
  const wall = tiles.slice(idx);
  // Sort hands
  for (const seat of SEATS) sortHand(players[seat].hand);

  return {
    phase: 'playing', wall, players,
    currentTurn: 'east', lastDiscard: null, lastDiscardSeat: null,
    winner: null, winType: null, actionPending: null,
    log: [`${mode === 'chuanma' ? '川麻' : '国标'}麻将开始！`],
    mode, dealer: 'east', turnCount: 0
  };
}

// ===== 排序 =====
export function sortHand(hand: Tile[]): void {
  hand.sort((a, b) => {
    const suitOrder: Record<Suit, number> = { wan: 0, tiao: 1, tong: 2, feng: 3, hua: 4 };
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
    return a.value - b.value;
  });
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.value === b.value;
}

// ===== 摸牌 =====
export function drawTile(state: GameState, seat: Seat): Tile | null {
  if (state.wall.length === 0) return null;
  const tile = state.wall.pop()!;
  state.players[seat].hand.push(tile);
  return tile;
}

// ===== 打牌 =====
export function discardTile(state: GameState, seat: Seat, tileId: number): boolean {
  const player = state.players[seat];
  const idx = player.hand.findIndex(t => t.id === tileId);
  if (idx === -1) return false;
  const tile = player.hand.splice(idx, 1)[0];
  player.discards.push(tile);
  state.lastDiscard = tile;
  state.lastDiscardSeat = seat;
  sortHand(player.hand);
  state.turnCount++;
  return true;
}

// ===== 检测可执行动作 =====
export function detectActions(state: GameState, seat: Seat): string[] {
  if (!state.lastDiscard) return [];
  const tile = state.lastDiscard;
  const hand = state.players[seat].hand;
  const actions: string[] = [];

  // 胡牌检测
  const testHand = [...hand, tile];
  if (canHu(testHand)) actions.push('hu');

  // 碰：手中有2张相同
  const pongCount = hand.filter(t => sameTile(t, tile)).length;
  if (pongCount >= 2 && state.lastDiscardSeat !== seat) actions.push('pong');

  // 杠：手中有3张相同
  if (pongCount >= 3 && state.lastDiscardSeat !== seat) actions.push('kong');

  // 吃：上家的牌 + 手中2张组成顺子（仅上家可吃）
  if (state.lastDiscardSeat === NEXT_SEAT[NEXT_SEAT[NEXT_SEAT[seat]]] || 
      getNext(NEXT_SEAT[state.lastDiscardSeat!]) === seat) {
    // Only check for the seat that is next after the discarder
    if (tile.suit === 'wan' || tile.suit === 'tiao' || tile.suit === 'tong') {
      if (canChi(hand, tile)) actions.push('chi');
    }
  }

  return actions;
}

function getNext(seat: Seat): Seat { return NEXT_SEAT[seat]; }

// ===== 吃检测 =====
function canChi(hand: Tile[], tile: Tile): boolean {
  if (tile.suit !== 'wan' && tile.suit !== 'tiao' && tile.suit !== 'tong') return false;
  const v = tile.value;
  const suitTiles = hand.filter(t => t.suit === tile.suit);
  const values = new Set(suitTiles.map(t => t.value));

  // v-2, v-1, v
  if (v >= 3 && values.has(v - 2) && values.has(v - 1)) return true;
  // v-1, v, v+1
  if (v >= 2 && v <= 8 && values.has(v - 1) && values.has(v + 1)) return true;
  // v, v+1, v+2
  if (v <= 7 && values.has(v + 1) && values.has(v + 2)) return true;
  return false;
}

// ===== 执行碰 =====
export function doPong(state: GameState, seat: Seat): void {
  const tile = state.lastDiscard!;
  const hand = state.players[seat].hand;
  const pongTiles = [tile];
  // Remove from last discarder's discards
  const discards = state.players[NEXT_SEAT[state.lastDiscardSeat!]].discards;
  const dIdx = discards.findIndex(t => t.id === tile.id);
  if (dIdx !== -1) discards.splice(dIdx, 1);

  // Take 2 from hand
  let taken = 0;
  for (let i = hand.length - 1; i >= 0 && taken < 2; i--) {
    if (sameTile(hand[i], tile)) {
      pongTiles.push(hand.splice(i, 1)[0]);
      taken++;
    }
  }
  pongTiles.sort((a, b) => a.id - b.id);
  state.players[seat].melds.push({ type: 'pong', tiles: pongTiles, from: state.lastDiscardSeat ?? undefined });
  state.currentTurn = seat;
  state.lastDiscard = null;
  state.log.unshift(`${SEAT_LABEL[seat]}家 碰 ${tile.label}`);
}

// ===== 执行杠 =====
export function doKong(state: GameState, seat: Seat): void {
  const tile = state.lastDiscard!;
  const hand = state.players[seat].hand;
  const kongTiles = [tile];
  const discards = state.players[NEXT_SEAT[state.lastDiscardSeat!]].discards;
  const dIdx = discards.findIndex(t => t.id === tile.id);
  if (dIdx !== -1) discards.splice(dIdx, 1);

  let taken = 0;
  for (let i = hand.length - 1; i >= 0 && taken < 3; i--) {
    if (sameTile(hand[i], tile)) {
      kongTiles.push(hand.splice(i, 1)[0]);
      taken++;
    }
  }
  kongTiles.sort((a, b) => a.id - b.id);
  state.players[seat].melds.push({ type: 'kong', tiles: kongTiles, from: state.lastDiscardSeat ?? undefined });
  state.currentTurn = seat;
  state.lastDiscard = null;
  state.log.unshift(`${SEAT_LABEL[seat]}家 杠 ${tile.label}`);
  // 补牌
  drawTile(state, seat);
}

// ===== 执行吃 =====
export function doChi(state: GameState, seat: Seat, chiTiles: Tile[]): void {
  const tile = state.lastDiscard!;
  const hand = state.players[seat].hand;
  const meldTiles = [tile];

  const discards = state.players[NEXT_SEAT[state.lastDiscardSeat!]].discards;
  const dIdx = discards.findIndex(t => t.id === tile.id);
  if (dIdx !== -1) discards.splice(dIdx, 1);

  for (const ct of chiTiles) {
    const hIdx = hand.findIndex(t => t.id === ct.id);
    if (hIdx !== -1) meldTiles.push(hand.splice(hIdx, 1)[0]);
  }
  meldTiles.sort((a, b) => a.value - b.value);
  state.players[seat].melds.push({ type: 'chi', tiles: meldTiles, from: state.lastDiscardSeat ?? undefined });
  state.currentTurn = seat;
  state.lastDiscard = null;
  state.log.unshift(`${SEAT_LABEL[seat]}家 吃 ${tile.label}`);
}

// ===== 胡牌检测 =====
export function canHu(tiles: Tile[]): boolean {
  // Filter out hua tiles for hu detection
  const regular = tiles.filter(t => t.suit !== 'hua');
  const n = regular.length;
  if (n < 2) return false;

  // 七对
  if (n === 14 && isQiDui(regular)) return true;

  // 十三幺
  if (n === 14 && isShiSanYao(regular)) return true;

  // 标准胡牌：n-2 张组成顺子/刻子 + 1 对将
  return canFormMelds(regular);
}

function isQiDui(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false;
  const sorted = [...tiles].sort((a, b) => a.id - b.id);
  for (let i = 0; i < 14; i += 2) {
    if (i + 1 >= 14 || !sameTile(sorted[i], sorted[i + 1])) return false;
  }
  return true;
}

function isShiSanYao(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false;
  const yaoTiles = [1, 9]; // 万/条/筒 的1和9
  const fengTiles = [1, 2, 3, 4, 5, 6, 7]; // 风牌+三元
  const counts = new Map<string, number>();
  for (const t of tiles) {
    const key = `${t.suit}-${t.value}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let hasPair = false;
  for (const suit of ['wan', 'tiao', 'tong'] as Suit[]) {
    for (const v of yaoTiles) {
      const c = counts.get(`${suit}-${v}`) || 0;
      if (c === 0) return false;
      if (c === 2) hasPair = true;
    }
  }
  for (const v of fengTiles) {
    const c = counts.get(`feng-${v}`) || 0;
    if (c === 0) return false;
    if (c === 2) hasPair = true;
  }
  return hasPair;
}

function canFormMelds(tiles: Tile[]): boolean {
  const sorted = [...tiles].sort((a, b) => {
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return a.value - b.value;
  });

  // Try each pair as the eye
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sameTile(sorted[i], sorted[i + 1])) {
      const remaining = sorted.filter((_, j) => j !== i && j !== i + 1);
      if (checkMelds(remaining)) return true;
    }
  }
  return false;
}

function checkMelds(tiles: Tile[]): boolean {
  if (tiles.length === 0) return true;
  if (tiles.length % 3 !== 0) return false;

  const first = tiles[0];
  // Try triplet
  if (tiles.length >= 3 && sameTile(tiles[0], tiles[1]) && sameTile(tiles[1], tiles[2])) {
    const rest = tiles.slice(3);
    if (checkMelds(rest)) return true;
  }
  // Try sequence
  if ((first.suit === 'wan' || first.suit === 'tiao' || first.suit === 'tong') && first.value <= 7) {
    const idx2 = tiles.findIndex(t => t.suit === first.suit && t.value === first.value + 1);
    const idx3 = tiles.findIndex(t => t.suit === first.suit && t.value === first.value + 2);
    if (idx2 !== -1 && idx3 !== -1 && idx2 !== idx3) {
      const rest = tiles.filter((_, j) => j !== 0 && j !== idx2 && j !== idx3);
      if (checkMelds(rest)) return true;
    }
  }
  return false;
}

// ===== 自摸检测 =====
export function canZimo(state: GameState, seat: Seat): boolean {
  const hand = state.players[seat].hand;
  return canHu(hand);
}

// ===== 获取打牌建议 =====
export function suggestDiscard(hand: Tile[]): Tile | null {
  if (hand.length === 0) return null;
  // Simple: discard the tile that least fits melds
  // Priority: discard isolated feng tiles first, then isolated number tiles
  const counts = new Map<string, number>();
  for (const t of hand) {
    const key = `${t.suit}-${t.value}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  // Find singles in feng
  for (const t of hand) {
    if (t.suit === 'feng') {
      const key = `${t.suit}-${t.value}`;
      if (counts.get(key) === 1) return t;
    }
  }

  // Find isolated number tiles
  for (const t of hand) {
    if (t.suit === 'wan' || t.suit === 'tiao' || t.suit === 'tong') {
      const key = `${t.suit}-${t.value}`;
      if (counts.get(key) === 1) {
        const hasAdj = hand.some(h => h.suit === t.suit && (h.value === t.value - 1 || h.value === t.value + 1));
        if (!hasAdj) return t;
      }
    }
  }

  // Just discard the last tile (sorted, so highest value)
  return hand[hand.length - 1];
}

export { SEAT_LABEL };
