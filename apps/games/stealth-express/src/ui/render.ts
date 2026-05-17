// Canvas render with all 10 visual upgrades
import type { GameState, Particle } from '../game/types'
import { RARITY_COLORS, RARITY_NAMES } from '../game/types'

const MONSTER_COLORS: Record<string, { body: string; glow: string }> = {
  patrol: { body: '#e74c3c', glow: '#ff6b6b' },
  shadow: { body: '#9b59b6', glow: '#c39bd3' },
  hunter: { body: '#e67e22', glow: '#f0b27a' },
  guard: { body: '#95a5a6', glow: '#d5d8dc' },
  boss: { body: '#c0392b', glow: '#e74c3c' },
}

export function calcTileSize(w: number, h: number, mw: number, mh: number): number {
  return Math.floor(Math.min(w / mw, h / mh))
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

// 1. Map textures
function drawFloor(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, seed: number, visible: boolean): void {
  const grad = ctx.createLinearGradient(x, y, x + ts, y + ts)
  if (visible) {
    grad.addColorStop(0, '#3a3a5c')
    grad.addColorStop(1, '#2e2e4a')
  } else {
    grad.addColorStop(0, '#1a1a2e')
    grad.addColorStop(1, '#16162a')
  }
  ctx.fillStyle = grad
  ctx.fillRect(x, y, ts, ts)
  if (seededRandom(seed) > 0.7 && visible) {
    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    ctx.fillRect(x + ts * 0.3, y + ts * 0.3, ts * 0.4, ts * 0.4)
  }
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, visible: boolean): void {
  ctx.fillStyle = visible ? '#1a1a2e' : '#0e0e1e'
  ctx.fillRect(x, y, ts, ts)
  if (!visible) return
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y + ts / 2)
  ctx.lineTo(x + ts, y + ts / 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + ts / 4, y)
  ctx.lineTo(x + ts / 4, y + ts / 2)
  ctx.moveTo(x + ts * 3 / 4, y + ts / 2)
  ctx.lineTo(x + ts * 3 / 4, y + ts)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fillRect(x, y, ts, 2)
}

// 3. Self-drawn player
function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState, ts: number): void {
  const p = state.player
  const cx = p.x * ts + ts / 2
  const cy = p.y * ts + ts / 2
  const r = ts * 0.35

  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + r * 1.2, r * 0.8, r * 0.3, 0, 0, Math.PI * 2)
  ctx.fill()

  if (p.dodging) ctx.globalAlpha = 0.4
  const bodyGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r)
  bodyGrad.addColorStop(0, '#64B5F6')
  bodyGrad.addColorStop(1, '#1565C0')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  const fx = p.facing.dx, fy = p.facing.dy
  if (fx !== 0 || fy !== 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx + fx * r * 0.5, cy + fy * r * 0.5)
    ctx.lineTo(cx + fx * r * 1.5, cy + fy * r * 1.5)
    ctx.stroke()
  }

  if (p.dodging) {
    ctx.strokeStyle = '#2196F3'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  const barW = ts * 0.8, barH = 4
  const barX = cx - barW / 2, barY = cy - r - 10
  ctx.fillStyle = '#333'
  roundRect(ctx, barX, barY, barW, barH, 2)
  ctx.fill()
  const hpR = p.hp / p.maxHp
  ctx.fillStyle = hpR > 0.3 ? '#4CAF50' : '#e74c3c'
  roundRect(ctx, barX, barY, barW * hpR, barH, 2)
  ctx.fill()
}

// 4. Self-drawn monsters
function drawMonster(ctx: CanvasRenderingContext2D, m: any, ts: number): void {
  const cx = m.position.x * ts + ts / 2
  const cy = m.position.y * ts + ts / 2
  const r = ts * 0.3
  const colors = MONSTER_COLORS[m.type] || MONSTER_COLORS.patrol

  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + r * 1.2, r * 0.7, r * 0.25, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = colors.body
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx + r, cy)
  ctx.lineTo(cx, cy + r)
  ctx.lineTo(cx - r, cy)
  ctx.closePath()
  ctx.fill()

  ctx.save()
  ctx.shadowColor = colors.glow
  ctx.shadowBlur = 8
  ctx.fill()
  ctx.restore()

  if (m.state === 'chase') {
    ctx.fillStyle = '#ff4444'
    ctx.font = `bold ${ts * 0.5}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', cx, cy - r - 8)
  }

  const barW = ts * 0.8, barH = 3
  ctx.fillStyle = '#333'
  ctx.fillRect(cx - barW / 2, cy + r + 2, barW, barH)
  ctx.fillStyle = '#e74c3c'
  ctx.fillRect(cx - barW / 2, cy + r + 2, barW * (m.hp / m.maxHp), barH)
}

// 5. Self-drawn items
function drawPickup(ctx: CanvasRenderingContext2D, item: any, ts: number, time: number): void {
  const cx = item.position.x * ts + ts / 2
  const cy = item.position.y * ts + ts / 2
  const bob = Math.sin(time * 3 + item.position.x * 2 + item.position.y) * 3

  const glowColors: Record<string, string> = {
    white: 'rgba(200,200,200,0.15)', green: 'rgba(76,175,80,0.2)',
    blue: 'rgba(33,150,243,0.2)', purple: 'rgba(156,39,176,0.2)',
    gold: 'rgba(255,215,0,0.3)',
  }
  ctx.fillStyle = glowColors[item.rarity] || glowColors.white
  ctx.beginPath()
  ctx.arc(cx, cy + bob, ts * 0.4, 0, Math.PI * 2)
  ctx.fill()

  const rColors: Record<string, string> = {
    white: '#ccc', green: '#4CAF50', blue: '#2196F3', purple: '#9C27B0', gold: '#FFD700',
  }
  const col = rColors[item.rarity] || '#ccc'
  ctx.fillStyle = col
  ctx.beginPath()
  ctx.arc(cx, cy + bob, ts * 0.22, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = col
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy + bob, ts * 0.28, 0, Math.PI * 2)
  ctx.stroke()
}

// 6. Redesigned HUD
function renderHUD(ctx: CanvasRenderingContext2D, state: GameState): void {
  const w = ctx.canvas.width
  const p = state.player

  ctx.fillStyle = 'rgba(10,10,30,0.85)'
  ctx.fillRect(0, 0, w, 42)
  ctx.strokeStyle = 'rgba(100,180,255,0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 42)
  ctx.lineTo(w, 42)
  ctx.stroke()

  const y = 26
  const hpBarW = 120, hpBarH = 12, hpBarX = 12
  ctx.fillStyle = '#1a1a3e'
  roundRect(ctx, hpBarX, y - hpBarH / 2, hpBarW, hpBarH, 4)
  ctx.fill()
  const hpR = p.hp / p.maxHp
  ctx.fillStyle = hpR > 0.5 ? '#4CAF50' : hpR > 0.25 ? '#FFC107' : '#e74c3c'
  roundRect(ctx, hpBarX, y - hpBarH / 2, hpBarW * hpR, hpBarH, 4)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${p.hp}/${p.maxHp}`, hpBarX + hpBarW / 2, y)

  const epX = hpBarX + hpBarW + 15
  ctx.fillStyle = '#1a1a3e'
  roundRect(ctx, epX, y - hpBarH / 2, 80, hpBarH, 4)
  ctx.fill()
  ctx.fillStyle = '#2196F3'
  roundRect(ctx, epX, y - hpBarH / 2, 80 * (p.energy / p.maxEnergy), hpBarH, 4)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillText(`⚡${p.energy}`, epX + 40, y)

  ctx.fillStyle = '#f5c542'
  ctx.font = '13px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`🏰 第${state.floor}层`, epX + 100, y)
  const used = p.inventory.reduce((s: number, i: any) => s + i.size, 0)
  ctx.fillStyle = '#8df0a6'
  ctx.fillText(`🎒 ${used}/${p.maxInventory}`, epX + 185, y)
  ctx.fillStyle = '#FFD700'
  ctx.fillText(`💰${p.gold}`, epX + 260, y)

  if (p.dodgeCooldown > 0) {
    const dcx = w - 35, dcy = ctx.canvas.height - 45
    ctx.strokeStyle = 'rgba(50,50,80,0.8)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(dcx, dcy, 16, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = '#2196F3'
    const prog = 1 - p.dodgeCooldown / 2000
    ctx.beginPath()
    ctx.arc(dcx, dcy, 16, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('💨', dcx, dcy)
  }

  if (p.nearInteractable) {
    const tipY = ctx.canvas.height - 55
    const tipText = p.nearInteractable === 'item' ? '📦 靠近自动拾取' : '⬆️ 到达出口自动撤离'
    const tipColor = p.nearInteractable === 'item' ? 'rgba(255,215,0,0.9)' : 'rgba(76,175,80,0.9)'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    const tw = ctx.measureText(tipText).width + 24
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    roundRect(ctx, (w - tw) / 2, tipY - 12, tw, 26, 8)
    ctx.fill()
    ctx.fillStyle = tipColor
    ctx.fillText(tipText, w / 2, tipY + 1)
  }

  if (state.messageTimer > 0 && state.message) {
    const msgY = ctx.canvas.height - 30
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    const tw = ctx.measureText(state.message).width + 30
    roundRect(ctx, (w - tw) / 2, msgY - 12, tw, 28, 6)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(state.message, w / 2, msgY + 2)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('WASD 移动 | Space 攻击 | Shift 闪避', w - 10, ctx.canvas.height - 8)
}

// 7. Particles
function renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[], ts: number, ox: number, oy: number): void {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife)
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(ox + p.x * ts + ts / 2, oy + p.y * ts + ts / 2, p.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// 8. Screen shake
function applyShake(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.shakeIntensity > 0 && state.shakeDuration > 0) {
    const dx = (Math.random() - 0.5) * state.shakeIntensity * 2
    const dy = (Math.random() - 0.5) * state.shakeIntensity * 2
    ctx.translate(dx, dy)
  }
}

// 9. Minimap
function renderMinimap(ctx: CanvasRenderingContext2D, state: GameState): void {
  const map = state.map
  const s = 3
  const mmW = map.width * s, mmH = map.height * s
  const mmX = ctx.canvas.width - mmW - 10, mmY = 50

  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4)
  ctx.strokeStyle = 'rgba(100,180,255,0.3)'
  ctx.lineWidth = 1
  ctx.strokeRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4)

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.tiles[y][x]
      if (!tile.explored) continue
      ctx.fillStyle = tile.type === 'wall' ? (tile.visible ? '#555' : '#333') : (tile.visible ? '#777' : '#555')
      ctx.fillRect(mmX + x * s, mmY + y * s, s, s)
    }
  }

  ctx.fillStyle = '#4CAF50'
  ctx.fillRect(mmX + map.exit.x * s, mmY + map.exit.y * s, s * 2, s * 2)

  for (const m of state.monsters) {
    if (m.hp <= 0) continue
    if (map.tiles[m.position.y]?.[m.position.x]?.visible) {
      ctx.fillStyle = '#e74c3c'
      ctx.fillRect(mmX + m.position.x * s, mmY + m.position.y * s, s, s)
    }
  }

  ctx.fillStyle = '#64B5F6'
  ctx.fillRect(mmX + state.player.x * s - 1, mmY + state.player.y * s - 1, s + 2, s + 2)
}

// Main render
export function renderGame(ctx: CanvasRenderingContext2D, state: GameState): void {
  const canvas = ctx.canvas
  const { map, player, monsters, pickups, projectiles, floatingTexts, particles } = state
  const ts = calcTileSize(canvas.width, canvas.height, map.width, map.height)
  const time = performance.now() / 1000

  ctx.save()
  applyShake(ctx, state)

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const ox = Math.floor((canvas.width - map.width * ts) / 2)
  const oy = Math.floor((canvas.height - map.height * ts) / 2)
  ctx.save()
  ctx.translate(ox, oy)

  // 1. Map tiles with textures
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.tiles[y][x]
      const px = x * ts, py = y * ts
      const seed = y * map.width + x + state.floor * 1000

      if (!tile.explored) {
        ctx.fillStyle = '#000'
        ctx.fillRect(px, py, ts, ts)
      } else if (tile.type === 'wall') {
        drawWall(ctx, px, py, ts, tile.visible)
      } else {
        drawFloor(ctx, px, py, ts, seed, tile.visible)
      }

      if ((tile.visible || tile.explored) && (tile.type === 'exit' || tile.type === 'entry')) {
        const fs = Math.max(ts * 0.6, 10)
        ctx.font = `${fs}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (tile.type === 'exit') {
          ctx.fillStyle = '#4CAF50'
          ctx.fillText('⬆', px + ts / 2, py + ts / 2)
        } else {
          ctx.fillStyle = '#64B5F6'
          ctx.fillText('⬇', px + ts / 2, py + ts / 2)
        }
      }
    }
  }

  // 5. Items with float animation
  for (const item of pickups) {
    if (map.tiles[item.position.y]?.[item.position.x]?.visible) {
      drawPickup(ctx, item, ts, time)
    }
  }

  // 4. Monsters
  for (const m of monsters) {
    if (m.hp <= 0) continue
    if (map.tiles[m.position.y]?.[m.position.x]?.visible) {
      drawMonster(ctx, m, ts)
    }
  }

  // Projectiles
  for (const p of projectiles) {
    const bx = p.x * ts + ts / 2, by = p.y * ts + ts / 2
    ctx.beginPath()
    ctx.arc(bx, by, ts * 0.12, 0, Math.PI * 2)
    ctx.fillStyle = p.fromPlayer ? '#FFD700' : '#ff4444'
    ctx.fill()
    ctx.save()
    ctx.shadowColor = p.fromPlayer ? '#FFD700' : '#ff4444'
    ctx.shadowBlur = 6
    ctx.fill()
    ctx.restore()
  }

  // 3. Player
  drawPlayer(ctx, state, ts)

  // Floating texts
  for (const ft of floatingTexts) {
    const progress = 1 - ft.life / 45
    ctx.globalAlpha = 1 - progress
    ctx.font = `bold ${Math.max(ts * 0.45, 11)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = ft.color
    try { ctx.fillText(ft.text, ft.x * ts + ts / 2, ft.y * ts + ts / 2 - progress * ts * 1.5) } catch { /* */ }
    ctx.globalAlpha = 1
  }

  // 7. Particles
  renderParticles(ctx, particles, ts, ox, oy)

  ctx.restore() // translate

  // 2. Lighting (dark overlay with radial gradient around player)
  const pcx = ox + player.x * ts + ts / 2
  const pcy = oy + player.y * ts + ts / 2
  const radius = 5 * ts
  const grad = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, radius)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.6, 'rgba(0,0,0,0.3)')
  grad.addColorStop(1, 'rgba(0,0,0,0.85)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 6. HUD
  renderHUD(ctx, state)

  // 9. Minimap
  renderMinimap(ctx, state)

  ctx.restore() // shake
}

// 10. Title screen
export function renderTitle(ctx: CanvasRenderingContext2D): void {
  const w = ctx.canvas.width, h = ctx.canvas.height
  const time = performance.now() / 1000

  const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
  bgGrad.addColorStop(0, '#0a0a2e')
  bgGrad.addColorStop(1, '#1a1a4e')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 30; i++) {
    const x = (Math.sin(time * 0.3 + i * 1.7) * 0.5 + 0.5) * w
    const y = (Math.cos(time * 0.2 + i * 2.3) * 0.5 + 0.5) * h
    const r = 1 + Math.sin(time * 2 + i) * 0.5
    ctx.fillStyle = `rgba(100,180,255,${0.1 + Math.sin(time + i) * 0.05})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 42px sans-serif'
  ctx.fillText('🚀 搜打撤 📦', w / 2, h * 0.3)

  ctx.fillStyle = 'rgba(100,180,255,0.7)'
  ctx.font = '16px sans-serif'
  ctx.fillText('E X T R A C T I O N', w / 2, h * 0.3 + 40)

  ctx.fillStyle = '#666'
  ctx.font = '13px sans-serif'
  ctx.fillText('搜打撤 Roguelike · 即时战斗', w / 2, h * 0.3 + 70)

  const btnY = h * 0.55
  ctx.save()
  ctx.shadowColor = 'rgba(78,205,196,0.4)'
  ctx.shadowBlur = 15
  ctx.fillStyle = '#4ecdc4'
  roundRect(ctx, w / 2 - 90, btnY - 24, 180, 48, 12)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#0a0a2e'
  ctx.font = 'bold 18px sans-serif'
  ctx.fillText('开始冒险', w / 2, btnY + 6)
}

export function isTitleClick(mx: number, my: number, w: number, h: number): boolean {
  const btnY = h * 0.55
  return mx > w / 2 - 90 && mx < w / 2 + 90 && my > btnY - 24 && my < btnY + 24
}

export function renderDead(ctx: CanvasRenderingContext2D, state: GameState): void {
  const w = ctx.canvas.width, h = ctx.canvas.height
  ctx.fillStyle = 'rgba(10,0,0,0.92)'
  ctx.fillRect(0, 0, w, h)
  const cx = w / 2, cy = h / 2

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#e74c3c'
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText('💀 任务失败', cx, cy - 60)

  ctx.font = '16px sans-serif'
  ctx.fillStyle = '#ccc'
  const inv = state.player.inventory
  if (inv.length > 0) {
    ctx.fillText('失去的货物：', cx, cy - 15)
    inv.slice(0, 5).forEach((item: any, i: number) => {
      ctx.fillStyle = (RARITY_COLORS as any)[item.rarity] || '#ccc'
      ctx.fillText(`${item.emoji} ${item.name}`, cx, cy + 15 + i * 24)
    })
  } else {
    ctx.fillText('背包为空，未损失货物', cx, cy - 15)
  }

  ctx.fillStyle = '#e74c3c'
  roundRect(ctx, cx - 90, cy + 130, 180, 44, 10)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 15px sans-serif'
  ctx.fillText('返回基地', cx, cy + 152)
}

export function isDeadClick(mx: number, my: number, w: number, h: number): boolean {
  const cy = h / 2
  return mx > w / 2 - 90 && mx < w / 2 + 90 && my > cy + 130 && my < cy + 174
}

export function renderSettlement(ctx: CanvasRenderingContext2D, state: GameState): void {
  const w = ctx.canvas.width, h = ctx.canvas.height
  ctx.fillStyle = 'rgba(0,10,0,0.92)'
  ctx.fillRect(0, 0, w, h)
  const cx = w / 2, cy = h / 2

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#4CAF50'
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText('🎉 撤离成功！', cx, cy - 80)

  ctx.font = '16px sans-serif'
  ctx.fillStyle = '#ccc'
  const inv = state.player.inventory
  const totalValue = inv.reduce((s: number, i: any) => s + i.value, 0)
  ctx.fillText(`货物：${inv.length} 件 | 总价值：💰 ${totalValue} 金币`, cx, cy - 30)

  inv.slice(0, 6).forEach((item: any, i: number) => {
    ctx.fillStyle = (RARITY_COLORS as any)[item.rarity] || '#ccc'
    ctx.fillText(`${item.emoji} ${item.name} (${((RARITY_NAMES as any)[item.rarity] || '')}) — 💰${item.value}`, cx, cy + 10 + i * 24)
  })

  if (inv.length > 0) {
    state.player.gold += totalValue
    state.player.inventory = []
  }

  ctx.fillStyle = '#4CAF50'
  roundRect(ctx, cx - 90, cy + 160, 180, 44, 10)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 15px sans-serif'
  ctx.fillText('返回基地', cx, cy + 182)
}

export function isSettlementClick(mx: number, my: number, w: number, h: number): boolean {
  const cy = h / 2
  return mx > w / 2 - 90 && mx < w / 2 + 90 && my > cy + 160 && my < cy + 204
}
