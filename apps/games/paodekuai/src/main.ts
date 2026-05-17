import './style.css';

type Suit = '♠'|'♥'|'♦'|'♣';
type Rank = '3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A'|'2';
interface Card { id: number; suit: Suit; rank: Rank; value: number; label: string; }
type PlayType = 'pass'|'single'|'pair'|'triple'|'triple_one'|'triple_two'|'straight'|'pair_straight'|'plane'|'bomb';
interface Play { type: PlayType; cards: Card[]; mainValue: number; length: number; }
interface Player { name: string; hand: Card[]; isHuman: boolean; }
interface State { players: Player[]; turn: number; lastPlay: Play|null; lastSeat: number; passCount: number; winner: number|null; log: string[]; selected: Set<number>; }

const SUITS: Suit[] = ['♠','♥','♦','♣'];
const RANKS: Rank[] = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const RV: Record<Rank,number> = { '3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15 };

let state: State;

function createCards(): Card[] {
  let id = 0;
  return SUITS.flatMap(s => RANKS.map(r => ({ id: id++, suit: s, rank: r, value: RV[r], label: `${s}${r}` })));
}

function shuffle<T>(a: T[]): T[] { for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function renderPdzCard(card: Card, cls = 'pdz-card', dataId?: number): string {
  const corner = `${card.rank}<i>${card.suit}</i>`;
  const attr = dataId !== undefined ? ` data-id="${dataId}"` : '';
  return `<div class="${cls}"${attr}><span class="pdz-corner pdz-corner-tl">${corner}</span><span class="pdz-mid">${card.rank}${card.suit}</span><span class="pdz-corner pdz-corner-br">${corner}</span></div>`;
}

function sortHand(h: Card[]): void { h.sort((a,b) => b.value - a.value || a.suit.localeCompare(b.suit)); }

function init(): void {
  const deck = shuffle(createCards());
  const hands = [[], [], []] as Card[][];
  for (let i = 0; i < 52; i++) hands[i % 3].push(deck[i]);
  for (const h of hands) sortHand(h);
  // First player has 3 of spades
  let first = 0;
  for (let i = 0; i < 3; i++) if (hands[i].some(c => c.rank === '3' && c.suit === '♠')) first = i;
  state = {
    players: [
      { name: '你', hand: hands[0], isHuman: true },
      { name: '电脑1', hand: hands[1], isHuman: false },
      { name: '电脑2', hand: hands[2], isHuman: false },
    ],
    turn: first, lastPlay: null, lastSeat: -1, passCount: 0, winner: null, log: ['游戏开始！'], selected: new Set()
  };
}

function detectPlay(cards: Card[]): Play | null {
  if (cards.length === 0) return null;
  const sorted = [...cards].sort((a,b) => a.value - b.value);
  const n = cards.length;
  const counts = new Map<number, Card[]>();
  for (const c of sorted) { const l = counts.get(c.value) || []; l.push(c); counts.set(c.value, l); }
  if (n === 1) return { type: 'single', cards: sorted, mainValue: sorted[0].value, length: 1 };
  if (n === 2 && counts.size === 1) return { type: 'pair', cards: sorted, mainValue: sorted[0].value, length: 2 };
  if (n === 3 && counts.size === 1) return { type: 'triple', cards: sorted, mainValue: sorted[0].value, length: 3 };
  if (n === 4 && counts.size === 1) return { type: 'bomb', cards: sorted, mainValue: sorted[0].value, length: 4 };
  // 三带一
  if (n === 4 && counts.size === 2) {
    const t = [...counts.entries()].find(([,c]) => c.length === 3);
    if (t) return { type: 'triple_one', cards: sorted, mainValue: t[0], length: 4 };
  }
  // 三带二
  if (n === 5 && counts.size === 2) {
    const t = [...counts.entries()].find(([,c]) => c.length === 3);
    const p = [...counts.entries()].find(([,c]) => c.length === 2);
    if (t && p) return { type: 'triple_two', cards: sorted, mainValue: t[0], length: 5 };
  }
  // 顺子
  if (n >= 5 && counts.size === n && sorted[0].value >= 3 && sorted[n-1].value <= 14) {
    const vals = sorted.map(c => c.value);
    if (vals[n-1] - vals[0] === n - 1) return { type: 'straight', cards: sorted, mainValue: vals[n-1], length: n };
  }
  // 连对
  if (n >= 6 && n % 2 === 0) {
    const pvals = [...counts.entries()].filter(([,c]) => c.length >= 2).map(([v]) => v).sort((a,b) => a-b);
    if (pvals.length === n/2 && pvals[pvals.length-1] - pvals[0] === pvals.length - 1)
      return { type: 'pair_straight', cards: sorted, mainValue: pvals[pvals.length-1], length: n };
  }
  // 飞机
  const tvals = [...counts.entries()].filter(([,c]) => c.length >= 3).map(([v]) => v).sort((a,b) => a-b);
  if (tvals.length >= 2) {
    for (let len = Math.min(tvals.length, 3); len >= 2; len--) {
      for (let start = 0; start <= tvals.length - len; start++) {
        if (tvals[start+len-1] - tvals[start] === len - 1) {
          if (n === len * 3) return { type: 'plane', cards: sorted, mainValue: tvals[start+len-1], length: len };
        }
      }
    }
  }
  return null;
}

function canBeat(play: Play, cur: Play | null): boolean {
  if (!cur) return true;
  if (play.type === 'bomb' && cur.type !== 'bomb') return true;
  if (play.type !== 'bomb' && cur.type === 'bomb') return false;
  if (play.type === 'bomb' && cur.type === 'bomb') return play.mainValue > cur.mainValue;
  if (play.type !== cur.type || play.length !== cur.length) return false;
  return play.mainValue > cur.mainValue;
}

function doPlay(seat: number, cards: Card[]): boolean {
  const play = detectPlay(cards);
  if (!play) return false;
  if (state.lastPlay && state.lastSeat !== seat && !canBeat(play, state.lastPlay)) return false;
  const ids = new Set(cards.map(c => c.id));
  state.players[seat].hand = state.players[seat].hand.filter(c => !ids.has(c.id));
  state.lastPlay = play; state.lastSeat = seat; state.passCount = 0;
  state.log.unshift(`${state.players[seat].name} 出 ${play.type}：${cards.map(c=>c.label).join(' ')}`);
  if (state.players[seat].hand.length === 0) { state.winner = seat; state.log.unshift(`${state.players[seat].name} 获胜！`); }
  return true;
}

function doPass(seat: number): void {
  state.passCount++;
  state.log.unshift(`${state.players[seat].name} 过`);
  if (state.passCount >= 2) { state.lastPlay = null; state.passCount = 0; }
}

function aiPlay(seat: number): void {
  const hand = state.players[seat].hand;
  // Simple AI: try singles first, then pairs, then combos
  const sorted = [...hand].sort((a,b) => a.value - b.value);
  for (const c of sorted) {
    const play = detectPlay([c]);
    if (play && (!state.lastPlay || canBeat(play, state.lastPlay) || state.lastSeat === seat)) {
      doPlay(seat, [c]); return;
    }
  }
  doPass(seat);
}

function nextTurn(): void {
  if (state.winner !== null) return;
  do { state.turn = (state.turn + 1) % 3; } while (state.players[state.turn].hand.length === 0);
  if (!state.players[state.turn].isHuman) {
    setTimeout(() => { aiPlay(state.turn); nextTurn(); render(); }, 600);
  }
}

// ===== 渲染 =====
const app = document.getElementById('app')!;

function render(): void {
  const p = state.players;
  const myTurn = state.turn === 0 && state.winner === null;

  app.innerHTML = `
    <div class="pdz-wrapper">
      <div class="pdz-topbar">
        <span>🏃 跑得快</span>
        <span>${state.winner !== null ? `${p[state.winner].name} 获胜！` : `轮到 ${p[state.turn].name}`}</span>
        <button id="pdz-restart" class="pdz-btn small">重开</button>
      </div>
      <div class="pdz-table">
        <div class="pdz-opp">
          ${p[1].name} (${p[1].hand.length}张) ${state.lastSeat === 1 ? '<div class="pdz-played">' + (state.lastPlay ? state.lastPlay.cards.map(c=>renderPdzCard(c, 'pdz-card-sm')).join('') : '') + '</div>' : ''}
        </div>
        <div class="pdz-opp">
          ${p[2].name} (${p[2].hand.length}张) ${state.lastSeat === 2 ? '<div class="pdz-played">' + (state.lastPlay ? state.lastPlay.cards.map(c=>renderPdzCard(c, 'pdz-card-sm')).join('') : '') + '</div>' : ''}
        </div>
        <div class="pdz-center">
          ${state.lastPlay && state.lastSeat === 0 ? '<div class="pdz-played">' + state.lastPlay.cards.map(c=>renderPdzCard(c, 'pdz-card-sm')).join('') + '</div>' : ''}
        </div>
        <div class="pdz-bottom">
          <div class="pdz-hand">${p[0].hand.map(c => renderPdzCard(c, `pdz-card ${state.selected.has(c.id)?'pdz-sel':''}`, c.id)).join('')}</div>
          ${myTurn ? `<div class="pdz-controls">
            <button class="pdz-btn primary" id="pdz-play">出牌</button>
            <button class="pdz-btn" id="pdz-pass" ${state.lastPlay && state.lastSeat !== 0 ? '' : 'disabled'}>过</button>
          </div>` : ''}
        </div>
      </div>
      <div class="pdz-log">${state.log.slice(0,4).map(l=>`<div>${l}</div>`).join('')}</div>
    </div>
  `;
  bindEvents();
}

function bindEvents(): void {
  document.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt((el as HTMLElement).dataset.id!);
      if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
      render();
    });
  });
  document.getElementById('pdz-play')?.addEventListener('click', () => {
    const cards = state.players[0].hand.filter(c => state.selected.has(c.id));
    if (doPlay(0, cards)) { state.selected.clear(); nextTurn(); render(); }
  });
  document.getElementById('pdz-pass')?.addEventListener('click', () => {
    doPass(0); state.selected.clear(); nextTurn(); render();
  });
  document.getElementById('pdz-restart')?.addEventListener('click', () => { init(); render(); });
}

init(); render();
