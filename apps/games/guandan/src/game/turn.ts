import { chooseLeadCombo, chooseResponseCombo } from './ai'
import { activeSeatCount, finalizeIfNeeded, getTurnTimeoutMs, nextActiveSeat, removeCardsFromHand, updateTracker } from './engine'
import type { Card, Combo, GameState } from './types'

export interface TurnHooks {
  onSouthPlay?: (label: string) => void
  onBotPlay?: (label: string) => void
}

export function resolveTimedTurn(state: GameState, hooks: TurnHooks = {}): void {
  if (state.phase !== 'playing') return
  const player = state.players[state.turn]
  if (player.finished) {
    state.turn = nextActiveSeat(state, state.turn)
    state.turnStartedAt = Date.now()
    state.turnTimeoutMs = getTurnTimeoutMs(state.turn)
    return
  }

  if (state.turn === 'south') {
    passTurn(state, '玩家超时，自动过牌。')
    return
  }

  const play = chooseResponseCombo(player.hand, state.trick.lastPlay, state, state.turn)
    ?? chooseLeadCombo(player.hand, state, state.turn)
  if (!play) {
    passTurn(state, `${player.name} 过牌。`)
    return
  }

  commitPlay(state, play, `${player.name} 出牌：${describeCombo(play)}。`)
  hooks.onBotPlay?.(`${player.name} 出牌：${describeCombo(play)}。`)
}

export function playHumanCards(state: GameState, cards: Card[], hooks: TurnHooks = {}): { ok: boolean; message?: string } {
  if (state.phase !== 'playing' || state.turn !== 'south') return { ok: false, message: '现在不是你的回合。' }
  const player = state.players.south
  if (player.finished) return { ok: false, message: '你已经出完牌了。' }

  if (cards.length === 0) return { ok: false, message: '请选择要出的牌。' }

  const combo = chooseLeadCombo(cards, state, 'south')
  if (!combo) return { ok: false, message: '当前选择不是合法牌型。' }
  if (!state.openingLeadCompleted && state.turn === state.openingStarter && !combo.cards.some((card) => card.rank === '3' && card.suit === 'spade')) {
    return { ok: false, message: '首出必须包含起牌点。' }
  }
  if (state.trick.lastPlay && !chooseResponseCombo(cards, state.trick.lastPlay, state, 'south')) {
    return { ok: false, message: '压不过上轮出牌。' }
  }

  commitPlay(state, combo, `玩家出牌：${describeCombo(combo)}。`)
  hooks.onSouthPlay?.(`玩家出牌：${describeCombo(combo)}。`)
  return { ok: true }
}

export function passHumanTurn(state: GameState): { ok: boolean; message?: string } {
  if (state.phase !== 'playing' || state.turn !== 'south') return { ok: false, message: '现在不是你的回合。' }
  if (!state.trick.lastPlay && state.turn === state.openingStarter && !state.openingLeadCompleted) {
    return { ok: false, message: '首出不能过牌。' }
  }
  passTurn(state, '玩家过牌。')
  return { ok: true }
}

function passTurn(state: GameState, logText: string): void {
  state.trick.passes += 1
  state.log.unshift(logText)
  handleAfterAction(state)
}

function commitPlay(state: GameState, play: Combo, logText: string): void {
  const player = state.players[state.turn]
  removeCardsFromHand(player.hand, play.cards)
  updateTracker(state.tracker, play.cards)
  state.trick.lastPlay = play
  state.trick.leaderSeat = state.turn
  state.trick.passes = 0
  state.log.unshift(logText)

  if (!state.openingLeadCompleted && state.turn === state.openingStarter && state.trick.leaderSeat === state.openingStarter) {
    state.openingLeadCompleted = true
    state.log.unshift('首出已完成。')
  }

  if (player.hand.length === 0 && !player.finished) {
    player.finished = true
    player.finishAt = state.finishOrder.length + 1
    state.finishOrder.push(player.id)
    state.log.unshift(`${player.name} 已出完，排名第 ${player.finishAt}。`)
  }

  handleAfterAction(state)
}

function handleAfterAction(state: GameState): void {
  if (finalizeIfNeeded(state)) return

  if (shouldResetTrick(state)) {
    resetTrick(state)
    return
  }

  state.turn = nextActiveSeat(state, state.turn)
  state.turnStartedAt = Date.now()
  state.turnTimeoutMs = getTurnTimeoutMs(state.turn)
}

function shouldResetTrick(state: GameState): boolean {
  return state.trick.lastPlay !== null && state.trick.passes >= activeSeatCount(state) - 1 && state.trick.leaderSeat !== null
}

function resetTrick(state: GameState): void {
  const leader = state.trick.leaderSeat
  state.trick.lastPlay = null
  state.trick.passes = 0
  if (leader) {
    state.turn = leader
    state.turnStartedAt = Date.now()
    state.turnTimeoutMs = getTurnTimeoutMs(state.turn)
    state.log.unshift('连续过牌，重新开牌。')
  }
}

function describeCombo(combo: Combo): string {
  return `${comboLabel(combo.type)} ${combo.cards.map((card) => card.label).join('、')}`
}

function comboLabel(type: Combo['type']): string {
  switch (type) {
    case 'single': return '单张'
    case 'pair': return '对子'
    case 'triple': return '三张'
    case 'threePair': return '三带对'
    case 'bomb': return '炸弹'
    case 'rocket': return '四大天王'
    case 'straight': return '顺子'
    case 'flushStraight': return '同花顺'
    case 'pairStraight': return '连对'
    case 'tripleStraight': return '三顺'
  }
}
