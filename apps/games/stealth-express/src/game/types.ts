// ===== 类型定义 =====

export type TileType = 'floor' | 'wall' | 'door' | 'exit' | 'entry'
export type MonsterType = 'patrol' | 'shadow' | 'hunter' | 'guard' | 'boss'
export type ItemRarity = 'white' | 'green' | 'blue' | 'purple' | 'gold'
export type GamePhase = 'title' | 'dungeon' | 'dead' | 'settlement'

export interface Pos {
  x: number
  y: number
}

export interface Tile {
  type: TileType
  explored: boolean
  visible: boolean
}

export interface MapData {
  width: number
  height: number
  tiles: Tile[][]
  entry: Pos
  exit: Pos
}

export interface Item {
  id: string
  name: string
  rarity: ItemRarity
  size: number
  value: number
  emoji: string
  position: Pos
}

export interface Projectile {
  x: number
  y: number
  dx: number
  dy: number
  damage: number
  fromPlayer: boolean
  speed: number // 格/秒
  moveTimer: number
  life: number // 剩余飞行距离（格）
}

export interface Monster {
  id: string
  type: MonsterType
  position: Pos
  hp: number
  maxHp: number
  attack: number
  viewRange: number
  facing: number // 弧度
  state: 'patrol' | 'chase' | 'idle'
  patrolPath: Pos[]
  patrolIndex: number
  emoji: string
  attackCooldown: number // ms
  lastAttackTime: number
  chargeTimer: number // 冲撞计时器
  chargeTarget: Pos | null
  firstSightTime: number // SE-4: 首次发现玩家的时间戳
}

export interface Player {
  x: number  // 浮点坐标（格子单位）
  y: number
  facing: { dx: number; dy: number }
  hp: number
  maxHp: number
  attack: number
  energy: number
  maxEnergy: number
  inventory: Item[]
  maxInventory: number
  gold: number
  dodging: boolean
  dodgeTimer: number
  dodgeCooldown: number
  speed: number // 格/秒
  nearInteractable: 'item' | 'exit' | null // 附近可交互物
}

export interface FloatingText {
  x: number
  y: number
  text: string
  color: string
  life: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  life: number
  maxLife: number
  size: number
}

export interface GameState {
  phase: GamePhase
  floor: number
  map: MapData
  player: Player
  monsters: Monster[]
  pickups: Item[]
  projectiles: Projectile[]
  floatingTexts: FloatingText[]
  particles: Particle[]
  shakeIntensity: number
  shakeDuration: number
  lastMoveTime: number
  moveCooldown: number
  message: string
  messageTimer: number
  graceTimer: number // SE-3: 启动缓冲期（毫秒）
}

export const RARITY_COLORS: Record<ItemRarity, string> = {
  white: '#ccc',
  green: '#4CAF50',
  blue: '#2196F3',
  purple: '#9C27B0',
  gold: '#FFD700',
}

export const RARITY_NAMES: Record<ItemRarity, string> = {
  white: '普通',
  green: '优质',
  blue: '稀有',
  purple: '史诗',
  gold: '传说',
}

export const MONSTER_EMOJIS: Record<MonsterType, string> = {
  patrol: '👁️',
  shadow: '👾',
  hunter: '🐺',
  guard: '🛡️',
  boss: '👹',
}

export const MONSTER_NAMES: Record<MonsterType, string> = {
  patrol: '巡逻兵',
  shadow: '暗影',
  hunter: '猎手',
  guard: '守卫',
  boss: 'Boss',
}
