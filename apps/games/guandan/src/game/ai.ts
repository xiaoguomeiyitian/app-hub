import type { Card, Combo, GameState, SeatId } from './types'
import { canBeat, getAllCombos, seatTeam, seatOrder } from './engine'

type StrategyMode = 'lead' | 'response'

type CardPressureMap = Map<string, number>

export function chooseLeadCombo(hand: Card[], state?: GameState, seat?: SeatId): Combo {
  // Bug #1: 首出强制含 ♠3
  if (state && !state.openingLeadCompleted && seat === state.openingStarter) {
    const allCombosFirst = getAllCombos(hand, state?.levelRank)
    const filtered = allCombosFirst.filter(c => c.cards.some(card => card.rank === '3' && card.suit === 'spade'))
    if (filtered.length > 0) {
      const scored = sortCombos(hand, filtered, null, 'lead', state, seat)
      return scored[0] ?? filtered[0]
    }
  }

  // 一手出完优先
  const allCombos = getAllCombos(hand, state?.levelRank)
  for (const combo of allCombos) {
    if (combo.cards.length === hand.length) return combo
  }
  const scored = sortCombos(hand, allCombos, null, 'lead', state, seat)
  return scored[0] ?? fallbackCombo(hand)
}

export function chooseResponseCombo(hand: Card[], current: Combo | null, state?: GameState, seat?: SeatId): Combo | null {
  if (!current) return chooseLeadCombo(hand, state, seat)
  const legal = getAllCombos(hand, state?.levelRank).filter((combo) => canBeat(combo, current))
  if (legal.length === 0) return null

  // 一手出完优先
  for (const combo of legal) {
    if (combo.cards.length === hand.length) return combo
  }

  const sameType = legal.filter((combo) => combo.type === current.type && combo.length === current.length)
  if (sameType.length > 0) {
    return sortCombos(hand, sameType, current, 'response', state, seat)[0] ?? null
  }

  const bombs = legal.filter((combo) => combo.type === 'bomb')
  if (bombs.length > 0) {
    const scored = sortCombos(hand, bombs, current, 'response', state, seat)
    // 团队意识：队友快赢时不轻易炸
    if (state && seat && !shouldBomb(state, seat)) return null
    return scored[0] ?? null
  }

  const rocket = legal.filter((combo) => combo.type === 'rocket')
  if (rocket.length > 0) {
    if (state && seat && !shouldBomb(state, seat)) return null
    return sortCombos(hand, rocket, current, 'response', state, seat)[0] ?? null
  }

  return null
}

export function chooseHintCombo(hand: Card[], current: Combo | null, state?: GameState): Combo | null {
  const legal = current ? getAllCombos(hand, state?.levelRank).filter((combo) => canBeat(combo, current)) : getAllCombos(hand, state?.levelRank)
  if (legal.length === 0) return null

  // 首出过滤：必须包含 ♠3
  if (state && !state.openingLeadCompleted && state.turn === state.openingStarter) {
    const filtered = legal.filter(combo => combo.cards.some(c => c.rank === '3' && c.suit === 'spade'))
    if (filtered.length > 0) {
      return sortCombos(hand, filtered, current, current ? 'response' : 'lead')[0] ?? null
    }
    // 如果没有包含 ♠3 的牌型，尝试找包含 ♠3 的最小牌型
    const spade3 = hand.find(c => c.rank === '3' && c.suit === 'spade')
    if (spade3) {
      const withSpade3 = legal.filter(combo => combo.cards.some(c => c.id === spade3.id))
      if (withSpade3.length > 0) {
        return sortCombos(hand, withSpade3, current, current ? 'response' : 'lead')[0] ?? null
      }
    }
  }

  return sortCombos(hand, legal, current, current ? 'response' : 'lead')[0] ?? null
}

export function chooseRecommendedCombo(hand: Card[], current: Combo | null, state?: GameState): Combo | null {
  const legal = current ? getAllCombos(hand, state?.levelRank).filter((combo) => canBeat(combo, current)) : getAllCombos(hand, state?.levelRank)
  if (legal.length === 0) return null

  // 首出过滤：必须包含 ♠3
  if (state && !state.openingLeadCompleted && state.turn === state.openingStarter) {
    const filtered = legal.filter(combo => combo.cards.some(c => c.rank === '3' && c.suit === 'spade'))
    if (filtered.length > 0) {
      return sortCombos(hand, filtered, current, current ? 'response' : 'lead')[0] ?? null
    }
  }

  // 一手出完优先
  for (const combo of legal) {
    if (combo.cards.length === hand.length) return combo
  }
  return sortCombos(hand, legal, current, current ? 'response' : 'lead')[0] ?? null
}

// ===== 团队意识 =====

function shouldBomb(state: GameState, seat: SeatId): boolean {
  const myTeam = seatTeam[seat]
  const partner = seatOrder.find(s => s !== seat && seatTeam[s] === myTeam)!
  const partnerHand = state.players[partner].hand.length
  const myHand = state.players[seat].hand.length

  // 队友快赢了 → 不炸
  if (partnerHand <= 3) return false
  // 自己快赢了 → 炸
  if (myHand <= 5) return true
  // 对手快赢了 → 炸
  const lastPlayer = state.trick.leaderSeat
  if (lastPlayer && seatTeam[lastPlayer] !== myTeam) {
    if (state.players[lastPlayer].hand.length <= 4) return true
  }
  return true
}

function teamAwarenessScore(state: GameState, seat: SeatId, combo: Combo, current: Combo | null): number {
  const myTeam = seatTeam[seat]
  const partner = seatOrder.find(s => s !== seat && seatTeam[s] === myTeam)!
  const partnerHand = state.players[partner].hand.length
  const myHand = state.players[seat].hand.length
  let score = 0

  // 队友是上轮出牌方 → 不压队友（除非一手出完）
  if (state.trick.leaderSeat === partner && combo.cards.length < myHand) {
    score += 500 // 强烈不压队友
  }

  // 队友快赢了 → 保守
  if (partnerHand <= 3) {
    if (combo.type === 'bomb' || combo.type === 'rocket') score += 800
  }

  // 自己快赢了 → 激进
  if (myHand <= 5) {
    score -= 300
  }

  // 对手快赢了 → 必须压
  if (current) {
    const lastPlayer = state.trick.leaderSeat
    if (lastPlayer && seatTeam[lastPlayer] !== myTeam) {
      if (state.players[lastPlayer].hand.length <= 4) {
        score -= 500
      }
    }
  }

  return score
}

// ===== 排序与评分 =====

function sortCombos(hand: Card[], combos: Combo[], current: Combo | null, mode: StrategyMode, state?: GameState, seat?: SeatId): Combo[] {
  const pressure = buildCardPressure(hand)
  return [...combos].sort((a, b) =>
    scoreCombo(pressure, a, current, mode, state, seat) - scoreCombo(pressure, b, current, mode, state, seat)
  )
}

function scoreCombo(
  pressure: CardPressureMap,
  combo: Combo,
  current: Combo | null,
  mode: StrategyMode,
  state?: GameState,
  seat?: SeatId
): number {
  const typeBase = comboTypeBase(combo.type)
  const pressureCost = combo.cards.reduce((sum, card) => sum + (pressure.get(card.id) ?? 0), 0)
  const valueCost = combo.primaryValue * valueWeight(combo.type, mode, current)
  const lengthBonus = combo.length * -40 // 长牌型奖励（负分 = 好）

  if (!current) {
    let score = typeBase + pressureCost + valueCost + lengthBonus
    if (state && seat) score += teamAwarenessScore(state, seat, combo, current)
    return score
  }

  const exactTypeBonus = combo.type === current.type && combo.length === current.length ? -300 : 0
  const sameTypeBonus = combo.type === current.type ? -80 : 0
  const bombPenalty = combo.type === 'bomb' ? 3000 : 0
  const rocketPenalty = combo.type === 'rocket' ? 6000 : 0
  const overtakeCost = Math.max(0, combo.primaryValue - current.primaryValue) * valueWeight(combo.type, mode, current)

  let score = typeBase + pressureCost + valueCost + lengthBonus + exactTypeBonus + sameTypeBonus + bombPenalty + rocketPenalty + overtakeCost
  if (state && seat) score += teamAwarenessScore(state, seat, combo, current)
  return score
}

function comboTypeBase(type: Combo['type']): number {
  switch (type) {
    case 'single': return 100
    case 'pair': return 50
    case 'triple': return 30
    case 'threePair': return 28
    case 'straight': return 15
    case 'pairStraight': return 20
    case 'tripleStraight': return 25
    case 'flushStraight': return 10
    case 'bomb': return 900
    case 'rocket': return 1500
  }
}

function valueWeight(type: Combo['type'], mode: StrategyMode, current: Combo | null): number {
  if (mode === 'response' && current) {
    if (type === current.type) return 3
    if (type === 'bomb') return 8
    if (type === 'rocket') return 12
  }
  switch (type) {
    case 'single': return 1
    case 'pair': return 2
    case 'triple': return 3
    case 'threePair': return 2
    case 'straight': return 1
    case 'pairStraight': return 1
    case 'tripleStraight': return 1
    case 'flushStraight': return 1
    case 'bomb': return 12
    case 'rocket': return 16
  }
}

// ===== 压力图 =====

function buildCardPressure(hand: Card[]): CardPressureMap {
  const pressure = new Map<string, number>()
  const byRank = new Map<number, Card[]>()
  for (const card of hand) {
    const list = byRank.get(card.rankValue)
    if (list) list.push(card)
    else byRank.set(card.rankValue, [card])
  }

  const rankValues = [...byRank.keys()].sort((a, b) => a - b)
  const sequenceCards = new Set<string>()
  markStraights(hand, sequenceCards)
  markPairStraights(hand, sequenceCards)
  markTripleStraights(hand, sequenceCards)

  for (const card of hand) {
    let cost = 0
    const sameRankCount = byRank.get(card.rankValue)?.length ?? 1
    if (sameRankCount >= 2) cost += 220
    if (sameRankCount >= 3) cost += 420
    if (sameRankCount >= 4) cost += 980
    if (card.rank === 'SJ' || card.rank === 'BJ') cost += 820
    if (card.rank === 'A') cost += 120  // A 保留价值较高
    if (sequenceCards.has(card.id)) cost += 360
    if (card.rankValue <= 12) cost += rankPressure(rankValues, card.rankValue)
    pressure.set(card.id, cost)
  }

  return pressure
}

function rankPressure(rankValues: number[], rankValue: number): number {
  const left = rankValues.includes(rankValue - 1)
  const right = rankValues.includes(rankValue + 1)
  const twoLeft = rankValues.includes(rankValue - 2)
  const twoRight = rankValues.includes(rankValue + 2)
  let cost = 0
  if (left || right) cost += 140
  if (left && right) cost += 180
  if (twoLeft || twoRight) cost += 70
  return cost
}

function markStraights(hand: Card[], set: Set<string>): void {
  const values = uniquePlayableValues(hand)
  for (let start = 0; start < values.length; start += 1) {
    let end = start + 1
    while (end < values.length && values[end] === values[end - 1] + 1) end += 1
    const run = values.slice(start, end)
    if (run.length < 5) continue
    for (const value of run) {
      const card = hand.find((item) => item.rankValue === value)
      if (card) set.add(card.id)
    }
    start = end - 1
  }
}

function markPairStraights(hand: Card[], set: Set<string>): void {
  const byRank = groupByRank(hand)
  const values = [...byRank.entries()].filter(([rank, cards]) => rank <= 12 && cards.length >= 2).map(([rank]) => rank).sort((a, b) => a - b)
  for (let start = 0; start < values.length; start += 1) {
    let end = start + 1
    while (end < values.length && values[end] === values[end - 1] + 1) end += 1
    const run = values.slice(start, end)
    if (run.length < 3) continue
    for (const value of run) {
      for (const card of byRank.get(value) ?? []) set.add(card.id)
    }
    start = end - 1
  }
}

function markTripleStraights(hand: Card[], set: Set<string>): void {
  const byRank = groupByRank(hand)
  const values = [...byRank.entries()].filter(([rank, cards]) => rank <= 12 && cards.length >= 3).map(([rank]) => rank).sort((a, b) => a - b)
  for (let start = 0; start < values.length; start += 1) {
    let end = start + 1
    while (end < values.length && values[end] === values[end - 1] + 1) end += 1
    const run = values.slice(start, end)
    if (run.length < 2) continue
    for (const value of run) {
      for (const card of byRank.get(value) ?? []) set.add(card.id)
    }
    start = end - 1
  }
}

function groupByRank(hand: Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>()
  for (const card of hand) {
    const list = map.get(card.rankValue)
    if (list) list.push(card)
    else map.set(card.rankValue, [card])
  }
  return map
}

function uniquePlayableValues(hand: Card[]): number[] {
  return [...new Set(hand.filter((card) => card.rankValue <= 12).map((card) => card.rankValue))].sort((a, b) => a - b)
}

function fallbackCombo(hand: Card[]): Combo {
  const card = [...hand].sort((a, b) => a.rankValue - b.rankValue || a.deckId - b.deckId || a.id.localeCompare(b.id))[0] ?? hand[0]
  return { type: 'single', cards: [card], primaryValue: card?.rankValue ?? 0, length: 1 }
}
