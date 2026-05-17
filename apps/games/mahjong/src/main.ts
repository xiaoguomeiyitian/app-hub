import { deal, drawTile, discardTile, detectActions, doPong, doKong, doChi, canZimo, suggestDiscard, sortHand, sameTile, SEAT_LABEL } from './engine/mahjongEngine';
import type { GameState, Seat, Tile, Player } from './engine/types';
import { SEATS, NEXT_SEAT } from './engine/types';
import './style.css';

const app = document.getElementById('app')!;
let state: GameState = deal('guobiao');
let timer: number | null = null;
let selectedTileId: number | null = null;
let statusMsg = '';

// ===== 渲染 =====
function render(): void {
  const p = state.players;
  const myTurn = state.currentTurn === 'south' && state.phase === 'playing';

  // 计算墙牌数
  const wallCount = state.wall.length;

  // 检测可操作动作
  const actions = state.actionPending ? state.actionPending.actions : [];
  const isActionPending = !!(state.actionPending && state.actionPending.seat === 'south');

  app.innerHTML = `
    <div class="mj-wrapper">
      <div class="mj-topbar">
        <span class="mj-title">🀄 麻将</span>
        <span class="mj-info">墙牌: ${wallCount} | ${state.mode === 'chuanma' ? '川麻' : '国标'}</span>
        <span class="mj-turn">${state.phase === 'finished' ? '🏆 ' + SEAT_LABEL[state.winner!] + '家胡' : SEAT_LABEL[state.currentTurn] + '家回合'}</span>
        <button id="mj-restart" class="mj-btn small">重开</button>
      </div>

      <div class="mj-table">
        <!-- 对家（顶部） -->
        <div class="mj-seat mj-seat-top ${state.currentTurn === 'north' ? 'active' : ''}">
          <div class="mj-seat-label">${p.north.name}</div>
          <div class="mj-hand-back">${renderBackTiles(p.north.hand.length)}</div>
          ${renderMelds(p.north.melds)}
        </div>

        <!-- 左右 -->
        <div class="mj-seat mj-seat-left ${state.currentTurn === 'west' ? 'active' : ''}">
          <div class="mj-seat-label">${p.west.name}</div>
          <div class="mj-hand-back mj-hand-vertical">${renderBackTiles(p.west.hand.length)}</div>
          ${renderMelds(p.west.melds)}
        </div>
        <div class="mj-seat mj-seat-right ${state.currentTurn === 'east' ? 'active' : ''}">
          <div class="mj-seat-label">${p.east.name}</div>
          <div class="mj-hand-back mj-hand-vertical">${renderBackTiles(p.east.hand.length)}</div>
          ${renderMelds(p.east.melds)}
        </div>

        <!-- 中央出牌区 -->
        <div class="mj-center">
          <div class="mj-discard-area">
            ${renderDiscards(p.north, '北')}
            ${renderDiscards(p.west, '西')}
            ${renderDiscards(p.east, '东')}
            ${renderDiscards(p.south, '南')}
          </div>
          ${state.lastDiscard ? `<div class="mj-last-discard">
            <span class="mj-last-label">${SEAT_LABEL[state.lastDiscardSeat!]}家打出</span>
            <div class="mj-tile mj-tile-l">${renderTile(state.lastDiscard)}</div>
          </div>` : ''}
        </div>

        <!-- 己方（底部） -->
        <div class="mj-seat mj-seat-bottom ${myTurn ? 'active' : ''}">
          <div class="mj-seat-label">${p.south.name}</div>
          <div class="mj-melds-bottom">${renderMelds(p.south.melds)}</div>
          <div class="mj-hand" id="mj-hand">
            ${p.south.hand.map(t => renderHandTile(t, myTurn)).join('')}
          </div>
          ${renderControls(myTurn, isActionPending, actions)}
        </div>
      </div>

      <div class="mj-log">${state.log.slice(0, 5).map(l => `<div>${l}</div>`).join('')}</div>
      ${statusMsg ? `<div class="mj-msg">${statusMsg}</div>` : ''}
    </div>
  `;

  bindEvents();
}

function renderTile(t: Tile): string {
  const colors: Record<string, string> = {
    wan: '#e74c3c', tiao: '#27ae60', tong: '#2980b9',
    feng: t.value <= 4 ? '#333' : (t.value === 5 ? '#e74c3c' : t.value === 6 ? '#27ae60' : '#333')
  };
  const color = colors[t.suit] || '#333';
  return `<span style="color:${color}">${t.label}</span>`;
}

function renderBackTiles(n: number): string {
  return Array.from({ length: Math.min(n, 14) }, () =>
    '<div class="mj-tile mj-tile-back"></div>'
  ).join('') + (n > 14 ? `<span class="mj-count">+${n - 14}</span>` : '');
}

function renderHandTile(t: Tile, interactive: boolean): string {
  const sel = selectedTileId === t.id ? 'mj-tile-selected' : '';
  const cls = interactive ? 'mj-tile-interactive' : '';
  const colors: Record<string, string> = {
    wan: '#e74c3c', tiao: '#27ae60', tong: '#2980b9',
    feng: t.value <= 4 ? '#333' : (t.value === 5 ? '#e74c3c' : t.value === 6 ? '#27ae60' : '#333')
  };
  const color = colors[t.suit] || '#333';
  return `<div class="mj-tile ${sel} ${cls}" data-tile-id="${t.id}">
    <span class="mj-tile-label" style="color:${color}">${t.label}</span>
  </div>`;
}

function renderMelds(melds: any[]): string {
  return melds.map(m => `<div class="mj-meld">${m.tiles.map((t: Tile) =>
    `<div class="mj-tile mj-tile-sm">${renderTile(t)}</div>`
  ).join('')}<span class="mj-meld-type">${m.type}</span></div>`).join('');
}

function renderDiscards(player: Player, label: string): string {
  if (player.discards.length === 0) return '';
  return `<div class="mj-discards">
    <span class="mj-discard-label">${label}</span>
    ${player.discards.slice(-12).map(t => `<div class="mj-tile mj-tile-xs">${renderTile(t)}</div>`).join('')}
  </div>`;
}

function renderControls(myTurn: boolean, isActionPending: boolean | undefined, actions: string[]): string {
  if (isActionPending && actions.length > 0) {
    return `<div class="mj-controls">
      ${actions.includes('hu') ? '<button class="mj-btn primary" data-action="hu">🀄 胡牌</button>' : ''}
      ${actions.includes('kong') ? '<button class="mj-btn" data-action="kong">杠</button>' : ''}
      ${actions.includes('pong') ? '<button class="mj-btn" data-action="pong">碰</button>' : ''}
      ${actions.includes('chi') ? '<button class="mj-btn" data-action="chi">吃</button>' : ''}
      <button class="mj-btn" data-action="pass">过</button>
    </div>`;
  }
  if (myTurn) {
    const hasSelected = selectedTileId !== null;
    return `<div class="mj-controls">
      ${canZimo(state, 'south') ? '<button class="mj-btn primary" data-action="zimo">🀄 自摸</button>' : ''}
      <button class="mj-btn primary" id="mj-discard" ${hasSelected ? '' : 'disabled'}>出牌</button>
      <button class="mj-btn" id="mj-hint">建议</button>
    </div>`;
  }
  return '';
}

// ===== 事件 =====
function bindEvents(): void {
  document.querySelectorAll('[data-tile-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt((el as HTMLElement).dataset.tileId!);
      selectedTileId = selectedTileId === id ? null : id;
      render();
    });
  });

  document.getElementById('mj-discard')?.addEventListener('click', () => {
    if (selectedTileId === null || state.currentTurn !== 'south') return;
    const tile = state.players.south.hand.find(t => t.id === selectedTileId);
    if (!tile) return;
    discardTile(state, 'south', selectedTileId);
    selectedTileId = null;
    statusMsg = '';
    // 检查其他玩家是否可操作
    scheduleAfterDiscard();
  });

  document.getElementById('mj-hint')?.addEventListener('click', () => {
    const suggest = suggestDiscard(state.players.south.hand);
    if (suggest) {
      selectedTileId = suggest.id;
      statusMsg = `建议打出：${suggest.label}`;
      render();
    }
  });

  document.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = (el as HTMLElement).dataset.action!;
      handleAction(action);
    });
  });

  document.getElementById('mj-restart')?.addEventListener('click', () => {
    if (timer) { clearTimeout(timer); timer = null; }
    state = deal(state.mode);
    selectedTileId = null;
    statusMsg = '';
    render();
    scheduleAiTurns();
  });
}

function handleAction(action: string): void {
  if (!state.actionPending) return;
  const seat = state.actionPending.seat;

  if (action === 'hu') {
    state.phase = 'finished';
    state.winner = seat;
    state.winType = 'dianpao';
    state.log.unshift(`${SEAT_LABEL[seat]}家 胡了！`);
    state.actionPending = null;
    render();
    return;
  }
  if (action === 'pong') {
    doPong(state, seat);
    state.actionPending = null;
    selectedTileId = null;
    if (seat === 'south') { render(); return; }
    scheduleAiTurns();
    return;
  }
  if (action === 'kong') {
    doKong(state, seat);
    state.actionPending = null;
    if (seat === 'south') { render(); return; }
    scheduleAiTurns();
    return;
  }
  if (action === 'chi') {
    // Simplified: auto-pick first 2 matching tiles
    const tile = state.lastDiscard!;
    const hand = state.players[seat].hand;
    const chiCandidates: Tile[][] = [];
    const v = tile.value;
    if (v >= 3) {
      const t1 = hand.find(t => t.suit === tile.suit && t.value === v - 2);
      const t2 = hand.find(t => t.suit === tile.suit && t.value === v - 1);
      if (t1 && t2) chiCandidates.push([t1, t2]);
    }
    if (v >= 2 && v <= 8) {
      const t1 = hand.find(t => t.suit === tile.suit && t.value === v - 1);
      const t2 = hand.find(t => t.suit === tile.suit && t.value === v + 1);
      if (t1 && t2) chiCandidates.push([t1, t2]);
    }
    if (v <= 7) {
      const t1 = hand.find(t => t.suit === tile.suit && t.value === v + 1);
      const t2 = hand.find(t => t.suit === tile.suit && t.value === v + 2);
      if (t1 && t2) chiCandidates.push([t1, t2]);
    }
    if (chiCandidates.length > 0) {
      doChi(state, seat, chiCandidates[0]);
    }
    state.actionPending = null;
    if (seat === 'south') { render(); return; }
    scheduleAiTurns();
    return;
  }
  if (action === 'pass' || action === 'guo') {
    state.actionPending = null;
    // Continue to next player
    state.currentTurn = NEXT_SEAT[state.lastDiscardSeat!];
    scheduleAiTurns();
    return;
  }
}

function scheduleAfterDiscard(): void {
  if (timer) clearTimeout(timer);
  // Check all other players for actions
  const otherSeats = SEATS.filter(s => s !== state.lastDiscardSeat);
  for (const seat of otherSeats) {
    const actions = detectActions(state, seat);
    if (actions.length > 0) {
      if (seat === 'south') {
        state.actionPending = { seat, actions, tile: state.lastDiscard! };
        render();
        return;
      }
      // AI action: hu > kong > pong > pass
      if (actions.includes('hu')) {
        state.phase = 'finished';
        state.winner = seat;
        state.winType = 'dianpao';
        state.log.unshift(`${SEAT_LABEL[seat]}家 点炮胡！`);
        render();
        return;
      }
      if (actions.includes('kong')) { doKong(state, seat); scheduleAiTurns(); return; }
      if (actions.includes('pong')) { doPong(state, seat); scheduleAiTurns(); return; }
      if (actions.includes('chi') && Math.random() > 0.5) {
        // AI sometimes eats
        const tile = state.lastDiscard!;
        const hand = state.players[seat].hand;
        const v = tile.value;
        if (v >= 3) {
          const t1 = hand.find(t => t.suit === tile.suit && t.value === v - 2);
          const t2 = hand.find(t => t.suit === tile.suit && t.value === v - 1);
          if (t1 && t2) { doChi(state, seat, [t1, t2]); scheduleAiTurns(); return; }
        }
        if (v >= 2 && v <= 8) {
          const t1 = hand.find(t => t.suit === tile.suit && t.value === v - 1);
          const t2 = hand.find(t => t.suit === tile.suit && t.value === v + 1);
          if (t1 && t2) { doChi(state, seat, [t1, t2]); scheduleAiTurns(); return; }
        }
      }
    }
  }
  // No one wants the tile, next player draws
  state.currentTurn = NEXT_SEAT[state.lastDiscardSeat!];
  scheduleAiTurns();
}

function scheduleAiTurns(): void {
  if (timer) clearTimeout(timer);
  render();
  if (state.phase === 'finished') return;

  timer = window.setTimeout(() => {
    if (state.currentTurn === 'south') { render(); return; }

    const seat = state.currentTurn;
    // AI draws tile
    drawTile(state, seat);

    // Check zimo
    if (canZimo(state, seat)) {
      if (Math.random() > 0.3) { // 70% chance AI zimos
        state.phase = 'finished';
        state.winner = seat;
        state.winType = 'zimo';
        state.log.unshift(`${SEAT_LABEL[seat]}家 自摸！`);
        render();
        return;
      }
    }

    // Check angang
    const hand = state.players[seat].hand;
    for (const t of hand) {
      if (hand.filter(h => sameTile(h, t)).length === 4) {
        state.players[seat].melds.push({ type: 'angang', tiles: hand.filter(h => sameTile(h, t)).slice(0, 4) });
        state.players[seat].hand = hand.filter(h => !sameTile(h, t));
        state.log.unshift(`${SEAT_LABEL[seat]}家 暗杠`);
        drawTile(state, seat); // angang draws another
        break;
      }
    }

    // Discard
    const suggest = suggestDiscard(state.players[seat].hand);
    if (suggest) {
      discardTile(state, seat, suggest.id);
      scheduleAfterDiscard();
    }
  }, 800);
}

// ===== 启动 =====
render();
scheduleAiTurns();
