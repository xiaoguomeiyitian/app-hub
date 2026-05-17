/// <reference types="vite/client" />

import './style.css';

// ===== 牌逻辑 =====
type Suit = '♠' | '♥' | '♦' | '♣';
interface Card { suit: Suit; rank: string; }

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r });
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}

function handValue(hand: Card[]): number {
  let val = 0, aces = 0;
  for (const c of hand) {
    if (c.rank === 'A') { val += 11; aces++; }
    else if (['K', 'Q', 'J'].includes(c.rank)) val += 10;
    else val += parseInt(c.rank, 10);
  }
  while (val > 21 && aces > 0) { val -= 10; aces--; }
  return val;
}

function cardColor(c: Card): string {
  return (c.suit === '♥' || c.suit === '♦') ? '#e74c3c' : '#fff';
}

// ===== 单人模式 =====
let deck: Card[] = [];
let playerHand: Card[] = [];
let dealerHand: Card[] = [];
let chips = 1000;
let bet = 100;
let gameActive = false;
let showDealer = false;
let message = '下注开始';

// ===== 在线模式 =====
let isOnline = false;
let ws: WebSocket | null = null;
let onlinePosition = -1;

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const path = window.location.pathname.replace(/\/blackjack\/?$/, '').replace(/\/$/, '');
  return `${proto}//${window.location.host}${path}/api/blackjack/websocket`;
}

const STORAGE_KEY = 'bj_chips';
try { chips = parseInt(localStorage.getItem(STORAGE_KEY) || '1000', 10) || 1000; } catch {}

function saveChips(): void {
  try { localStorage.setItem(STORAGE_KEY, String(chips)); } catch {}
}

function startGame(): void {
  if (gameActive) return;
  if (chips < bet) { message = '筹码不足！'; render(); return; }
  chips -= bet;
  deck = makeDeck();
  playerHand = [deck.pop()!, deck.pop()!];
  dealerHand = [deck.pop()!, deck.pop()!];
  gameActive = true;
  showDealer = false;
  message = '';

  // 检查 blackjack
  if (handValue(playerHand) === 21) {
    message = 'Blackjack! 🎉';
    chips += Math.floor(bet * 2.5);
    gameActive = false;
    showDealer = true;
    saveChips();
  }
  render();
}

function hit(): void {
  if (!gameActive) return;
  playerHand.push(deck.pop()!);
  const val = handValue(playerHand);
  if (val > 21) {
    message = '爆牌！💀';
    gameActive = false;
    showDealer = true;
    saveChips();
  } else if (val === 21) {
    stand();
  }
  render();
}

function stand(): void {
  if (!gameActive) return;
  gameActive = false;
  showDealer = true;
  // AI 庄家：≤16 要牌
  while (handValue(dealerHand) < 17) dealerHand.push(deck.pop()!);

  const pv = handValue(playerHand), dv = handValue(dealerHand);
  if (dv > 21) { message = '庄家爆牌！你赢了！🎉'; chips += bet * 2; }
  else if (pv > dv) { message = '你赢了！🎉'; chips += bet * 2; }
  else if (pv < dv) { message = '庄家赢了 😢'; }
  else { message = '平局 🤝'; chips += bet; }
  saveChips();
  render();
}

function setBet(b: number): void {
  if (gameActive) return;
  bet = b;
  render();
}

// ===== 渲染 =====
const app = document.getElementById('app')!;

function renderCard(c: Card, hidden = false): string {
  if (hidden) return `<div class="bj-card bj-hidden">?</div>`;
  const color = cardColor(c);
  return `<div class="bj-card" style="color:${color}">
    <span class="bj-corner bj-tl"><span class="bj-rank">${c.rank}</span><span class="bj-suit">${c.suit}</span></span>
    <span class="bj-mid">${c.rank}</span>
    <span class="bj-corner bj-br"><span class="bj-rank">${c.rank}</span><span class="bj-suit">${c.suit}</span></span>
  </div>`;
}

function render(): void {
  const dTotal = showDealer ? handValue(dealerHand) : '?';
  const pTotal = handValue(playerHand);

  app.innerHTML = `<div class="bj-wrapper">
    <h1 class="bj-title">🃏 21点</h1>
    <div class="bj-controls">
      <select id="bj-mode" class="bj-select">
        <option value="single" ${!isOnline ? 'selected' : ''}>单人模式</option>
        <option value="online" ${isOnline ? 'selected' : ''}>联机对战</option>
      </select>
    </div>
    <div class="bj-chips">
      <span class="bj-chip-label">💰 筹码: ${chips}</span>
      <div class="bj-bet-btns">
        ${[100,200,500].map(b => `<button class="bj-chip ${bet===b?'active':''}" data-bet="${b}">${b}</button>`).join('')}
      </div>
      <span class="bj-bet-label">下注: ${bet}</span>
    </div>
    <div class="bj-table">
      <div class="bj-area">
        <div class="bj-label">庄家 <span class="bj-total">${dTotal}</span></div>
        <div class="bj-hand">${dealerHand.map((c, i) => renderCard(c, !showDealer && i === 1)).join('')}</div>
      </div>
      <div class="bj-divider"></div>
      <div class="bj-area">
        <div class="bj-hand">${playerHand.map(c => renderCard(c)).join('')}</div>
        <div class="bj-label">你 <span class="bj-total">${pTotal}</span></div>
      </div>
    </div>
    <div class="bj-message">${message}</div>
    <div class="bj-actions">
      <button class="bj-btn deal" id="bj-deal" ${gameActive ? 'disabled' : ''}>发牌</button>
      <button class="bj-btn hit" id="bj-hit" ${!gameActive ? 'disabled' : ''}>要牌 Hit</button>
      <button class="bj-btn stand" id="bj-stand" ${!gameActive ? 'disabled' : ''}>停牌 Stand</button>
    </div>
    ${isOnline ? renderOnlineUI() : ''}
  </div>`;

  bindEvents();
}

function renderOnlineUI(): string {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return `<div class="bj-online"><input id="bj-nick" class="bj-input" placeholder="昵称"><button class="bj-btn" id="bj-connect">连接</button></div>`;
  }
  return `<div class="bj-online"><button class="bj-btn" id="bj-match">匹配对战</button><div class="bj-status" id="bj-status">已连接</div></div>`;
}

function bindEvents(): void {
  document.getElementById('bj-deal')?.addEventListener('click', () => {
    if (isOnline) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'game:hit' }));
    } else startGame();
  });
  document.getElementById('bj-hit')?.addEventListener('click', () => {
    if (isOnline && ws) ws.send(JSON.stringify({ type: 'game:hit' }));
    else hit();
  });
  document.getElementById('bj-stand')?.addEventListener('click', () => {
    if (isOnline && ws) ws.send(JSON.stringify({ type: 'game:stand' }));
    else stand();
  });

  document.querySelectorAll('[data-bet]').forEach(el => {
    el.addEventListener('click', () => setBet(parseInt((el as HTMLElement).dataset.bet!, 10)));
  });

  const modeSel = document.getElementById('bj-mode') as HTMLSelectElement | null;
  modeSel?.addEventListener('change', () => {
    isOnline = modeSel.value === 'online';
    if (!isOnline && ws) { ws.close(); ws = null; }
    render();
  });

  document.getElementById('bj-connect')?.addEventListener('click', () => {
    
    ws = new WebSocket(getWsUrl());
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        handleOnlineMsg(msg.type, msg.data);
      } catch {}
    };
    ws.onopen = () => render();
    ws.onclose = () => render();
  });

  document.getElementById('bj-match')?.addEventListener('click', () => {
    if (ws) ws.send(JSON.stringify({ type: 'match:join' }));
    const st = document.getElementById('bj-status');
    if (st) st.textContent = '匹配中...';
  });
}

function handleOnlineMsg(type: string, data: unknown): void {
  const d = data as Record<string, unknown>;
  if (type === 'connected') { render(); return; }
  if (type === 'pong') return;
  if (type === 'match:queued') {
    const st = document.getElementById('bj-status');
    if (st) st.textContent = `匹配中... 队列位置 ${(d as { position: number }).position}`;
    return;
  }
  if (type === 'match:found' || type === 'game:deal') {
    const gd = d as { hand: Card[] };
    playerHand = gd.hand || [];
    dealerHand = [];
    gameActive = true;
    showDealer = false;
    message = '游戏开始！';
    render();
    return;
  }
  if (type === 'game:turn') {
    const gd = d as { position: number; hand: Card[]; total: number };
    if (gd.position === onlinePosition) {
      playerHand = gd.hand;
      message = `轮到你了 (${gd.total})`;
    }
    render();
    return;
  }
  if (type === 'game:hit') {
    const gd = d as { position: number; hand: Card[]; total: number; busted: boolean };
    playerHand = gd.hand;
    if (gd.busted) message = '爆牌！💀';
    render();
    return;
  }
  if (type === 'game:settle') {
    const gd = d as { dealer: Card[]; dealerTotal: number; results: { result: string }[] };
    dealerHand = gd.dealer || [];
    showDealer = true;
    gameActive = false;
    const r = gd.results?.[onlinePosition];
    message = r?.result === 'win' ? '你赢了！🎉' : r?.result === 'lose' ? '你输了 😢' : '平局 🤝';
    render();
    return;
  }
}

render();
