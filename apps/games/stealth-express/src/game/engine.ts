// ===== 核心引擎（平滑移动 + 自动交互） =====

import type {
  GameState, MapData, Player, Monster, Item, Projectile, FloatingText, Pos, MonsterType, Particle
} from './types'
import { MONSTER_EMOJIS } from './types'
import { generateMap, getFloorPositions, pickRandomPositions } from './map'

let itemIdCounter = 0
let monsterIdCounter = 0
function nextItemId(): string { return `item_${++itemIdCounter}` }
function nextMonsterId(): string { return `mon_${++monsterIdCounter}` }

// ===== 物品生成 =====
const ITEM_TEMPLATES = [
  { name: '普通包裹', rarity: 'white' as const, size: 1, value: 10, emoji: '📦' },
  { name: '食品箱', rarity: 'white' as const, size: 1, value: 12, emoji: '🥡' },
  { name: '优质零件', rarity: 'green' as const, size: 1, value: 30, emoji: '⚙️' },
  { name: '电子元件', rarity: 'green' as const, size: 1, value: 35, emoji: '💾' },
  { name: '精密仪器', rarity: 'blue' as const, size: 2, value: 80, emoji: '🔬' },
  { name: '稀有矿石', rarity: 'blue' as const, size: 2, value: 90, emoji: '💎' },
  { name: '古董花瓶', rarity: 'purple' as const, size: 2, value: 200, emoji: '🏺' },
  { name: '传说宝箱', rarity: 'gold' as const, size: 3, value: 500, emoji: '👑' },
]

function generatePickups(count: number, positions: Pos[]): Item[] {
  const items: Item[] = []
  for (let i = 0; i < Math.min(count, positions.length); i++) {
    const r = Math.random()
    let t: typeof ITEM_TEMPLATES[0]
    if (r < 0.50) t = ITEM_TEMPLATES[0]
    else if (r < 0.60) t = ITEM_TEMPLATES[1]
    else if (r < 0.75) t = ITEM_TEMPLATES[2]
    else if (r < 0.85) t = ITEM_TEMPLATES[3]
    else if (r < 0.92) t = ITEM_TEMPLATES[4]
    else if (r < 0.96) t = ITEM_TEMPLATES[5]
    else if (r < 0.99) t = ITEM_TEMPLATES[6]
    else t = ITEM_TEMPLATES[7]
    if (t.rarity === 'white' && Math.random() < 0.5) t = ITEM_TEMPLATES[1]
    items.push({
      id: nextItemId(), name: t.name, rarity: t.rarity,
      size: t.size, value: t.value, emoji: t.emoji,
      position: positions[i],
    })
  }
  return items
}

// ===== 怪物生成 =====
function createMonster(type: MonsterType, pos: Pos, floor: number = 1): Monster {
  const stats: Record<MonsterType, { hp: number; attack: number; viewRange: number; cooldown: number }> = {
    patrol: { hp: 30, attack: 8, viewRange: 4, cooldown: 800 },
    shadow: { hp: 20, attack: 6, viewRange: 5, cooldown: 1200 },
    hunter: { hp: 40, attack: 10, viewRange: 6, cooldown: 600 },
    guard: { hp: 50, attack: 12, viewRange: 3, cooldown: 1000 },
    boss: { hp: 100, attack: 15, viewRange: 5, cooldown: 500 },
  }
  const s = stats[type]
  // SE-5: 第一层怪物减弱
  const viewRange = floor === 1 ? 3 : s.viewRange
  const attack = floor === 1 ? 5 : s.attack
  return {
    id: nextMonsterId(), type, position: { ...pos },
    hp: s.hp, maxHp: s.hp, attack, viewRange,
    facing: Math.random() * Math.PI * 2, state: 'patrol',
    patrolPath: [{ ...pos }, { x: pos.x + 2, y: pos.y }],
    patrolIndex: 0, emoji: MONSTER_EMOJIS[type],
    attackCooldown: s.cooldown, lastAttackTime: 0,
    chargeTimer: 0, chargeTarget: null,
    firstSightTime: 0,
  }
}

function generateMonsters(floor: number, positions: Pos[]): Monster[] {
  const count = Math.min(2 + floor, 8)
  const chosen = pickRandomPositions(positions, count, [])
  return chosen.map((pos, i) => {
    const type: MonsterType = i === 0 && floor >= 3 && floor % 3 === 0 ? 'boss' : 'patrol'
    return createMonster(type, pos, floor)
  })
}

// ===== 视野计算 =====
export function updateVisibility(state: GameState): void {
  const { map, player } = state
  const range = 6
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      map.tiles[y][x].visible = false
    }
  }
  for (let angle = 0; angle < 360; angle += 2) {
    const rad = (angle * Math.PI) / 180
    const dx = Math.cos(rad)
    const dy = Math.sin(rad)
    for (let dist = 0; dist <= range; dist += 0.5) {
      const x = Math.round(player.x + dx * dist)
      const y = Math.round(player.y + dy * dist)
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) break
      map.tiles[y][x].visible = true
      map.tiles[y][x].explored = true
      if (map.tiles[y][x].type === 'wall') break
    }
  }
}

// ===== 碰撞检测 =====
function isWalkable(map: MapData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false
  return map.tiles[Math.floor(y)][Math.floor(x)]?.type !== 'wall'
}

function hasMonsterAt(monsters: Monster[], x: number, y: number): Monster | null {
  return monsters.find(m => m.hp > 0 && m.position.x === Math.round(x) && m.position.y === Math.round(y)) ?? null
}

// ===== 浮字 =====
function addFloatingText(state: GameState, x: number, y: number, text: string, color: string): void {
  state.floatingTexts.push({ x: Math.round(x), y: Math.round(y), text, color, life: 45 })
}

// ===== 粒子系统 =====
export function spawnParticles(state: GameState, x: number, y: number, type: 'kill' | 'pickup' | 'dust'): void {
  const count = type === 'kill' ? 15 : type === 'pickup' ? 8 : 3
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 3
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: type === 'kill' ? '#ff4444' : type === 'pickup' ? '#FFD700' : '#888',
      life: type === 'kill' ? 0.6 : 0.3,
      maxLife: type === 'kill' ? 0.6 : 0.3,
      size: 2 + Math.random() * 3,
    })
  }
}

export function updateParticles(state: GameState, dt: number): void {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 3 * dt // 重力
    p.life -= dt
    if (p.life <= 0) state.particles.splice(i, 1)
  }
}

// ===== 屏幕抖动 =====
export function triggerShake(state: GameState, intensity: number = 5, duration: number = 0.2): void {
  state.shakeIntensity = intensity
  state.shakeDuration = duration
}

export function updateShake(state: GameState, dt: number): void {
  if (state.shakeDuration > 0) {
    state.shakeDuration -= dt
    state.shakeIntensity *= 0.95
    if (state.shakeDuration <= 0) {
      state.shakeIntensity = 0
    }
  }
}

// ===== 自动交互检测 =====
export function updateAutoInteract(state: GameState): void {
  const { player, pickups, map } = state
  const px = Math.round(player.x)
  const py = Math.round(player.y)

  player.nearInteractable = null

  // 检查脚下或相邻格子的物品
  for (const item of pickups) {
    const dist = Math.abs(item.position.x - player.x) + Math.abs(item.position.y - player.y)
    if (dist < 1.2) {
      player.nearInteractable = 'item'
      // 走到物品上自动拾取
      if (dist < 0.6) {
        autoPickup(state, item)
        return
      }
      break
    }
  }

  // 检查出口
  const tile = map.tiles[py]?.[px]
  if (tile?.type === 'exit') {
    player.nearInteractable = 'exit'
    // 在出口上自动撤离
    state.phase = 'settlement'
    return
  }
}

function autoPickup(state: GameState, item: Item): void {
  const { player } = state
  const usedSpace = player.inventory.reduce((s, i) => s + i.size, 0)
  if (usedSpace + item.size <= player.maxInventory) {
    player.inventory.push(item)
    const idx = state.pickups.indexOf(item)
    if (idx >= 0) state.pickups.splice(idx, 1)
    state.message = `获得 ${item.emoji} ${item.name}`
    state.messageTimer = 90
    spawnParticles(state, item.position.x, item.position.y, 'pickup')
  } else {
    state.message = '背包已满！'
    state.messageTimer = 90
  }
}

// ===== 玩家移动（平滑连续） =====
export function movePlayer(state: GameState, dx: number, dy: number, dt: number): void {
  const { player, map } = state
  if (dx === 0 && dy === 0) return

  // 更新面朝方向
  player.facing = { dx, dy }

  // 归一化对角移动
  const len = Math.sqrt(dx * dx + dy * dy)
  const ndx = dx / len
  const ndy = dy / len

  // 速度（格/秒 → 格/帧）
  const speed = player.speed * (dt / 1000)
  let nx = player.x + ndx * speed
  let ny = player.y + ndy * speed

  // 碰撞检测（检查目标位置的四个角）
  const margin = 0.15
  const canMoveX = isWalkable(map, nx + margin * Math.sign(ndx), player.y) &&
                   isWalkable(map, nx + margin * Math.sign(ndx), player.y + margin) &&
                   isWalkable(map, nx + margin * Math.sign(ndx), player.y - margin)
  const canMoveY = isWalkable(map, player.x, ny + margin * Math.sign(ndy)) &&
                   isWalkable(map, player.x + margin, ny + margin * Math.sign(ndy)) &&
                   isWalkable(map, player.x - margin, ny + margin * Math.sign(ndy))

  if (canMoveX) player.x = nx
  if (canMoveY) player.y = ny

  // 边界限制
  player.x = Math.max(0.5, Math.min(map.width - 0.5, player.x))
  player.y = Math.max(0.5, Math.min(map.height - 0.5, player.y))
}

// ===== 玩家攻击 =====
export function playerAttack(state: GameState): void {
  const { player, projectiles } = state
  const { dx, dy } = player.facing
  const px = Math.round(player.x)
  const py = Math.round(player.y)

  // 近战：攻击面前 1 格
  const tx = px + dx
  const ty = py + dy
  const target = state.monsters.find(
    m => m.hp > 0 && Math.round(m.position.x) === tx && Math.round(m.position.y) === ty
  )

  if (target) {
    const dmg = player.attack + Math.floor(Math.random() * 5)
    target.hp -= dmg
    addFloatingText(state, target.position.x, target.position.y, `-${dmg}`, '#ff6b6b')
    if (target.hp <= 0) {
      target.hp = 0
      addFloatingText(state, target.position.x, target.position.y, '击杀!', '#FFD700')
      spawnParticles(state, target.position.x, target.position.y, 'kill')
      triggerShake(state, 4, 0.15)
      player.energy = Math.min(player.maxEnergy, player.energy + 10)
      if (Math.random() < 0.5) {
        state.pickups.push({
          id: nextItemId(), name: '掉落包裹',
          rarity: Math.random() < 0.3 ? 'green' : 'white',
          size: 1, value: Math.random() < 0.3 ? 30 : 10,
          emoji: '📦', position: { ...target.position },
        })
      }
    }
  } else {
    // 远程子弹
    projectiles.push({
      x: player.x, y: player.y,
      dx, dy, damage: player.attack,
      fromPlayer: true, speed: 8, moveTimer: 0, life: 5,
    })
  }
}

// ===== 玩家闪避 =====
export function playerDodge(state: GameState): boolean {
  const { player, map } = state
  if (player.dodgeCooldown > 0 || player.dodging) return false

  const { dx, dy } = player.facing
  const dist = 2
  let nx = player.x + dx * dist
  let ny = player.y + dy * dist

  // 碰墙则停在墙前
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const cx = player.x + dx * dist * t
    const cy = player.y + dy * dist * t
    if (!isWalkable(map, cx, cy)) {
      nx = player.x + dx * dist * ((i - 1) / steps)
      ny = player.y + dy * dist * ((i - 1) / steps)
      break
    }
  }

  player.x = Math.max(0.5, Math.min(map.width - 0.5, nx))
  player.y = Math.max(0.5, Math.min(map.height - 0.5, ny))
  player.dodging = true
  player.dodgeTimer = 300
  player.dodgeCooldown = 2000
  return true
}

// ===== 怪物 AI =====
export function updateMonsters(state: GameState, dt: number): void {
  const { monsters, player, map, projectiles } = state
  const pIntX = Math.round(player.x)
  const pIntY = Math.round(player.y)

  // SE-3: 缓冲期内怪物不追击不攻击
  if (state.graceTimer > 0) return

  for (const m of monsters) {
    if (m.hp <= 0) continue
    const dist = Math.abs(m.position.x - player.x) + Math.abs(m.position.y - player.y)

    // SE-2: 修正视野检查 — 检查怪物位置是否在玩家视野内
    if (dist <= m.viewRange && map.tiles[Math.round(m.position.y)]?.[Math.round(m.position.x)]?.visible) {
      if (m.state !== 'chase') {
        // SE-4: 首次切换到 chase 时记录时间
        m.firstSightTime = performance.now()
      }
      m.state = 'chase'
    } else if (m.state === 'chase' && dist > m.viewRange + 3) {
      m.state = 'patrol'
    }

    if (m.state === 'chase') {
      m.facing = Math.atan2(player.y - m.position.y, player.x - m.position.x)
      const dx = Math.sign(pIntX - m.position.x)
      const dy = Math.sign(pIntY - m.position.y)

      // 怪物移动（每帧概率移动，降低速度）
      if (Math.random() < 0.03) {
        if (Math.random() < 0.5 && dx !== 0) {
          const nx = m.position.x + dx
          if (isWalkable(map, nx, m.position.y) && !hasMonsterAt(monsters.filter(o => o !== m), nx, m.position.y)) {
            m.position.x = nx
          }
        } else if (dy !== 0) {
          const ny = m.position.y + dy
          if (isWalkable(map, m.position.x, ny) && !hasMonsterAt(monsters.filter(o => o !== m), m.position.x, ny)) {
            m.position.y = ny
          }
        }
      }

      // 攻击
      const now = performance.now()
      if (dist <= 1.2 && now - m.lastAttackTime > m.attackCooldown) {
        if (!player.dodging) {
          const dmg = m.attack + Math.floor(Math.random() * 3)
          player.hp -= dmg
          addFloatingText(state, player.x, player.y, `-${dmg}`, '#e74c3c')
          triggerShake(state, 3, 0.1)
          if (player.hp <= 0) { player.hp = 0; state.phase = 'dead'; return }
        }
        m.lastAttackTime = now
      } else if (dist > 1.2 && dist <= m.viewRange && now - m.lastAttackTime > m.attackCooldown) {
        // SE-4: 远程攻击首次延迟 1.5 秒
        if (now - m.firstSightTime > 1500) {
          const adx = Math.sign(pIntX - m.position.x)
          const ady = Math.sign(pIntY - m.position.y)
          if (adx !== 0 || ady !== 0) {
            projectiles.push({
              x: m.position.x, y: m.position.y,
              dx: adx, dy: ady, damage: m.attack,
              fromPlayer: false, speed: 5, moveTimer: 0, life: m.type === 'hunter' ? 5 : 3,
            })
            m.lastAttackTime = now
          }
        }
      }
    } else {
      // 巡逻
      if (m.patrolPath.length > 1 && Math.random() < 0.01) {
        m.patrolIndex = (m.patrolIndex + 1) % m.patrolPath.length
        const target = m.patrolPath[m.patrolIndex]
        const dx = Math.sign(target.x - m.position.x)
        const dy = Math.sign(target.y - m.position.y)
        if (dx !== 0 && isWalkable(map, m.position.x + dx, m.position.y)) {
          m.position.x += dx
        } else if (dy !== 0 && isWalkable(map, m.position.x, m.position.y + dy)) {
          m.position.y += dy
        }
      }
    }
  }
}

// ===== 更新子弹 =====
export function updateProjectiles(state: GameState, dt: number): void {
  const { projectiles, map, player, monsters } = state

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]
    p.moveTimer += dt
    const interval = 1000 / p.speed

    while (p.moveTimer >= interval) {
      p.moveTimer -= interval
      p.x += p.dx
      p.y += p.dy
      p.life--

      const ix = Math.round(p.x)
      const iy = Math.round(p.y)
      if (!isWalkable(map, p.x, p.y)) { projectiles.splice(i, 1); break }

      if (p.fromPlayer) {
        const hit = monsters.find(m => m.hp > 0 && Math.round(m.position.x) === ix && Math.round(m.position.y) === iy)
        if (hit) {
          hit.hp -= p.damage
          addFloatingText(state, hit.position.x, hit.position.y, `-${p.damage}`, '#ff6b6b')
          if (hit.hp <= 0) {
            hit.hp = 0
            addFloatingText(state, hit.position.x, hit.position.y, '击杀!', '#FFD700')
            spawnParticles(state, hit.position.x, hit.position.y, 'kill')
            triggerShake(state, 4, 0.15)
            player.energy = Math.min(player.maxEnergy, player.energy + 10)
            if (Math.random() < 0.5) {
              state.pickups.push({
                id: nextItemId(), name: '掉落包裹',
                rarity: Math.random() < 0.3 ? 'green' : 'white',
                size: 1, value: Math.random() < 0.3 ? 30 : 10,
                emoji: '📦', position: { ...hit.position },
              })
            }
          }
          projectiles.splice(i, 1); break
        }
      }

      if (!p.fromPlayer && !player.dodging) {
        if (ix === Math.round(player.x) && iy === Math.round(player.y)) {
          player.hp -= p.damage
          addFloatingText(state, player.x, player.y, `-${p.damage}`, '#e74c3c')
          triggerShake(state, 3, 0.1)
          if (player.hp <= 0) { player.hp = 0; state.phase = 'dead' }
          projectiles.splice(i, 1); break
        }
      }

      if (p.life <= 0) { projectiles.splice(i, 1); break }
    }
  }
}

// ===== 更新闪避状态 =====
export function updateDodgeState(state: GameState, dt: number): void {
  const { player } = state
  if (player.dodging) {
    player.dodgeTimer -= dt
    if (player.dodgeTimer <= 0) player.dodging = false
  }
  if (player.dodgeCooldown > 0) {
    player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt)
  }
}

// ===== 更新浮字 =====
export function updateFloatingTexts(state: GameState): void {
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    state.floatingTexts[i].life--
    if (state.floatingTexts[i].life <= 0) state.floatingTexts.splice(i, 1)
  }
}

// ===== 创建初始状态 =====
export function createInitialState(floor: number = 1): GameState {
  const map = generateMap(floor)
  const floorPositions = getFloorPositions(map)
  const exclude = [map.entry, map.exit]

  // SE-1: 入口安全区 — 排除入口周围 8 格内所有位置
  const safeZoneRadius = 8
  for (const pos of floorPositions) {
    const dist = Math.abs(pos.x - map.entry.x) + Math.abs(pos.y - map.entry.y)
    if (dist <= safeZoneRadius) {
      exclude.push(pos)
    }
  }

  const itemCount = 3 + floor * 2
  const itemPositions = pickRandomPositions(floorPositions, itemCount, exclude)
  const pickups = generatePickups(itemCount, itemPositions)

  const monsterPositions = pickRandomPositions(floorPositions, 2 + floor, [...exclude, ...itemPositions])
  const monsters = generateMonsters(floor, monsterPositions)

  const player: Player = {
    x: map.entry.x,
    y: map.entry.y,
    facing: { dx: 0, dy: 1 },
    hp: 100, maxHp: 100,
    attack: 10,
    energy: 100, maxEnergy: 100,
    inventory: [], maxInventory: 8,
    gold: 0,
    dodging: false, dodgeTimer: 0, dodgeCooldown: 0,
    speed: 3.5, // 格/秒（降低了速度）
    nearInteractable: null,
  }

  return {
    phase: 'dungeon',
    floor, map, player, monsters, pickups,
    projectiles: [], floatingTexts: [],
    particles: [],
    shakeIntensity: 0, shakeDuration: 0,
    lastMoveTime: 0, moveCooldown: 0,
    message: '', messageTimer: 0,
    graceTimer: 3000, // SE-3: 3 秒启动缓冲期
  }
}
