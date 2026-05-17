export type SeatId = 'north' | 'east' | 'south' | 'west'

export type GamePhase = 'ready' | 'dealing' | 'tribute' | 'playing' | 'finished'

export type Suit = 'spade' | 'heart' | 'diamond' | 'club' | 'joker'

export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
  | 'SJ'
  | 'BJ'

export type ComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'threePair'
  | 'bomb'
  | 'rocket'
  | 'straight'
  | 'flushStraight'
  | 'pairStraight'
  | 'tripleStraight'

export interface Card {
  id: string
  deckId: 1 | 2
  suit: Suit
  rank: Rank
  rankValue: number
  label: string
}

export interface Player {
  id: SeatId
  name: string
  team: 'northSouth' | 'eastWest'
  hand: Card[]
  finished: boolean
  finishAt: number | null
}

export interface Combo {
  type: ComboType
  cards: Card[]
  primaryValue: number
  length: number
}

export interface TrickState {
  leaderSeat: SeatId | null
  lastPlay: Combo | null
  passes: number
}

export interface CardTracker {
  /** 各点数已出数量 */
  played: Record<string, number>
  /** 各点数总数（双副牌） */
  total: Record<string, number>
}

/** 贡牌阶段 */
export type TributePhase = 'idle' | 'pending_tribute' | 'pending_return' | 'tribute_done'

export interface TributeState {
  phase: TributePhase
  type: 'single' | 'double' | 'idle'
  tributers: {
    seat: SeatId
    card: Card | null
    canAntiTribute: boolean
  }[]
  receivers: {
    seat: SeatId
    receivedCard: Card | null
    returnCard: Card | null
  }[]
  antiTributed: boolean
}

export interface GameState {
  phase: GamePhase
  round: number
  turn: SeatId
  turnStartedAt: number
  turnTimeoutMs: number
  openingStarter: SeatId
  openingLeadCompleted: boolean
  trick: TrickState
  players: Record<SeatId, Player>
  log: string[]
  finishOrder: SeatId[]
  winnerTeam: Player['team'] | null
  /** 记牌器数据 */
  tracker: CardTracker
  /** 发牌动画状态 */
  dealingDone: boolean
  /** 当前级数（'2'~'A'） */
  gameLevel: Rank
  /** 当前级牌（= gameLevel） */
  levelRank: Rank
  /** 第几副牌 */
  roundNumber: number
  /** 贡牌状态 */
  tributeState: TributeState | null
  /** 上局出完顺序 */
  lastFinishOrder: SeatId[]
  /** 打A失败次数 */
  aFailCount: Record<'northSouth' | 'eastWest', number>
}
