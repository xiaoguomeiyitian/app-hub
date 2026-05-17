import type { Card, CardTracker, Combo, ComboType, GameState, Player, Rank, SeatId, Suit, TributeState } from './types'

export const seatOrder = ['north', 'east', 'south', 'west'] as const satisfies readonly SeatId[]
export const seatLabels: Record<SeatId, string> = {
  north: '北家',
  east: '东家',
  south: '南家',
  west: '西家'
}
export const seatTeam: Record<SeatId, Player['team']> = {
  north: 'northSouth',
  south: 'northSouth',
  east: 'eastWest',
  west: 'eastWest'
}

// Bug #3: 可配置出牌时限
let playerTimeoutSec = 20

export function setPlayerTimeout(sec: number): void {
  playerTimeoutSec = sec
}

export function getTurnTimeoutMs(seat: SeatId): number {
  if (seat === 'south') return playerTimeoutSec * 1000
  return 3_000 + Math.floor(Math.random() * 2_001)
}

// ===== 牌点系统（R1.1） =====

/** 基础牌点顺序：2最小，A最大 */
export const baseRankOrder: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/** 获取牌点值（动态，依赖级牌） */
export function getRankValue(rank: Rank, levelRank: Rank): number {
  if (rank === 'BJ') return 100
  if (rank === 'SJ') return 99
  if (rank === levelRank) return 98  // 级牌 > A
  const idx = baseRankOrder.indexOf(rank)
  return idx >= 0 ? idx : 0  // 2=0, 3=1, ..., A=12
}

/** 用于 createDeck 的完整 Rank 列表（不含级牌动态调整） */
const allRanks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/** 静态 rankValueMap（兼容旧代码，以 '2' 为级牌时的默认值） */
export const rankValueMap: Record<Rank, number> = Object.fromEntries(
  allRanks.map(r => [r, getRankValue(r, '2')])
) as Record<Rank, number>
// 补充大小王
;(rankValueMap as any)['SJ'] = 99
;(rankValueMap as any)['BJ'] = 100

const suitLabels: Record<Exclude<Suit, 'joker'>, string> = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣'
}

// ===== 万能牌（R1.8） =====

export function isWildCard(card: Card, levelRank: Rank): boolean {
  return card.rank === levelRank && card.suit === 'heart'
}

// ===== 牌组创建 =====

export function createDeck(levelRank?: Rank): Card[] {
  const cards: Card[] = []
  let counter = 0
  const lv = levelRank ?? '2'

  for (const deckId of [1, 2] as const) {
    for (const suit of ['spade', 'heart', 'diamond', 'club'] as const) {
      for (const rank of allRanks) {
        cards.push(makeCard(++counter, deckId, suit, rank, lv))
      }
    }
    cards.push(makeCard(++counter, deckId, 'joker', 'SJ', lv))
    cards.push(makeCard(++counter, deckId, 'joker', 'BJ', lv))
  }

  return cards
}

function makeCard(id: number, deckId: 1 | 2, suit: Suit, rank: Rank, levelRank: Rank): Card {
  return {
    id: `${deckId}-${id}`,
    deckId,
    suit,
    rank,
    rankValue: getRankValue(rank, levelRank),
    label: formatCardLabel(suit, rank)
  }
}

function formatCardLabel(suit: Suit, rank: Rank): string {
  if (rank === 'SJ') return '小王'
  if (rank === 'BJ') return '大王'
  return `${suitLabels[suit as Exclude<Suit, 'joker'>]}${rank}`
}

export function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
}

export function sortHand(hand: Card[], levelRank?: Rank): void {
  const lv = levelRank ?? '2'
  hand.sort((a, b) => getRankValue(a.rank, lv) - getRankValue(b.rank, lv) || a.deckId - b.deckId || a.id.localeCompare(b.id))
}

export function createPlayers(): Record<SeatId, Player> {
  return {
    north: { id: 'north', name: seatLabels.north, team: seatTeam.north, hand: [], finished: false, finishAt: null },
    east: { id: 'east', name: seatLabels.east, team: seatTeam.east, hand: [], finished: false, finishAt: null },
    south: { id: 'south', name: seatLabels.south, team: seatTeam.south, hand: [], finished: false, finishAt: null },
    west: { id: 'west', name: seatLabels.west, team: seatTeam.west, hand: [], finished: false, finishAt: null }
  }
}

export function deal(deck: Card[], players: Record<SeatId, Player>, levelRank?: Rank): void {
  const lv = levelRank ?? '2'
  deck.forEach((card, index) => {
    const seat = seatOrder[index % seatOrder.length]
    players[seat].hand.push(card)
  })

  for (const seat of seatOrder) sortHand(players[seat].hand, lv)
}

export function findStarter(players: Record<SeatId, Player>): SeatId {
  for (const seat of seatOrder) {
    if (players[seat].hand.some((card) => card.rank === '3' && card.suit === 'spade')) {
      return seat
    }
  }
  return 'south'
}

// ===== 记牌器 =====

/** 双副牌各点数总数 */
const CARD_TOTALS: Record<string, number> = {
  '3': 8, '4': 8, '5': 8, '6': 8, '7': 8, '8': 8, '9': 8, '10': 8,
  'J': 8, 'Q': 8, 'K': 8, 'A': 8, '2': 8,
  'SJ': 2, 'BJ': 2
}

export function createTracker(): CardTracker {
  return {
    played: { '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, 'J': 0, 'Q': 0, 'K': 0, 'A': 0, 'SJ': 0, 'BJ': 0 },
    total: { ...CARD_TOTALS }
  }
}

/** 更新记牌器 */
export function updateTracker(tracker: CardTracker, cards: Card[]): void {
  for (const card of cards) {
    tracker.played[card.rank] = (tracker.played[card.rank] || 0) + 1
  }
}

// ===== 游戏初始化 =====

export function createInitialState(): GameState {
  const gameLevel: Rank = '2'
  const levelRank = gameLevel
  const players = createPlayers()
  const deck = createDeck(levelRank)
  shuffle(deck)
  deal(deck, players, levelRank)
  const starter = findStarter(players)

  return {
    phase: 'playing',
    round: 1,
    turn: starter,
    turnStartedAt: Date.now(),
    turnTimeoutMs: getTurnTimeoutMs(starter),
    openingStarter: starter,
    openingLeadCompleted: false,
    trick: {
      leaderSeat: starter,
      lastPlay: null,
      passes: 0
    },
    players,
    log: [`新局开始，双副牌共 ${deck.length} 张。`, `当前打 ${gameLevel}。`, `${seatLabels[starter]}先手。`],
    finishOrder: [],
    winnerTeam: null,
    tracker: createTracker(),
    dealingDone: true,
    gameLevel,
    levelRank,
    roundNumber: 1,
    tributeState: null,
    lastFinishOrder: [],
    aFailCount: { northSouth: 0, eastWest: 0 }
  }
}

// ===== 牌型检测核心 =====

function countByRank(cards: Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>()
  for (const card of cards) {
    const list = map.get(card.rankValue)
    if (list) list.push(card)
    else map.set(card.rankValue, [card])
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.deckId - b.deckId || a.id.localeCompare(b.id))
  }
  return map
}

function buildCombo(type: ComboType, cards: Card[], primaryValue: number, length?: number): Combo {
  return { type, cards, primaryValue, length: length ?? cards.length }
}

function isConsecutive(values: number[]): boolean {
  if (values.length < 2) return false
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] !== values[index - 1] + 1) return false
  }
  return true
}

// ===== 牌型优先级（R1.7） =====

export function comboPriority(combo: Combo): number {
  if (combo.type === 'rocket') return 100            // 四大天王
  if (combo.type === 'bomb' && combo.length >= 6) return 90 + combo.length  // 6张+炸弹
  if (combo.type === 'flushStraight') return 85      // 同花顺
  if (combo.type === 'bomb' && combo.length === 5) return 80  // 5张炸弹
  if (combo.type === 'bomb' && combo.length === 4) return 75  // 4张炸弹
  return 1  // 普通牌型
}

// ===== detectCombo（R1.3-R1.6 完整改造） =====

/**
 * 纯牌型检测（不含万能牌）
 */
function detectComboPure(cards: Card[]): Combo | null {
  if (cards.length === 0) return null

  const sorted = [...cards].sort((a, b) => a.rankValue - b.rankValue || a.deckId - b.deckId || a.id.localeCompare(b.id))
  const byRank = countByRank(sorted)
  const distinctValues = [...byRank.keys()].sort((a, b) => a - b)
  const onlyLowRanks = sorted.every((card) => card.rankValue <= 12) // <= A

  // 1. 四大天王（2BJ + 2SJ）— R1.5
  if (sorted.length === 4) {
    const bjCount = sorted.filter(c => c.rank === 'BJ').length
    const sjCount = sorted.filter(c => c.rank === 'SJ').length
    if (bjCount === 2 && sjCount === 2) {
      return buildCombo('rocket', sorted, 101, 4)
    }
  }

  // 2. 炸弹（4张+相同点数）— R1.6
  if (byRank.size === 1 && sorted.length >= 4) {
    return buildCombo('bomb', sorted, sorted[0].rankValue, sorted.length)
  }

  // 3. 同花顺（5-12张同花色顺子）— R1.4
  if (sorted.length >= 5 && sorted.length <= 12 && byRank.size === sorted.length && onlyLowRanks) {
    if (isConsecutive(distinctValues)) {
      const firstSuit = sorted[0].suit
      const isSameSuit = sorted.every(c => c.suit === firstSuit && c.suit !== 'joker')
      if (isSameSuit) {
        return buildCombo('flushStraight', sorted, distinctValues[distinctValues.length - 1], sorted.length)
      }
    }
  }

  // 4. 单张
  if (sorted.length === 1) {
    return buildCombo('single', sorted, sorted[0].rankValue, 1)
  }

  // 5. 对子
  if (sorted.length === 2 && byRank.size === 1) {
    return buildCombo('pair', sorted, sorted[0].rankValue, 2)
  }

  // 6. 三张
  if (sorted.length === 3 && byRank.size === 1) {
    return buildCombo('triple', sorted, sorted[0].rankValue, 3)
  }

  // 7. 三带对（5张：3同点+2同点）— R1.3
  if (sorted.length === 5 && byRank.size === 2) {
    const entries = [...byRank.entries()]
    const [v1, c1] = entries[0]
    const [v2, c2] = entries[1]
    if (c1.length === 3 && c2.length === 2) {
      return buildCombo('threePair', sorted, v1, 5)
    }
    if (c2.length === 3 && c1.length === 2) {
      return buildCombo('threePair', sorted, v2, 5)
    }
  }

  // 8. 顺子（5-12张连续，不含2和王）
  if (sorted.length >= 5 && onlyLowRanks && byRank.size === sorted.length) {
    if (isConsecutive(distinctValues)) {
      return buildCombo('straight', sorted, distinctValues[distinctValues.length - 1], sorted.length)
    }
  }

  // 9. 钢板/三连三（6张+：多组连续三张）
  if (sorted.length >= 6 && sorted.length % 3 === 0 && byRank.size === sorted.length / 3) {
    const counts = [...byRank.values()].map(list => list.length)
    if (counts.every(count => count === 3) && isConsecutive(distinctValues) && distinctValues.length >= 2 && onlyLowRanks) {
      return buildCombo('tripleStraight', sorted, distinctValues[distinctValues.length - 1], sorted.length)
    }
  }

  // 10. 连对（6张+：连续对子）
  if (sorted.length >= 6 && sorted.length % 2 === 0 && byRank.size === sorted.length / 2) {
    const counts = [...byRank.values()].map(list => list.length)
    if (counts.every(count => count === 2) && isConsecutive(distinctValues) && distinctValues.length >= 3 && onlyLowRanks) {
      return buildCombo('pairStraight', sorted, distinctValues[distinctValues.length - 1], sorted.length)
    }
  }

  return null
}

/**
 * 万能牌检测（R1.8）
 * 红心级牌可替代任意牌（不含王）参与牌型组合
 */
function detectComboWithWilds(allCards: Card[], wilds: Card[], levelRank: Rank): Combo | null {
  const normals = allCards.filter(c => !isWildCard(c, levelRank))
  const wildCount = wilds.length

  // 可能的替代点数（0-12 对应 2-A）
  const possibleValues = baseRankOrder.map((_, i) => i)

  let bestCombo: Combo | null = null

  function updateBest(combo: Combo | null) {
    if (!combo) return
    if (!bestCombo || comboPriority(combo) > comboPriority(bestCombo) ||
      (comboPriority(combo) === comboPriority(bestCombo) && combo.primaryValue > bestCombo.primaryValue)) {
      bestCombo = combo
    }
  }

  // 策略1：尝试组成炸弹（所有万能牌分配为同一点数）
  for (const val of possibleValues) {
    const existingCount = normals.filter(c => c.rankValue === val).length
    const totalNeeded = 4
    const needWilds = Math.max(0, totalNeeded - existingCount)
    if (needWilds <= wildCount && existingCount + wildCount >= totalNeeded) {
      // 可以组成炸弹，尝试不同张数
      for (let bombSize = Math.max(4, existingCount); bombSize <= existingCount + wildCount; bombSize++) {
        const bombCards = [...normals.filter(c => c.rankValue === val)]
        const extraWilds = bombSize - bombCards.length
        if (extraWilds > 0 && extraWilds <= wildCount) {
          bombCards.push(...wilds.slice(0, extraWilds))
          if (bombCards.length >= 4) {
            updateBest(buildCombo('bomb', bombCards, val, bombCards.length))
          }
        }
      }
    }
  }

  // 策略2：尝试组成三带对（5张）
  if (allCards.length === 5 && wildCount >= 1) {
    for (const tripleVal of possibleValues) {
      for (const pairVal of possibleValues) {
        if (tripleVal === pairVal && normals.filter(c => c.rankValue === tripleVal).length + wildCount < 5) continue
        const existingTriple = normals.filter(c => c.rankValue === tripleVal).length
        const existingPair = normals.filter(c => c.rankValue === pairVal).length
        const needForTriple = Math.max(0, 3 - existingTriple)
        const needForPair = Math.max(0, 2 - existingPair)
        if (needForTriple + needForPair <= wildCount) {
          updateBest(buildCombo('threePair', allCards, tripleVal, 5))
        }
      }
    }
  }

  // 策略3：尝试组成顺子/同花顺
  if (allCards.length >= 5 && allCards.length <= 12) {
    const len = allCards.length
    for (let start = 0; start <= 12 - len; start++) {
      const targetValues = Array.from({ length: len }, (_, i) => start + i)
      const normalValues = new Set(normals.map(c => c.rankValue))
      const needWildsForStraight = targetValues.filter(v => !normalValues.has(v)).length
      if (needWildsForStraight <= wildCount) {
        // 同花顺检查
        const suits = ['spade', 'heart', 'diamond', 'club'] as const
        for (const suit of suits) {
          const sameSuitNorms = normals.filter(c => c.suit === suit)
          const suitNormValues = new Set(sameSuitNorms.map(c => c.rankValue))
          const wildsForFlush = targetValues.filter(v => !suitNormValues.has(v)).length
          if (wildsForFlush <= wildCount) {
            updateBest(buildCombo('flushStraight', allCards, start + len - 1, len))
          }
        }
        // 普通顺子
        updateBest(buildCombo('straight', allCards, start + len - 1, len))
      }
    }
  }

  // 策略4：对子、三张
  if (allCards.length === 2 && wildCount >= 1) {
    const normalVal = normals[0]?.rankValue ?? 0
    updateBest(buildCombo('pair', allCards, normalVal, 2))
  }
  if (allCards.length === 3 && wildCount >= 1) {
    for (const val of possibleValues) {
      const existing = normals.filter(c => c.rankValue === val).length
      if (existing + wildCount >= 3) {
        updateBest(buildCombo('triple', allCards, val, 3))
        break
      }
    }
  }

  // 策略5：单张
  if (allCards.length === 1) {
    updateBest(buildCombo('single', allCards, allCards[0].rankValue, 1))
  }

  return bestCombo
}

/**
 * 主入口：牌型检测
 */
export function detectCombo(cards: Card[], levelRank?: Rank): Combo | null {
  if (cards.length === 0) return null

  const effectiveLevel = levelRank ?? '2'
  const wilds = cards.filter(c => isWildCard(c, effectiveLevel))

  if (wilds.length > 0) {
    return detectComboWithWilds(cards, wilds, effectiveLevel)
  }

  return detectComboPure(cards)
}

// ===== canBeat（R1.7 完整重写） =====

export function canBeat(candidate: Combo, current: Combo | null): boolean {
  if (!current) return true
  const cp = comboPriority(candidate)
  const op = comboPriority(current)
  if (cp !== op) return cp > op
  // 同优先级：必须同类型同长度
  if (candidate.type !== current.type) return false
  if (candidate.length !== current.length) return false
  return candidate.primaryValue > current.primaryValue
}

// ===== getAllCombos =====

function pickCardsByValues(hand: Card[], values: number[]): Card[] | null {
  const picked: Card[] = []
  const used = new Set<string>()
  for (const value of values) {
    const card = hand.find((item) => item.rankValue === value && !used.has(item.id))
    if (!card) return null
    picked.push(card)
    used.add(card.id)
  }
  return picked
}

function findStraights(hand: Card[]): Combo[] {
  const values = [...new Set(hand.filter((card) => card.rankValue <= 12).map((card) => card.rankValue))].sort((a, b) => a - b)
  const combos: Combo[] = []

  for (let start = 0; start < values.length; start += 1) {
    let end = start + 1
    while (end < values.length && values[end] === values[end - 1] + 1) end += 1
    const run = values.slice(start, end)
    for (let len = 5; len <= run.length; len += 1) {
      for (let offset = 0; offset <= run.length - len; offset += 1) {
        const segment = run.slice(offset, offset + len)
        const cards = pickCardsByValues(hand, segment)
        if (cards) combos.push(buildCombo('straight', cards, segment[segment.length - 1], len))
      }
    }
    start = end - 1
  }

  return combos
}

function findFlushStraights(hand: Card[]): Combo[] {
  const suits = ['spade', 'heart', 'diamond', 'club'] as const
  const combos: Combo[] = []

  for (const suit of suits) {
    const suitCards = hand.filter(c => c.suit === suit && c.rankValue <= 12)
    const values = [...new Set(suitCards.map(c => c.rankValue))].sort((a, b) => a - b)

    for (let start = 0; start < values.length; start += 1) {
      let end = start + 1
      while (end < values.length && values[end] === values[end - 1] + 1) end += 1
      const run = values.slice(start, end)
      for (let len = 5; len <= run.length; len += 1) {
        for (let offset = 0; offset <= run.length - len; offset += 1) {
          const segment = run.slice(offset, offset + len)
          const cards: Card[] = []
          const used = new Set<string>()
          for (const val of segment) {
            const card = suitCards.find(c => c.rankValue === val && !used.has(c.id))
            if (!card) { cards.length = 0; break }
            cards.push(card)
            used.add(card.id)
          }
          if (cards.length === len) {
            combos.push(buildCombo('flushStraight', cards, segment[segment.length - 1], len))
          }
        }
      }
      start = end - 1
    }
  }
  return combos
}

function findPairStraights(hand: Card[]): Combo[] {
  const byRank = countByRank(hand)
  const pairValues = [...byRank.entries()]
    .filter(([rankValue, cards]) => rankValue <= 12 && cards.length >= 2)
    .map(([rankValue]) => rankValue)
    .sort((a, b) => a - b)

  const combos: Combo[] = []
  for (let start = 0; start < pairValues.length; start += 1) {
    let end = start + 1
    while (end < pairValues.length && pairValues[end] === pairValues[end - 1] + 1) end += 1
    const run = pairValues.slice(start, end)
    for (let len = 3; len <= run.length; len += 1) {
      for (let offset = 0; offset <= run.length - len; offset += 1) {
        const segment = run.slice(offset, offset + len)
        const cards: Card[] = []
        for (const value of segment) {
          const pair = byRank.get(value)?.slice(0, 2)
          if (!pair || pair.length < 2) { cards.length = 0; break }
          cards.push(...pair)
        }
        if (cards.length === segment.length * 2) {
          combos.push(buildCombo('pairStraight', cards, segment[segment.length - 1], cards.length))
        }
      }
    }
    start = end - 1
  }

  return combos
}

function findTripleStraights(hand: Card[]): Combo[] {
  const byRank = countByRank(hand)
  const tripleValues = [...byRank.entries()]
    .filter(([rankValue, cards]) => rankValue <= 12 && cards.length >= 3)
    .map(([rankValue]) => rankValue)
    .sort((a, b) => a - b)

  const combos: Combo[] = []
  for (let start = 0; start < tripleValues.length; start += 1) {
    let end = start + 1
    while (end < tripleValues.length && tripleValues[end] === tripleValues[end - 1] + 1) end += 1
    const run = tripleValues.slice(start, end)
    for (let len = 2; len <= run.length; len += 1) {
      for (let offset = 0; offset <= run.length - len; offset += 1) {
        const segment = run.slice(offset, offset + len)
        const cards: Card[] = []
        for (const value of segment) {
          const triple = byRank.get(value)?.slice(0, 3)
          if (!triple || triple.length < 3) { cards.length = 0; break }
          cards.push(...triple)
        }
        if (cards.length === segment.length * 3) {
          combos.push(buildCombo('tripleStraight', cards, segment[segment.length - 1], cards.length))
        }
      }
    }
    start = end - 1
  }

  return combos
}

function dedupeCombos(combos: Combo[]): Combo[] {
  const seen = new Set<string>()
  const result: Combo[] = []
  for (const combo of combos) {
    const key = `${combo.type}:${combo.cards.map((card) => card.id).sort().join(',')}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(combo)
  }
  return result
}

function compareComboForAI(a: Combo, b: Combo): number {
  const priority: Record<ComboType, number> = {
    single: 1,
    pair: 2,
    triple: 3,
    threePair: 4,
    straight: 5,
    pairStraight: 6,
    tripleStraight: 7,
    flushStraight: 8,
    bomb: 9,
    rocket: 10
  }
  return priority[a.type] - priority[b.type] || a.length - b.length || a.primaryValue - b.primaryValue
}

/**
 * 生成所有可能的牌型（用于 AI 和提示）
 */
export function getAllCombos(hand: Card[], _levelRank?: Rank): Combo[] {
  const combos: Combo[] = []
  const byRank = countByRank(hand)

  // 1. 单张
  for (const card of hand) {
    combos.push(buildCombo('single', [card], card.rankValue, 1))
  }

  // 2. 对子、三张、炸弹（含多张炸弹）
  for (const [rankValue, cards] of byRank.entries()) {
    if (cards.length >= 2) combos.push(buildCombo('pair', cards.slice(0, 2), rankValue, 2))
    if (cards.length >= 3) combos.push(buildCombo('triple', cards.slice(0, 3), rankValue, 3))
    if (cards.length >= 4) {
      for (let n = 4; n <= cards.length; n++) {
        combos.push(buildCombo('bomb', cards.slice(0, n), rankValue, n))
      }
    }
  }

  // 3. 三带对
  for (const [tripleVal, tripleCards] of byRank.entries()) {
    if (tripleCards.length < 3) continue
    for (const [pairVal, pairCards] of byRank.entries()) {
      if (pairVal === tripleVal) continue
      if (pairCards.length < 2) continue
      const cards = [...tripleCards.slice(0, 3), ...pairCards.slice(0, 2)]
      combos.push(buildCombo('threePair', cards, tripleVal, 5))
    }
  }

  // 4. 四大天王
  const bigJokers = hand.filter(c => c.rank === 'BJ')
  const smallJokers = hand.filter(c => c.rank === 'SJ')
  if (bigJokers.length >= 2 && smallJokers.length >= 2) {
    combos.push(buildCombo('rocket', [bigJokers[0], bigJokers[1], smallJokers[0], smallJokers[1]], 101, 4))
  }

  // 5. 顺子 + 同花顺
  combos.push(...findStraights(hand))
  combos.push(...findFlushStraights(hand))

  // 6. 钢板/三连三
  combos.push(...findTripleStraights(hand))

  // 7. 连对
  combos.push(...findPairStraights(hand))

  return dedupeCombos(combos).sort(compareComboForAI)
}

// ===== 首出校验 =====

export function isOpeningLeadValid(state: GameState, combo: Combo): boolean {
  if (state.openingLeadCompleted) return true
  const openingCard = state.players[state.openingStarter].hand.some((card) => card.rank === '3' && card.suit === 'spade')
  if (!openingCard) return true
  return combo.cards.some((card) => card.rank === '3' && card.suit === 'spade')
}

// ===== 手牌操作 =====

export function removeCardsFromHand(hand: Card[], cards: Card[]): void {
  const ids = new Set(cards.map((card) => card.id))
  for (let index = hand.length - 1; index >= 0; index -= 1) {
    if (ids.has(hand[index].id)) hand.splice(index, 1)
  }
}

export function nextActiveSeat(state: GameState, fromSeat: SeatId): SeatId {
  const startIndex = seatOrder.indexOf(fromSeat)
  for (let step = 1; step <= seatOrder.length; step += 1) {
    const seat = seatOrder[(startIndex + step) % seatOrder.length]
    if (!state.players[seat].finished) return seat
  }
  return fromSeat
}

export function activeSeatCount(state: GameState): number {
  return seatOrder.filter((seat) => !state.players[seat].finished).length
}

export function isTeamCompleted(state: GameState, team: Player['team']): boolean {
  return seatOrder.filter((seat) => seatTeam[seat] === team).every((seat) => state.players[seat].finished)
}

export function finalizeIfNeeded(state: GameState): boolean {
  if (state.phase === 'finished') return true
  if (isTeamCompleted(state, 'northSouth')) {
    state.phase = 'finished'
    state.winnerTeam = 'northSouth'
    state.finishOrder = [...state.finishOrder]
    // 补全 finishOrder（未出完的按顺序追加）
    for (const seat of seatOrder) {
      if (!state.finishOrder.includes(seat)) state.finishOrder.push(seat)
    }
    state.log.unshift('南北队胜利。')
    return true
  }
  if (isTeamCompleted(state, 'eastWest')) {
    state.phase = 'finished'
    state.winnerTeam = 'eastWest'
    for (const seat of seatOrder) {
      if (!state.finishOrder.includes(seat)) state.finishOrder.push(seat)
    }
    state.log.unshift('东西队胜利。')
    return true
  }
  return false
}

// ===== 升级系统（R2.2） =====

const LEVELS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

export function calculateLevelUp(finishOrder: SeatId[], winnerTeam: 'northSouth' | 'eastWest'): number {
  const teamSeats = winnerTeam === 'northSouth' ? ['north', 'south'] : ['east', 'west']
  const teamRanks = finishOrder
    .map((seat, index) => ({ seat, rank: index + 1 }))
    .filter(r => teamSeats.includes(r.seat))
    .sort((a, b) => a.rank - b.rank)

  if (teamRanks.length < 2) return 1
  const secondRank = teamRanks[1].rank
  if (secondRank === 2) return 3  // 双下（头+二）
  if (secondRank === 3) return 2  // 头+三
  return 1                        // 头+末
}

export function advanceLevel(currentLevel: Rank, steps: number): Rank {
  const currentIndex = LEVELS.indexOf(currentLevel)
  if (currentIndex < 0) return currentLevel
  return LEVELS[Math.min(currentIndex + steps, LEVELS.length - 1)] ?? 'A'
}

// ===== 过A判定（R2.3） =====

export function checkGameA(
  finishOrder: SeatId[],
  winnerTeam: 'northSouth' | 'eastWest',
  state: GameState
): { over: boolean; reason: string } {
  if (state.gameLevel !== 'A') return { over: false, reason: '' }

  const teamSeats = winnerTeam === 'northSouth' ? ['north', 'south'] : ['east', 'west']
  const teamRanks = finishOrder
    .map((seat, index) => ({ seat, rank: index + 1 }))
    .filter(r => teamSeats.includes(r.seat))
    .sort((a, b) => a.rank - b.rank)

  const hasFirst = teamRanks.length > 0 && teamRanks[0].rank === 1
  const partnerNotLast = teamRanks.length < 2 || teamRanks[1].rank !== 4

  if (hasFirst && partnerNotLast) {
    return { over: true, reason: `${winnerTeam === 'northSouth' ? '南北' : '东西'}队过A获胜！` }
  }

  state.aFailCount[winnerTeam]++
  if (state.aFailCount[winnerTeam] >= 3) {
    state.gameLevel = '2'
    state.levelRank = '2'
    state.aFailCount[winnerTeam] = 0
    return { over: false, reason: '打A三次失败，回退到2！' }
  }

  return { over: false, reason: `打A失败（${state.aFailCount[winnerTeam]}/3），继续打A` }
}

// ===== 贡牌系统（R2.4-R2.7） =====

export function selectTributeCard(hand: Card[], levelRank: Rank): Card | null {
  // 排除红心级牌和级牌（不可进贡）
  const eligible = hand.filter(c => !isWildCard(c, levelRank) && c.rank !== levelRank)
  if (eligible.length === 0) {
    // 只有级牌，选非红心的
    const nonWild = hand.filter(c => !isWildCard(c, levelRank))
    if (nonWild.length === 0) return hand[0] ?? null
    return [...nonWild].sort((a, b) => b.rankValue - a.rankValue || b.deckId - a.deckId)[0]
  }
  // 按 rankValue 降序，取最大的
  return [...eligible].sort((a, b) => b.rankValue - a.rankValue || b.deckId - a.deckId)[0]
}

export function selectReturnCard(hand: Card[]): Card | null {
  // 选 ≤10 的最小牌
  const eligible = hand.filter(c => c.rankValue <= getRankValue('10', '2'))
  if (eligible.length === 0) {
    return [...hand].sort((a, b) => a.rankValue - b.rankValue)[0] ?? null
  }
  return [...eligible].sort((a, b) => a.rankValue - b.rankValue)[0]
}

export function canAntiTribute(hand: Card[]): boolean {
  return hand.filter(c => c.rank === 'BJ').length >= 2
}

export function calculateTribute(finishOrder: SeatId[], players: Record<SeatId, Player>, levelRank: Rank): TributeState | null {
  if (finishOrder.length < 2) return null

  const first = finishOrder[0]

  // 首局不贡牌（由调用方判断）
  // 双下情况
  const winnerTeam = seatTeam[first]
  const loserSeats = finishOrder.filter(s => seatTeam[s] !== winnerTeam)

  if (loserSeats.length === 2) {
    // 双贡
    const canAnti1 = canAntiTribute(players[loserSeats[0]].hand)
    const canAnti2 = canAntiTribute(players[loserSeats[1]].hand)
    const antiTributed = canAnti1 && canAnti2

    if (antiTributed) {
      return {
        phase: 'idle',
        type: 'idle',
        tributers: loserSeats.map(s => ({ seat: s, card: null, canAntiTribute: true })),
        receivers: finishOrder.filter(s => seatTeam[s] === winnerTeam).map(s => ({ seat: s, receivedCard: null, returnCard: null })),
        antiTributed: true
      }
    }

    // 选择进贡牌
    const receiverSeats = finishOrder.filter(s => seatTeam[s] === winnerTeam)
    const tributers = loserSeats.map(s => ({
      seat: s,
      card: selectTributeCard(players[s].hand, levelRank),
      canAntiTribute: canAntiTribute(players[s].hand)
    }))
    const receivers = receiverSeats.map(s => ({
      seat: s,
      receivedCard: null as Card | null,
      returnCard: null as Card | null
    }))

    return { phase: 'pending_tribute', type: 'double', tributers, receivers, antiTributed: false }
  }

  // 单贡
  const lastSeat = finishOrder[finishOrder.length - 1]
  const canAnti = canAntiTribute(players[lastSeat].hand)

  if (canAnti) {
    return {
      phase: 'idle',
      type: 'idle',
      tributers: [{ seat: lastSeat, card: null, canAntiTribute: true }],
      receivers: [{ seat: first, receivedCard: null, returnCard: null }],
      antiTributed: true
    }
  }

  const tributeCard = selectTributeCard(players[lastSeat].hand, levelRank)
  return {
    phase: 'pending_tribute',
    type: 'single',
    tributers: [{ seat: lastSeat, card: tributeCard, canAntiTribute: false }],
    receivers: [{ seat: first, receivedCard: null, returnCard: null }],
    antiTributed: false
  }
}

/** 自动执行贡牌（AI 自动完成） */
export function executeTribute(state: GameState): void {
  const ts = state.tributeState
  if (!ts || ts.phase === 'idle') return

  if (ts.phase === 'pending_tribute') {
    for (const tributer of ts.tributers) {
      if (tributer.card) {
        // 从手牌移除贡牌
        removeCardsFromHand(state.players[tributer.seat].hand, [tributer.card])
        // 找到对应的接收方
        const receiverIdx = ts.tributers.indexOf(tributer) % ts.receivers.length
        ts.receivers[receiverIdx].receivedCard = tributer.card
        state.log.unshift(`${seatLabels[tributer.seat]}进贡：${tributer.card.label}。`)
      }
    }
    // 接收方将贡牌加入手牌
    for (const receiver of ts.receivers) {
      if (receiver.receivedCard) {
        state.players[receiver.seat].hand.push(receiver.receivedCard)
        sortHand(state.players[receiver.seat].hand, state.levelRank)
      }
    }
    ts.phase = 'pending_return'
  }

  if (ts.phase === 'pending_return') {
    for (const receiver of ts.receivers) {
      const returnCard = selectReturnCard(state.players[receiver.seat].hand)
      if (returnCard) {
        removeCardsFromHand(state.players[receiver.seat].hand, [returnCard])
        // 找到对应的进贡方
        const tributerIdx = ts.receivers.indexOf(receiver) % ts.tributers.length
        state.players[ts.tributers[tributerIdx].seat].hand.push(returnCard)
        sortHand(state.players[ts.tributers[tributerIdx].seat].hand, state.levelRank)
        receiver.returnCard = returnCard
        state.log.unshift(`${seatLabels[receiver.seat]}还牌：${returnCard.label}给${seatLabels[ts.tributers[tributerIdx].seat]}。`)
      }
    }
    ts.phase = 'tribute_done'
  }
}

/** 贡牌后确定首出人 */
export function getTributeStarter(finishOrder: SeatId[], tributeState: TributeState | null): SeatId {
  if (!tributeState || tributeState.antiTributed || tributeState.phase === 'idle') {
    // 抗贡/首局：上局上游先出
    return finishOrder[0] ?? 'south'
  }
  if (tributeState.type === 'double') {
    // 双贡：上游的搭档先出
    const winner = finishOrder[0]
    const partner = seatOrder.find(s => s !== winner && seatTeam[s] === seatTeam[winner]) ?? 'south'
    return partner
  }
  // 单贡：进贡方先出
  return tributeState.tributers[0]?.seat ?? 'south'
}

// ===== 创建下一局（R2.1） =====

export function createNextRound(prevState: GameState, finishOrder: SeatId[]): GameState {
  const winnerTeam = prevState.winnerTeam ?? 'northSouth'

  // 计算升级
  const levelUp = calculateLevelUp(finishOrder, winnerTeam)
  const newLevel = advanceLevel(prevState.gameLevel, levelUp)
  const newRoundNumber = prevState.roundNumber + 1

  // 创建新牌组
  const players = createPlayers()
  const deck = createDeck(newLevel)
  shuffle(deck)
  deal(deck, players, newLevel)

  // 计算贡牌（首局跳过）
  const tributeState = prevState.roundNumber === 0 ? null : calculateTribute(finishOrder, players, newLevel)
  const needsTribute = tributeState && tributeState.phase !== 'idle' && !tributeState.antiTributed

  // 如果需要贡牌，先自动执行
  const tempState: GameState = {
    ...prevState,
    phase: 'tribute',
    players,
    gameLevel: newLevel,
    levelRank: newLevel,
    roundNumber: newRoundNumber,
    tributeState,
    lastFinishOrder: finishOrder
  }

  if (needsTribute) {
    executeTribute(tempState)
  }

  // 确定首出人
  const starter = needsTribute
    ? getTributeStarter(finishOrder, tempState.tributeState)
    : findStarter(players)

  return {
    phase: 'playing',
    round: prevState.round + 1,
    turn: starter,
    turnStartedAt: Date.now(),
    turnTimeoutMs: getTurnTimeoutMs(starter),
    openingStarter: starter,
    openingLeadCompleted: false,
    trick: { leaderSeat: starter, lastPlay: null, passes: 0 },
    players,
    log: [`第 ${newRoundNumber} 副牌，当前打 ${newLevel}。`, `${seatLabels[starter]}先手。`],
    finishOrder: [],
    winnerTeam: null,
    tracker: createTracker(),
    dealingDone: true,
    gameLevel: newLevel,
    levelRank: newLevel,
    roundNumber: newRoundNumber,
    tributeState: needsTribute ? tempState.tributeState : null,
    lastFinishOrder: finishOrder,
    aFailCount: { ...prevState.aFailCount }
  }
}

// ===== 报牌（R2.9） =====

export function getReportCount(seat: SeatId, state: GameState): number {
  return state.players[seat].hand.length
}

export function shouldReportCards(seat: SeatId, state: GameState): boolean {
  return state.players[seat].hand.length <= 10 && !state.players[seat].finished
}
