// ===== 入口 + 游戏循环（平滑移动 + 自动交互 + 触控） =====

import './style.css'
import { InputManager } from './input/input-manager'
import {
  createInitialState, movePlayer, playerAttack, playerDodge,
  updateVisibility, updateMonsters, updateProjectiles,
  updateDodgeState, updateFloatingTexts, updateAutoInteract,
  updateParticles, updateShake
} from './game/engine'
import {
  renderGame, renderTitle, renderDead, renderSettlement,
  isTitleClick, isDeadClick, isSettlementClick
} from './ui/render'
import type { GameState } from './game/types'

const app = document.querySelector<HTMLDivElement>('#app')!

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

function createTouchControls(): void {
  const wrapper = document.createElement('div')
  wrapper.id = 'touch-controls'
  wrapper.innerHTML = `
    <div class="joystick-zone">
      <div class="joystick-base" id="joystick-base">
        <div class="joystick-stick" id="joystick-stick"></div>
      </div>
    </div>
    <div class="btn-zone">
      <button class="touch-btn btn-attack" id="btn-attack">⚔️</button>
      <button class="touch-btn btn-dodge" id="btn-dodge">💨</button>
    </div>
  `
  app.appendChild(wrapper)
}

app.innerHTML = `<canvas id="game-canvas"></canvas>`
if (isTouchDevice()) createTouchControls()

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!
const ctx = canvas.getContext('2d')!

function resizeCanvas(): void {
  canvas.width = app.clientWidth
  canvas.height = app.clientHeight
}
resizeCanvas()
window.addEventListener('resize', resizeCanvas)

const input = new InputManager()
let state: GameState | null = null
let lastTime = 0

// ===== 虚拟摇杆 =====
function setupJoystick(): void {
  const base = document.getElementById('joystick-base')
  const stick = document.getElementById('joystick-stick')
  if (!base || !stick) return
  let active = false
  const maxR = 35
  const _base = base, _stick = stick

  function handleMove(cx: number, cy: number): void {
    const r = _base.getBoundingClientRect()
    let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2)
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR }
    _stick.style.transform = `translate(${dx}px, ${dy}px)`
    const th = maxR * 0.25
    input.setJoystickDirection(
      Math.abs(dx) > th ? Math.sign(dx) : 0,
      Math.abs(dy) > th ? Math.sign(dy) : 0
    )
  }

  function handleEnd(): void {
    active = false; _stick.style.transform = ''; input.setJoystickDirection(0, 0)
  }

  _base.addEventListener('touchstart', (e) => {
    e.preventDefault(); active = true; handleMove(e.touches[0].clientX, e.touches[0].clientY)
  }, { passive: false })
  document.addEventListener('touchmove', (e) => {
    if (active) handleMove(e.touches[0].clientX, e.touches[0].clientY)
  })
  document.addEventListener('touchend', () => { if (active) handleEnd() })
}

function setupButtons(): void {
  function bind(id: string, fn: () => void): void {
    const el = document.getElementById(id)
    if (!el) return
    el.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation(); fn(); el.classList.add('pressed')
    }, { passive: false })
    el.addEventListener('touchend', (e) => { e.preventDefault(); el.classList.remove('pressed') }, { passive: false })
  }
  bind('btn-attack', () => input.triggerAttack())
  bind('btn-dodge', () => input.triggerDodge())
}

if (isTouchDevice()) { setupJoystick(); setupButtons() }

// ===== 游戏循环 =====
function gameLoop(time: number): void {
  const dt = Math.min(lastTime === 0 ? 16 : time - lastTime, 50) // 限制最大 dt
  lastTime = time

  if (state === null) {
    renderTitle(ctx)
  } else {
    switch (state.phase) {
      case 'dungeon':
        handleDungeonInput(dt)
        if (state.phase === 'dungeon') {
          // SE-3: 递减缓冲期
          if (state.graceTimer > 0) state.graceTimer = Math.max(0, state.graceTimer - dt)
          updateAutoInteract(state)
          updateVisibility(state)
          updateMonsters(state, dt)
          updateProjectiles(state, dt)
          updateDodgeState(state, dt)
          updateFloatingTexts(state)
          updateParticles(state, dt / 1000)
          updateShake(state, dt / 1000)
          if (state.messageTimer > 0) state.messageTimer--
        }
        if (state) { renderGame(ctx, state) }
        break
      case 'dead':
        renderDead(ctx, state)
        break
      case 'settlement':
        renderSettlement(ctx, state)
        break
    }
  }
  requestAnimationFrame(gameLoop)
}

let attackCooldown = 0

function handleDungeonInput(dt: number): void {
  if (!state || state.phase !== 'dungeon') return

  // 持续移动（平滑）
  const dir = input.getDirection()
  movePlayer(state, dir.dx, dir.dy, dt)

  // 攻击
  attackCooldown -= dt
  if (input.shouldAttack() && attackCooldown <= 0) {
    playerAttack(state)
    attackCooldown = 250
  }

  // 闪避
  if (input.shouldDodge()) playerDodge(state)
}

// ===== 点击 =====
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left, my = e.clientY - rect.top

  if (state === null) {
    if (isTitleClick(mx, my, canvas.width, canvas.height)) state = createInitialState(1)
  } else {
    if (state && state.phase === 'dead' && isDeadClick(mx, my, canvas.width, canvas.height)) { state = null; return }
    if (state && state.phase === 'settlement' && isSettlementClick(mx, my, canvas.width, canvas.height)) { state = null; return }
  }
})

requestAnimationFrame(gameLoop)
