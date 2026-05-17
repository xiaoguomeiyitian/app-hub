import './style.css'
import type { Card, GameState, SeatId, Combo } from './game/types'
import { canBeat, createInitialState, createNextRound, detectCombo, seatLabels, calculateLevelUp, advanceLevel, setPlayerTimeout } from './game/engine'
import { chooseHintCombo, chooseRecommendedCombo } from './game/ai'
import { playHumanCards, passHumanTurn, resolveTimedTurn } from './game/turn'
import { OnlineClient } from './online/OnlineClient'
import { OnlineLobby } from './ui/OnlineLobby'

const app = document.querySelector<HTMLDivElement>('#app')!

// ===== 游戏画面入口 =====

const state: GameState = createInitialState()
let timer: number | null = null
let selectedCardIds = new Set<string>()
let statusMessage = ''
let selectionHint = ''
// 追踪各方位出牌，用于四方位独立显示
let lastPlayBySeat: Record<SeatId, Combo | null> = { south: null, north: null, east: null, west: null }
let prevLastPlay: Combo | null = null
// 记牌器面板可见性
let trackerVisible = false
// 音效静音状态
let soundMuted = false
let isDealing = false
let shellReady = false
// 过牌浮字状态
let passFloats: { seat: SeatId; text: string; nonce: number }[] = []
let passFloatNonce = 0
// 烟花效果
let fireworksCanvas: HTMLCanvasElement | null = null
let fireworksAnimId: number | null = null
// Phase 28: AI 速度控制
type AiSpeed = 'turbo' | 'fast' | 'normal' | 'slow'
type AiDifficulty = 'easy' | 'normal' | 'hard'
let aiSpeed: AiSpeed = 'normal'
let aiDifficulty: AiDifficulty = 'normal'
let fastForward = false
let turnTimeoutSec = 20
const AI_SPEED_MS: Record<AiSpeed, number> = { turbo: 0, fast: 300, normal: 800, slow: 1500 }
// Phase 1: 入口大厅级数显示
let entryGameLevel: string = '2'

// Phase 13: 主题系统
type ThemeId = 'classic' | 'gold' | 'blue' | 'dark'
let currentTheme: ThemeId = 'classic'

// Phase 21: 队友信号冷却
let signalCooldown = false

// Phase 25: 成就系统
const ACHIEVEMENTS: { id: string; name: string; desc: string; check: () => boolean }[] = [
  { id: 'first_game', name: '初出茅庐', desc: '完成第一局', check: () => state.roundNumber >= 1 },
  { id: 'first_win', name: '头游达人', desc: '首次获得头游', check: () => state.finishOrder[0] === 'south' },
  { id: 'bomb_king', name: '炸弹狂人', desc: '单局使用3次炸弹', check: () => statsBombsPlayed >= 3 },
  { id: 'reach_a', name: '登顶A级', desc: '打到A级', check: () => state.gameLevel === 'A' },
  { id: 'double_up', name: '双上王者', desc: '南北队双上（头游+二游）', check: () => {
    const ns = state.finishOrder.filter(s => s === 'north' || s === 'south')
    return ns.length >= 2 && state.finishOrder.indexOf(ns[0]) < 2 && state.finishOrder.indexOf(ns[1]) < 2
  }},
  { id: 'no_bomb_win', name: '不用炸弹', desc: '不使用炸弹获胜', check: () => state.phase === 'finished' && state.winnerTeam === 'northSouth' && statsBombsPlayed === 0 },
  { id: 'comeback', name: '逆风翻盘', desc: '对手先出完2人后翻盘', check: () => state.phase === 'finished' && state.winnerTeam === 'northSouth' && state.finishOrder.filter(s => s === 'east' || s === 'west').length >= 2 },
  { id: 'anti_tribute', name: '抗贡英雄', desc: '触发抗贡', check: () => state.tributeState?.antiTributed === true },
  { id: 'streak3', name: '势如破竹', desc: '连胜3局', check: () => false }, // needs persistent tracking
  { id: 'four_bomb', name: '四大天王', desc: '单局打出4次炸弹', check: () => statsBombsPlayed >= 4 },
]
let unlockedAchievements = new Set<string>()

// Phase 39: 出牌历史

// Phase 9: 加载设置
function loadSettings(): void {
  try {
    const saved = localStorage.getItem('guandan_settings')
    if (saved) {
      const s = JSON.parse(saved)
      if (s.aiSpeed) aiSpeed = s.aiSpeed
      if (s.aiDifficulty) aiDifficulty = s.aiDifficulty
      if (s.turnTimeout) turnTimeoutSec = s.turnTimeout
      if (typeof s.soundMuted === 'boolean') soundMuted = s.soundMuted
      if (s.theme) { currentTheme = s.theme; applyTheme(currentTheme) }
    }
    const ach = localStorage.getItem('guandan_achievements')
    if (ach) unlockedAchievements = new Set(JSON.parse(ach))
  } catch { /* ignore */ }
  // Bug #4: 将时限传给引擎
  setPlayerTimeout(turnTimeoutSec)
}

function saveSettings(): void {
  try {
    localStorage.setItem('guandan_settings', JSON.stringify({
      aiSpeed, aiDifficulty, turnTimeout: turnTimeoutSec, soundMuted, theme: currentTheme
    }))
  } catch { /* ignore */ }
}

// Phase 13: 主题切换
function applyTheme(theme: ThemeId): void {
  currentTheme = theme
  document.documentElement.setAttribute('data-theme', theme === 'classic' ? '' : theme)
}

// Phase 25: 成就检查
function checkAchievements(): void {
  for (const a of ACHIEVEMENTS) {
    if (!unlockedAchievements.has(a.id) && a.check()) {
      unlockedAchievements.add(a.id)
      try { localStorage.setItem('guandan_achievements', JSON.stringify([...unlockedAchievements])) } catch {}
      showAchievementToast(a.name, a.desc)
    }
  }
}

function showAchievementToast(name: string, desc: string): void {
  const toast = document.createElement('div')
  toast.className = 'achievement-toast'
  toast.innerHTML = `🏆 成就解锁！<br><strong>${name}</strong><br><span style="font-size:0.7rem;color:#b8d4b8">${desc}</span>`
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

// ===== 联机模块 =====
const onlineClient = new OnlineClient()
const onlineLobby = new OnlineLobby(app, onlineClient)
let isOnlineMode = false

onlineLobby.setOnStartGame((_data: unknown) => {
  isOnlineMode = true
  statusMessage = '联机匹配成功！'
  // Start local game as placeholder (full WS integration future update)
  const fresh = createInitialState()
  Object.assign(state, fresh)
  renderShell()
  startDealAnimation()
})

app.addEventListener('gd-back-to-entry', () => {
  isOnlineMode = false
  renderEntryScreen()
})

loadSettings()

// ===== 发牌动画 =====
let tributeInfoShown = false

function startDealAnimation(): void {
  isDealing = true
  tributeInfoShown = false
  baoFloatShown = false
  windFloatShown = false
  render()
  // 发牌动画 1.2s 后进入 playing
  window.setTimeout(() => {
    isDealing = false
    // Phase 4: 检查是否有进贡信息需要展示
    if (state.tributeState && state.tributeState.phase === 'tribute_done' && !tributeInfoShown) {
      showTributeInfo()
    } else {
      render()
      scheduleNextTick()
    }
  }, 1200)
}

// Phase 4: 进贡信息展示
function showTributeInfo(): void {
  tributeInfoShown = true
  const ts = state.tributeState
  if (!ts || ts.antiTributed) {
    // 抗贡
    render()
    scheduleNextTick()
    return
  }

  const info: string[] = []
  for (const t of ts.tributers) {
    if (t.card) {
      info.push(`${seatLabels[t.seat]} 进贡 ${t.card.label}`)
    }
  }
  for (const r of ts.receivers) {
    if (r.returnCard && r.receivedCard) {
      info.push(`${seatLabels[r.seat]} 还牌 ${r.returnCard.label}`)
    }
  }

  if (info.length === 0) {
    render()
    scheduleNextTick()
    return
  }

  // 显示进贡信息 2 秒后自动消失
  const overlay = document.getElementById('deal-overlay')
  if (overlay) {
    overlay.innerHTML = `
      <div class="tribute-info-overlay">
        <div class="tribute-info-panel">
          <h3>📋 进贡结算</h3>
          ${info.map(s => `<div class="tribute-info-line">${s}</div>`).join('')}
        </div>
      </div>
    `
    window.setTimeout(() => {
      if (overlay) overlay.innerHTML = ''
      render()
      scheduleNextTick()
    }, 2000)
  } else {
    render()
    scheduleNextTick()
  }
}

// ===== 过牌浮字 =====
// Phase 18: 接风浮字
let windFloatShown = false
function showPartnerFinishFloatIfNeeded(prevTurn: SeatId): void {
  const partner: Record<SeatId, SeatId> = { south: 'north', north: 'south', east: 'west', west: 'east' }
  const p = partner[prevTurn]
  if (state.players[p]?.finished && !windFloatShown) {
    windFloatShown = true
    const board = document.querySelector('.table-board')
    if (!board) return
    const el = document.createElement('div')
    el.className = 'partner-finish-float'
    el.textContent = `🎉 ${seatLabels[p]}出完！接风！`
    board.appendChild(el)
    setTimeout(() => el.remove(), 1600)
  }
}

function showPassFloat(seat: SeatId): void {
  const nonce = ++passFloatNonce
  passFloats.push({ seat, text: '不出', nonce })
  window.setTimeout(() => {
    passFloats = passFloats.filter(f => f.nonce !== nonce)
    render()
  }, 1000)
}

// ===== 获胜烟花 =====
function startFireworks(): void {
  fireworksCanvas = document.createElement('canvas')
  fireworksCanvas.className = 'fireworks-canvas'
  fireworksCanvas.width = window.innerWidth
  fireworksCanvas.height = window.innerHeight
  document.querySelector('.table-board')?.appendChild(fireworksCanvas)
  const ctx = fireworksCanvas.getContext('2d')!
  const particles: { x: number; y: number; vx: number; vy: number; color: string; life: number; size: number }[] = []
  const colors = ['#f5c542', '#e74c3c', '#66c6ff', '#8df0a6', '#ff6b6b', '#a855f7', '#fff']

  function burst(cx: number, cy: number): void {
    for (let i = 0; i < 40; i++) {
      const angle = (Math.PI * 2 / 40) * i + Math.random() * 0.3
      const speed = 2 + Math.random() * 4
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 60 + Math.random() * 40,
        size: 2 + Math.random() * 3
      })
    }
  }

  // 连续爆几波
  let burstCount = 0
  const burstInterval = window.setInterval(() => {
    burst(
      100 + Math.random() * (fireworksCanvas!.width - 200),
      80 + Math.random() * (fireworksCanvas!.height * 0.5)
    )
    burstCount++
    if (burstCount >= 6) window.clearInterval(burstInterval)
  }, 400)

  function animate(): void {
    ctx.clearRect(0, 0, fireworksCanvas!.width, fireworksCanvas!.height)
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.06 // gravity
      p.life--
      p.size *= 0.98
      if (p.life <= 0) { particles.splice(i, 1); continue }
      ctx.globalAlpha = Math.min(1, p.life / 30)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    if (particles.length > 0) {
      fireworksAnimId = requestAnimationFrame(animate as any)
    } else {
      fireworksCanvas?.remove()
      fireworksCanvas = null
    }
    return
  }
  fireworksAnimId = requestAnimationFrame(animate as any)
}

function stopFireworks(): void {
  if (fireworksAnimId) cancelAnimationFrame(fireworksAnimId)
  fireworksCanvas?.remove()
  fireworksCanvas = null
  fireworksAnimId = null
}
const audioCtx: AudioContext | null = typeof AudioContext !== 'undefined' ? new AudioContext() : null

// Phase 35: 自适应牌面尺寸
function updateCardSizeVars(): void {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const root = document.documentElement

  if (vw <= 360) {
    root.style.setProperty('--card-w', '32px')
    root.style.setProperty('--card-h', '46px')
    root.style.setProperty('--card-font', '0.4rem')
    root.style.setProperty('--card-overlap', '-20px')
  } else if (vw <= 480) {
    root.style.setProperty('--card-w', '38px')
    root.style.setProperty('--card-h', '54px')
    root.style.setProperty('--card-font', '0.5rem')
    root.style.setProperty('--card-overlap', '-24px')
  } else if (vw <= 768) {
    root.style.setProperty('--card-w', '46px')
    root.style.setProperty('--card-h', '64px')
    root.style.setProperty('--card-font', '0.6rem')
    root.style.setProperty('--card-overlap', '-28px')
  } else if (vw <= 1024) {
    root.style.setProperty('--card-w', '52px')
    root.style.setProperty('--card-h', '72px')
    root.style.setProperty('--card-font', '0.65rem')
    root.style.setProperty('--card-overlap', '-32px')
  } else {
    root.style.setProperty('--card-w', '58px')
    root.style.setProperty('--card-h', '80px')
    root.style.setProperty('--card-font', '0.7rem')
    root.style.setProperty('--card-overlap', '-36px')
  }

  // 高度不足时缩小
  if (vh < 600) {
    const currentH = parseFloat(getComputedStyle(root).getPropertyValue('--card-h')) || 72
    root.style.setProperty('--card-h', Math.max(46, currentH - 12) + 'px')
  }
}

window.addEventListener('resize', updateCardSizeVars)
updateCardSizeVars()

function playSound(type: 'play' | 'pass' | 'bomb' | 'click'): void {
  if (soundMuted || !audioCtx) return
  try {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    gain.gain.value = 0.15

    switch (type) {
      case 'play':
        osc.frequency.value = 600
        osc.type = 'sine'
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12)
        osc.start()
        osc.stop(audioCtx.currentTime + 0.12)
        break
      case 'pass':
        osc.frequency.value = 300
        osc.type = 'triangle'
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1)
        osc.start()
        osc.stop(audioCtx.currentTime + 0.1)
        break
      case 'bomb':
        osc.frequency.value = 150
        osc.type = 'sawtooth'
        gain.gain.value = 0.2
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3)
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35)
        osc.start()
        osc.stop(audioCtx.currentTime + 0.35)
        break
      case 'click':
        osc.frequency.value = 800
        osc.type = 'sine'
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05)
        osc.start()
        osc.stop(audioCtx.currentTime + 0.05)
        break
    }
  } catch { /* 静默失败 */ }
}

// Phase 12: 牌型音效区分 + Phase 33: 炸弹音效
// @ts-ignore - used for future combo sound differentiation
function playComboSound(comboType: string): void {
  if (soundMuted || !audioCtx) return
  try {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    gain.gain.value = 0.12

    switch (comboType) {
      case 'single':
        osc.frequency.value = 520
        osc.type = 'sine'
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1)
        osc.start(); osc.stop(audioCtx.currentTime + 0.1)
        break
      case 'pair':
        osc.frequency.value = 580
        osc.type = 'sine'
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12)
        osc.start(); osc.stop(audioCtx.currentTime + 0.12)
        break
      case 'triple':
        osc.frequency.value = 640
        osc.type = 'sine'
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15)
        osc.start(); osc.stop(audioCtx.currentTime + 0.15)
        break
      case 'straight':
      case 'pairStraight':
        osc.frequency.value = 700
        osc.type = 'triangle'
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2)
        osc.start(); osc.stop(audioCtx.currentTime + 0.2)
        break
    }
  } catch { /* ignore */ }
}

// Phase 33: 炸弹"轰"声
function playBombSound(isRocket: boolean): void {
  if (soundMuted || !audioCtx) return
  try {
    const now = audioCtx.currentTime
    if (isRocket) {
      // 王炸：双音
      for (let i = 0; i < 2; i++) {
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.frequency.value = 100 - i * 30
        osc.type = 'sawtooth'
        gain.gain.value = 0.25
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.5 + i * 0.2)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6 + i * 0.2)
        osc.start(now + i * 0.15)
        osc.stop(now + 0.7 + i * 0.2)
      }
    } else {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.frequency.value = 120
      osc.type = 'sawtooth'
      gain.gain.value = 0.22
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.4)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
      osc.start()
      osc.stop(now + 0.5)
    }
  } catch { /* ignore */ }
}



function toggleSound(): void {
  soundMuted = !soundMuted
  render()
}

// Phase 28: AI 速度控制
function cycleAiSpeed(): void {
  const speeds: AiSpeed[] = ['turbo', 'fast', 'normal', 'slow']
  const idx = speeds.indexOf(aiSpeed)
  aiSpeed = speeds[(idx + 1) % speeds.length]
  render()
}

function toggleFastForward(): void {
  fastForward = !fastForward
  render()
}

function getAiDelay(): number {
  if (fastForward) return 0
  return AI_SPEED_MS[aiSpeed]
}

function aiSpeedLabel(): string {
  switch (aiSpeed) {
    case 'turbo': return '极速'
    case 'fast': return '快速'
    case 'normal': return '正常'
    case 'slow': return '慢速'
  }
}

function aiSpeedIcon(): string {
  switch (aiSpeed) {
    case 'turbo': return '🚀'
    case 'fast': return '⚡'
    case 'normal': return '🐢'
    case 'slow': return '🐌'
  }
}

function toggleTracker(): void {
  trackerVisible = !trackerVisible
  render()
}

// ===== 游戏计时器 =====

// ===== 初始化：显示入口大厅 =====

renderEntryScreen()

// Phase 23: 键盘快捷键
document.addEventListener('keydown', (e) => {
  if (state.phase !== 'playing' || state.turn !== 'south') return
  switch (e.key.toLowerCase()) {
    case ' ':
    case 'enter':
      e.preventDefault()
      onPlay()
      break
    case 'p':
      e.preventDefault()
      onPass()
      break
    case 'h':
      e.preventDefault()
      onHint()
      break
    case 'r':
      e.preventDefault()
      onFastPlay()
      break
    case 'c':
      e.preventDefault()
      clearSelection()
      break
    case 't':
      e.preventDefault()
      toggleTracker()
      break
  }
})

// Phase 22: 手机手势（上滑出牌/下滑过牌）
let touchStartY = 0
let touchStartX = 0
document.addEventListener('touchstart', (e) => {
  if (state.phase !== 'playing' || state.turn !== 'south') return
  const t = e.touches[0]
  touchStartY = t.clientY
  touchStartX = t.clientX
}, { passive: true })

document.addEventListener('touchend', (e) => {
  if (state.phase !== 'playing' || state.turn !== 'south') return
  const t = e.changedTouches[0]
  const dy = touchStartY - t.clientY
  const dx = Math.abs(t.clientX - touchStartX)
  if (Math.abs(dy) > 60 && dx < Math.abs(dy) * 1.5) {
    if (dy > 0) {
      // 上滑出牌
      onPlay()
    } else {
      // 下滑过牌
      onPass()
    }
  }
}, { passive: true })

function scheduleNextTick(): void {
  if (timer !== null) window.clearTimeout(timer)
  if (state.phase !== 'playing') return
  // Phase 28: 使用 AI 速度控制
  const tickDelay = state.turn === 'south' ? 500 : Math.max(100, getAiDelay())
  timer = window.setTimeout(() => {
  if (state.phase !== 'playing') return
    if (state.phase !== 'playing') return
    const elapsed = Date.now() - state.turnStartedAt
    if (elapsed < state.turnTimeoutMs) {
      scheduleNextTick()
      return
    }

    if (state.turn === 'south') {
      selectedCardIds = new Set()
    }

    // 记录出牌前的状态
    const prevTrickLeader = state.trick.leaderSeat
    const prevLastPlayRef = state.trick.lastPlay
    const prevTurn = state.turn
    resolveTimedTurn(state)
    // 检测是否过牌（lastPlay 没变且不是新一轮）
    if (state.trick.lastPlay === prevLastPlayRef && state.phase === 'playing' && prevTurn !== 'south') {
      showPassFloat(prevTurn)
    }
    // Phase 18: 检测队友出完
    if (state.phase === 'playing') {
      showPartnerFinishFloatIfNeeded(prevTurn)
    }
    // 更新各方位出牌记录
    updatePlayBySeat(prevTrickLeader)
    statusMessage = ''
    render()
    scheduleNextTick()
  }, tickDelay)
}

function updatePlayBySeat(_prevLeader: SeatId | null): void {
  const currentPlay = state.trick.lastPlay
  // trick 重置时（新一轮开始），清空所有方位
  if (currentPlay === null && prevLastPlay !== null) {
    lastPlayBySeat = { south: null, north: null, east: null, west: null }
  }
  // 有新出牌时，记录到对应方位（trick.leaderSeat 就是刚出牌的人）
  if (currentPlay && currentPlay !== prevLastPlay && state.trick.leaderSeat) {
    lastPlayBySeat[state.trick.leaderSeat] = currentPlay
  }
  prevLastPlay = currentPlay
}

function restartGame(): void {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
  stopFireworks()
  selectedCardIds = new Set()
  statusMessage = ''
  selectionHint = ''
  lastPlayBySeat = { south: null, north: null, east: null, west: null }
  prevLastPlay = null
  passFloats = []
  trackerVisible = false
  resetGameStats()
  baoFloatShown = false
  windFloatShown = false
  
  
  const fresh = createInitialState()
  Object.assign(state, fresh)
  startDealAnimation()
}

function nextRound(): void {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
  stopFireworks()
  selectedCardIds = new Set()
  statusMessage = ''
  selectionHint = ''
  lastPlayBySeat = { south: null, north: null, east: null, west: null }
  prevLastPlay = null
  passFloats = []
  trackerVisible = false
  resetGameStats()
  baoFloatShown = false
  windFloatShown = false

  // Phase 37: 局间过渡动画
  const board = document.querySelector('.table-board')
  if (board) {
    const trans = document.createElement('div')
    trans.className = 'round-transition'
    const nextLv = createNextRound(state, state.finishOrder).gameLevel
    trans.innerHTML = `<div class="round-transition-text">第${state.roundNumber + 2}局 · 打 ${nextLv}</div>`
    board.appendChild(trans)
    setTimeout(() => {
      trans.remove()
      const fresh = createNextRound(state, state.finishOrder)
      Object.assign(state, fresh)
      checkAchievements()
      startDealAnimation()
    }, 1500)
  } else {
    const fresh = createNextRound(state, state.finishOrder)
    Object.assign(state, fresh)
    checkAchievements()
    startDealAnimation()
  }
}

// Phase 42: 快速重开
function quickRestart(): void {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
  stopFireworks()
  selectedCardIds = new Set()
  statusMessage = ''
  selectionHint = ''
  lastPlayBySeat = { south: null, north: null, east: null, west: null }
  prevLastPlay = null
  passFloats = []
  trackerVisible = false
  resetGameStats()
  baoFloatShown = false
  windFloatShown = false
  
  
  const fresh = createInitialState()
  Object.assign(state, fresh)
  startDealAnimation()
}

// Phase 21: 队友信号
function sendSignal(emoji: string): void {
  if (signalCooldown) return
  signalCooldown = true
  setTimeout(() => { signalCooldown = false }, 10000)

  // 显示信号浮字在北家（队友）座位头部上方
  const northSeat = document.querySelector('.seat-north')
  if (northSeat) {
    const el = document.createElement('div')
    el.className = 'signal-float'
    el.textContent = emoji
    northSeat.appendChild(el)
    setTimeout(() => el.remove(), 2000)
  }
  playSound('click')
}

function syncSelection(cards: Card[], _tone: 'soft' | 'strong' = 'soft'): void {
  selectedCardIds = new Set(cards.map((card) => card.id))
  selectionHint = cards.length > 0 ? `已预选 ${comboName(cards)}。` : selectionHint
  statusMessage = validationMessage()
}

function onCardToggle(cardId: string): void {
  if (state.phase !== 'playing' || state.turn !== 'south') return
  const player = state.players.south
  if (player.finished) return

  const clicked = player.hand.find((card) => card.id === cardId)
  if (!clicked) return

  const currentSelected = getSelectedCards()
  const sameTypeSelected = currentSelected.length > 0 && currentSelected.every((card) => card.rank === clicked.rank)
  const next = new Set(selectedCardIds)

  if (next.has(cardId)) {
    next.delete(cardId)
  } else if (sameTypeSelected) {
    player.hand.filter((card) => card.rank === clicked.rank).forEach((card) => next.add(card.id))
  } else {
    next.add(cardId)
  }

  selectedCardIds = next
  selectionHint = currentSelected.length > 0 ? `已选择 ${comboName(getSelectedCards())}。` : selectionHint
  statusMessage = validationMessage()
  render()
}

function onCardDoubleClick(cardId: string): void {
  if (state.phase !== 'playing' || state.turn !== 'south') return
  const player = state.players.south
  if (player.finished) return

  const clicked = player.hand.find((card) => card.id === cardId)
  if (!clicked) return

  const recommended = chooseRecommendedCombo(player.hand, state.trick.lastPlay, state) ?? chooseHintCombo(player.hand, state.trick.lastPlay, state)
  if (!recommended) {
    statusMessage = '当前没有可出的牌。'
    render()
    return
  }

  syncSelection(recommended.cards, 'strong')
  selectionHint = `已推荐：${comboLabel(recommended.type)}。`
  statusMessage = `已推荐：${comboLabel(recommended.type)}。`
  render()
}

function onPlay(): void {
  if (state.phase !== 'playing' || state.turn !== 'south') return
  if (timer !== null) { window.clearTimeout(timer); timer = null; }
  const player = state.players.south
  if (player.finished) return

  const cards = player.hand.filter((card) => selectedCardIds.has(card.id))
  const prevLeader = state.trick.leaderSeat
  const result = playHumanCards(state, cards)
  if (!result.ok) {
    statusMessage = result.message ?? '无法出牌。'
    render()
    return
  }

  selectedCardIds = new Set()
  statusMessage = ''
  selectionHint = ''
  const isBomb = cards.length >= 4 && detectCombo(cards, state.levelRank)?.type === 'bomb'
  const isRocket = detectCombo(cards, state.levelRank)?.type === 'rocket'
  playSound(isBomb || isRocket ? 'bomb' : 'play')
  // Phase 20: 炸弹/王炸视觉特效
  if (isRocket) {
    shakeScreen(1.2)
    flashScreen(1.0)
    playBombSound(true)
  } else if (isBomb) {
    shakeScreen(0.8)
    flashScreen(0.6)
    playBombSound(false)
  }
  // Phase 14/24: 记录统计和倍数
  const combo = detectCombo(cards, state.levelRank)
  if (combo) recordPlayStats(cards, combo.type)
  updatePlayBySeat(prevLeader)
  // GD-1: 强制在下一帧重新渲染手牌，确保计数及时更新
  render()
  requestAnimationFrame(() => {
    patchHandSouth()
    patchSeatTimers()
  })
  scheduleNextTick()
}

// Phase 20: 屏幕震动
function shakeScreen(duration: number = 0.5): void {
  const shell = document.getElementById('game-shell')
  if (!shell) return
  shell.classList.add('screen-shake')
  setTimeout(() => shell.classList.remove('screen-shake'), duration * 1000)
}

// Phase 20: 屏幕闪白
function flashScreen(duration: number = 0.5): void {
  const board = document.querySelector('.table-board')
  if (!board) return
  const flash = document.createElement('div')
  flash.className = 'flash-overlay'
  flash.style.animationDuration = duration + 's'
  board.appendChild(flash)
  setTimeout(() => flash.remove(), duration * 1000 + 100)
}

function onFastPlay(): void {
  if (state.phase !== 'playing' || state.turn !== 'south') return
  if (timer !== null) { window.clearTimeout(timer); timer = null; }
  const player = state.players.south
  if (player.finished) return

  const recommended = chooseRecommendedCombo(player.hand, state.trick.lastPlay, state)
  if (!recommended) {
    statusMessage = '当前没有可出的牌。'
    render()
    return
  }

  selectedCardIds = new Set(recommended.cards.map((card) => card.id))
  const prevLeader = state.trick.leaderSeat
  const result = playHumanCards(state, recommended.cards)
  if (!result.ok) {
    statusMessage = result.message ?? '自动出牌失败。'
    render()
    return
  }

  selectedCardIds = new Set()
  statusMessage = `已自动出牌：${comboLabel(recommended.type)}。`
  selectionHint = ''
  const isBomb = recommended.cards.length >= 4 && (recommended.type === 'bomb' || recommended.type === 'rocket')
  playSound(isBomb ? 'bomb' : 'play')
  updatePlayBySeat(prevLeader)
  render()
  requestAnimationFrame(() => {
    patchHandSouth()
    patchSeatTimers()
  })
  scheduleNextTick()
}

function onPass(): void {
  if (state.phase !== 'playing' || state.turn !== 'south') return
  if (timer !== null) { window.clearTimeout(timer); timer = null; }
  const prevLeader = state.trick.leaderSeat
  const result = passHumanTurn(state)
  if (!result.ok) {
    statusMessage = result.message ?? '无法过牌。'
    render()
    return
  }

  selectedCardIds = new Set()
  statusMessage = ''
  playSound('pass')
  showPassFloat('south')
  updatePlayBySeat(prevLeader)
  render()
  requestAnimationFrame(() => {
    patchHandSouth()
    patchSeatTimers()
  })
  scheduleNextTick()
}

function onHint(): void {
  if (state.phase !== 'playing' || state.turn !== 'south') return
  const player = state.players.south
  if (player.finished) return

  const hint = chooseHintCombo(player.hand, state.trick.lastPlay, state)
  if (!hint) {
    statusMessage = '当前没有可出的牌。'
    render()
    return
  }

  syncSelection(hint.cards, 'soft')
  selectionHint = `已提示：${comboLabel(hint.type)}。`
  statusMessage = `已提示：${comboLabel(hint.type)}。`
  render()
}

function clearSelection(): void {
  selectedCardIds = new Set()
  statusMessage = selectionHint ? '已清空选择。' : '已清空选择，可重新选牌。'
  render()
}

// ===== 入口大厅 =====

function renderEntryScreen(): void {
  shellReady = false
  if (timer !== null) { window.clearTimeout(timer); timer = null; }
  stopFireworks()

  app.innerHTML = `
    <div class="entry-bg" id="entry-bg">
      <div class="entry-logo">
        <span class="logo-cards">🂡 🂱 🃁 🃑</span>
        <h1>掼蛋经典场</h1>
        <p class="entry-tagline">双副牌 · 四人对战 · 升级竞技</p>
      </div>
      <div class="entry-info">
        <span class="entry-level">当前级数：<b>${entryGameLevel}</b></span>
        <span class="entry-rounds">对局数：<b>${state.roundNumber || 1}</b></span>
      </div>
      <div class="entry-actions">
        <button id="btn-start-game" class="entry-btn primary">
          <span class="btn-icon">🎮</span>
          <span class="btn-text-wrap">
            <span class="btn-text">开始游戏</span>
            <span class="btn-desc">单人 vs 3家AI</span>
          </span>
        </button>
        <button id="btn-online-game" class="entry-btn">
          <span class="btn-icon">🌐</span>
          <span class="btn-text-wrap">
            <span class="btn-text">联机对战</span>
            <span class="btn-desc">匹配/房间 · 4人对战</span>
          </span>
        </button>
        <button id="btn-rules" class="entry-btn">
          <span class="btn-icon">📖</span>
          <span class="btn-text-wrap">
            <span class="btn-text">游戏规则</span>
            <span class="btn-desc">牌型说明 · 出牌规则</span>
          </span>
        </button>
      </div>
      <div class="entry-sub-row">
        <button id="btn-settings-entry" class="entry-sub-btn">⚙️ 设置</button>
        <button id="btn-stats-entry" class="entry-sub-btn">📊 战绩</button>
      </div>
      <div class="entry-footer">v1.0 · 纯前端单机版</div>
    </div>
  `

  document.getElementById('btn-start-game')?.addEventListener('click', () => {
    playSound('click')
    startGameFromEntry()
  })
  document.getElementById('btn-online-game')?.addEventListener('click', () => {
    playSound('click')
    onlineLobby.show()
  })
  document.getElementById('btn-rules')?.addEventListener('click', () => {
    playSound('click')
    showRulesOverlay()
  })
  document.getElementById('btn-settings-entry')?.addEventListener('click', () => {
    playSound('click')
    showSettingsOverlay()
  })
}

function startGameFromEntry(): void {
  const fresh = createInitialState()
  Object.assign(state, fresh)
  renderShell()
  startDealAnimation()
}

// ===== 规则说明浮层 =====

function showRulesOverlay(): void {
  const existing = document.getElementById('rules-overlay')
  if (existing) { existing.remove(); return }

  const overlay = document.createElement('div')
  overlay.id = 'rules-overlay'
  overlay.className = 'rules-overlay'
  overlay.innerHTML = `
    <div class="rules-panel">
      <div class="rules-header">
        <h2>📖 掼蛋规则</h2>
        <button id="rules-close" class="rules-close-btn" type="button">×</button>
      </div>
      <div class="rules-tabs">
        <button class="rules-tab active" data-tab="combos">牌型说明</button>
        <button class="rules-tab" data-tab="basics">基本规则</button>
        <button class="rules-tab" data-tab="level">级牌进贡</button>
        <button class="rules-tab" data-tab="controls">操作说明</button>
      </div>
      <div class="rules-content" id="rules-content">
        ${rulesContent('combos')}
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('visible'))

  overlay.querySelector('#rules-close')?.addEventListener('click', () => {
    overlay.classList.remove('visible')
    setTimeout(() => overlay.remove(), 300)
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { overlay.classList.remove('visible'); setTimeout(() => overlay.remove(), 300) }
  })
  overlay.querySelectorAll('.rules-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.rules-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      const content = document.getElementById('rules-content')
      if (content) content.innerHTML = rulesContent((tab as HTMLElement).dataset.tab || 'combos')
    })
  })
}

// Phase 9: 设置面板
function showSettingsOverlay(): void {
  const existing = document.getElementById('settings-overlay')
  if (existing) { existing.remove(); return }

  const overlay = document.createElement('div')
  overlay.id = 'settings-overlay'
  overlay.className = 'rules-overlay'
  overlay.innerHTML = `
    <div class="rules-panel settings-panel-ui">
      <div class="rules-header">
        <h2>⚙️ 游戏设置</h2>
        <button id="settings-close" class="rules-close-btn" type="button">×</button>
      </div>
      <div class="settings-body">
        <div class="settings-group">
          <label>🔊 音效</label>
          <div class="settings-row">
            <button class="settings-toggle ${soundMuted ? '' : 'active'}" id="setting-sound">${soundMuted ? '🔇 已静音' : '🔊 已开启'}</button>
          </div>
        </div>
        <div class="settings-group">
          <label>🤖 AI 难度</label>
          <div class="settings-row">
            <button class="settings-opt ${aiDifficulty === 'easy' ? 'active' : ''}" data-diff="easy">简单</button>
            <button class="settings-opt ${aiDifficulty === 'normal' ? 'active' : ''}" data-diff="normal">普通</button>
            <button class="settings-opt ${aiDifficulty === 'hard' ? 'active' : ''}" data-diff="hard">困难</button>
          </div>
        </div>
        <div class="settings-group">
          <label>⏱️ 出牌时限</label>
          <div class="settings-row">
            <button class="settings-opt ${turnTimeoutSec === 10 ? 'active' : ''}" data-time="10">10秒</button>
            <button class="settings-opt ${turnTimeoutSec === 20 ? 'active' : ''}" data-time="20">20秒</button>
            <button class="settings-opt ${turnTimeoutSec === 30 ? 'active' : ''}" data-time="30">30秒</button>
          </div>
        </div>
        <div class="settings-group">
          <label>🐢 AI 速度</label>
          <div class="settings-row">
            <button class="settings-opt ${aiSpeed === 'turbo' ? 'active' : ''}" data-sp="turbo">极速</button>
            <button class="settings-opt ${aiSpeed === 'fast' ? 'active' : ''}" data-sp="fast">快速</button>
            <button class="settings-opt ${aiSpeed === 'normal' ? 'active' : ''}" data-sp="normal">正常</button>
            <button class="settings-opt ${aiSpeed === 'slow' ? 'active' : ''}" data-sp="slow">慢速</button>
          </div>
        </div>
        <div class="settings-group">
          <label>🎨 视觉主题</label>
          <div class="settings-row">
            <button class="settings-opt ${currentTheme === 'classic' ? 'active' : ''}" data-theme="classic">经典绿</button>
            <button class="settings-opt ${currentTheme === 'gold' ? 'active' : ''}" data-theme="gold">金光</button>
            <button class="settings-opt ${currentTheme === 'blue' ? 'active' : ''}" data-theme="blue">静谧蓝</button>
            <button class="settings-opt ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark">深夜黑</button>
          </div>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('visible'))

  const close = () => { overlay.classList.remove('visible'); setTimeout(() => overlay.remove(), 300) }
  overlay.querySelector('#settings-close')?.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })

  overlay.querySelector('#setting-sound')?.addEventListener('click', () => {
    soundMuted = !soundMuted
    saveSettings()
    const btn = overlay.querySelector('#setting-sound') as HTMLElement
    btn.textContent = soundMuted ? '🔇 已静音' : '🔊 已开启'
    btn.classList.toggle('active', !soundMuted)
  })

  overlay.querySelectorAll('[data-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      aiDifficulty = (btn as HTMLElement).dataset.diff as AiDifficulty
      saveSettings()
      overlay.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
    })
  })

  overlay.querySelectorAll('[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      turnTimeoutSec = parseInt((btn as HTMLElement).dataset.time || '20')
      setPlayerTimeout(turnTimeoutSec)
      saveSettings()
      overlay.querySelectorAll('[data-time]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
    })
  })

  overlay.querySelectorAll('[data-sp]').forEach(btn => {
    btn.addEventListener('click', () => {
      aiSpeed = (btn as HTMLElement).dataset.sp as AiSpeed
      saveSettings()
      overlay.querySelectorAll('[data-sp]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
    })
  })

  // Phase 13: 主题切换
  overlay.querySelectorAll('[data-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = (btn as HTMLElement).dataset.theme as ThemeId
      applyTheme(theme)
      saveSettings()
      overlay.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
    })
  })
}

function rulesContent(tab: string): string {
  switch (tab) {
    case 'combos': return `
      <div class="rule-section">
        <h3>🃏 10种牌型</h3>
        <div class="rule-combo-list">
          <div class="rule-combo"><strong>单张</strong>：任意1张牌</div>
          <div class="rule-combo"><strong>对子</strong>：2张同点数牌</div>
          <div class="rule-combo"><strong>三张</strong>：3张同点数牌</div>
          <div class="rule-combo"><strong>三带二</strong>：3张+2张（不同点数）</div>
          <div class="rule-combo"><strong>顺子</strong>：5+连续单张（不含2和王）</div>
          <div class="rule-combo"><strong>连对</strong>：3+连续对子（钢板）</div>
          <div class="rule-combo"><strong>三顺</strong>：2+连续三张</div>
          <div class="rule-combo"><strong>炸弹</strong>：4张同点数（或以上）</div>
          <div class="rule-combo"><strong>同花顺</strong>：同花色顺子（大于普通炸弹）</div>
          <div class="rule-combo"><strong>王炸</strong>：大小王各2张（最大）</div>
        </div>
      </div>
    `
    case 'basics': return `
      <div class="rule-section">
        <h3>📋 基本规则</h3>
        <div class="rule-item">• 双副牌108张，4人分2队（南北 vs 东西）</div>
        <div class="rule-item">• 队友坐对门，不直接配合但共享胜负</div>
        <div class="rule-item">• 每人27张牌，先出完者获胜</div>
        <div class="rule-item">• 上家出牌后，下家必须出更大的同类型牌或"不出"</div>
        <div class="rule-item">• 炸弹可以压任何非炸弹牌型</div>
        <div class="rule-item">• 同花顺 > 炸弹 > 其他牌型</div>
        <div class="rule-item">• 王炸最大，可以压一切</div>
      </div>
    `
    case 'level': return `
      <div class="rule-section">
        <h3>⭐ 级牌规则</h3>
        <div class="rule-item">• 每局有"级牌"（当前打的级别对应的牌）</div>
        <div class="rule-item">• 级牌比同张数的普通牌大</div>
        <div class="rule-item">• 级牌在牌面上有金色边框和"级"字标识</div>
        <div class="rule-item">• 赢一局升一级，从2打到A为胜利</div>
      </div>
    `
    case 'tribute': return `
      <div class="rule-section">
        <h3>📋 进贡规则</h3>
        <div class="rule-item">• 上局末游需向上局头游进贡最大牌</div>
        <div class="rule-item">• 头游收到进贡牌后还贡最小牌</div>
        <div class="rule-item">• 双大王或双小王可"抗贡"（免进贡）</div>
        <div class="rule-item">• 进贡牌不含级牌和王</div>
      </div>
    `
    case 'controls': return `
      <div class="rule-section">
        <h3>🎮 操作说明</h3>
        <div class="rule-item">• <strong>单击</strong>牌面：选中/取消选中</div>
        <div class="rule-item">• <strong>双击</strong>牌面：AI 推荐出牌</div>
        <div class="rule-item">• <strong>上滑拖拽</strong>：拖到出牌区出牌</div>
        <div class="rule-item">• 点击 <strong>提示</strong>：查看可出牌型</div>
        <div class="rule-item">• 点击 <strong>推荐</strong>：AI 自动选牌</div>
        <div class="rule-item">• 点击 <strong>清空</strong>：取消所有选中</div>
        <div class="rule-item">• 顶部 🐢/⏩：切换 AI 速度</div>
        <div class="rule-item">• 顶部 📋：记牌器（查看已出牌）</div>
      </div>
    `
    default: return ''
  }
}

// ===== 渲染（Shell + 分区 Patch） =====

function renderShell(): void {
  shellReady = true
  const isPlaying = state.phase === 'playing'
  const isSouthTurn = isPlaying && state.turn === 'south'
  const timeLeft = getTimeLeft()
  const isUrgent = isSouthTurn && timeLeft < 10

  app.innerHTML = `
    <div class="game-shell" id="game-shell">
      <header class="topbar" id="topbar">
        <div class="topbar-left">
          <button id="back-to-entry" class="topbar-back-btn" type="button" title="返回大厅">🏠</button>
          <span class="topbar-title">🂡 掼蛋经典场</span>
          <span class="topbar-meta">本局打 ${state.round}</span>
          <span class="topbar-sub">倍数${renderMultiplier()}</span>
          ${renderLevelProgress()}
        </div>
        <div class="topbar-center">
          <span class="turn-info" id="turn-info">${isPlaying ? `轮到 ${seatLabels[state.turn]}` : '对局结束'}</span>
        </div>
        <div class="topbar-right">
          <button id="ai-speed-btn" class="topbar-icon-btn" type="button" title="AI速度: ${aiSpeedLabel()}">${aiSpeedIcon()}</button>
          <button id="fast-forward-btn" class="topbar-icon-btn ${fastForward ? 'ff-active' : ''}" type="button" title="${fastForward ? '取消快进' : '快进'}">⏩</button>
          <div class="timer-badge ${isSouthTurn ? 'timer-badge--active' : ''} ${isUrgent ? 'timer-badge--urgent' : ''}" id="timer-badge">
            ${timeLeft}s
          </div>
          <button id="rules-game-btn" class="topbar-icon-btn" type="button" title="游戏规则">❓</button>
          <button id="tracker-btn" class="topbar-icon-btn" type="button" title="记牌器">📋</button>
          <button id="sound-btn" class="topbar-icon-btn" type="button" title="${soundMuted ? '开启音效' : '关闭音效'}">${soundMuted ? '🔇' : '🔊'}</button>
          <button id="restart-btn" type="button">重开</button>
        </div>
      </header>

      <main class="table-area">
        <section class="table-board" id="table-board">
          <div class="table-watermark">掼蛋 · 经典玩法</div>
          <div id="deal-overlay"></div>
          <div id="seat-north" style="grid-area:north">${renderNorthSeat()}</div>
          <div id="seat-west" style="grid-area:west">${renderWestSeat()}</div>
          <div class="center-area" id="center-area">
            <div id="play-status">${renderPlayStatus()}</div>
            <div id="selection-info">${renderSelectionInfo()}</div>
            <div id="status-message">${renderStatusMessage()}</div>
          </div>
          <div class="play-zones" id="play-zones">
            <div id="pz-north">${renderPlayZone('north')}</div>
            <div id="pz-east">${renderPlayZone('east')}</div>
            <div id="pz-west">${renderPlayZone('west')}</div>
            <div id="pass-floats">${renderPassFloats()}</div>
          </div>
          <div id="seat-east" style="grid-area:east">${renderEastSeat()}</div>
          <div id="seat-south" style="grid-area:south;padding-top:16px">${renderSouthSeat()}</div>
          <div id="result-overlay">${state.phase === 'finished' ? renderResultOverlay() : ''}</div>
          <div id="tracker-overlay">${trackerVisible ? renderTrackerOverlay() : ''}</div>
        </section>
      </main>

      <div class="log-float" id="log-float">
        ${state.log.slice(0, 10).map((item) => `<div>${escapeHtml(item)}</div>`).join('')}
      </div>
    </div>
  `

  // 绑定事件（只绑一次）
  bindStaticEvents()
  setupCardEvents()
}

function bindStaticEvents(): void {
  const board = document.getElementById('table-board')
  if (!board) return

  // 事件委托：一个 listener 处理所有按钮点击
  board.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('button')
    if (!t) return
    switch (t.id) {
      case 'restart-btn': case 'replay-btn': restartGame(); break
      case 'quick-restart-btn': quickRestart(); break
      case 'back-to-lobby-btn': renderEntryScreen(); break
      case 'hint-btn': onHint(); break
      case 'fast-play-btn': onFastPlay(); break
      case 'play-btn': onPlay(); break
      case 'pass-btn': onPass(); break
      case 'clear-btn': clearSelection(); break
      case 'tracker-btn': case 'tracker-close': toggleTracker(); break
      case 'sound-btn': toggleSound(); break
      case 'next-round-btn': nextRound(); break
      case 'back-to-entry': renderEntryScreen(); break
      case 'rules-game-btn': showRulesOverlay(); break
      // Phase 21: 队友信号
      case 'sig-help': sendSignal('🆘'); break
      case 'sig-pass': sendSignal('⏭️'); break
      case 'sig-bomb': sendSignal('💣'); break
      case 'sig-run': sendSignal('🏃'); break
      // Phase 28: AI 速度控制
      case 'ai-speed-btn': cycleAiSpeed(); break
      case 'fast-forward-btn': toggleFastForward(); break
    }
  })

  // tracker overlay 点击关闭
  board.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    if (t.classList.contains('tracker-overlay')) toggleTracker()
  })
}

function render(): void {
  if (!shellReady || !document.getElementById('game-shell')) {
    renderShell()
    return
  }

  // 触发烟花
  if (state.phase === 'finished' && !fireworksCanvas) {
    window.setTimeout(startFireworks, 300)
    checkAchievements()
  }

  // Phase 36: 报牌检测
  showBaoFloatIfNeeded()

  patchTopbar()
  patchCenter()
  patchPlayZones()
  patchLog()
  patchSeatTimers()
  patchHandSouth()
  patchOverlays()
}

// ===== 座位渲染映射 =====

const seatRenderers: Record<SeatId, () => string> = {
  north: renderNorthSeat,
  east: renderEastSeat,
  west: renderWestSeat,
  south: renderSouthSeat,
}

// ===== Patch 函数 =====

function patchTopbar(): void {
  const isPlaying = state.phase === 'playing'
  const isSouthTurn = isPlaying && state.turn === 'south'
  const timeLeft = getTimeLeft()
  // Phase 15: 计时器颜色渐变
  const timerClass = isSouthTurn
    ? (timeLeft <= 3 ? 'timer-badge--danger' : timeLeft <= 5 ? 'timer-badge--warn' : 'timer-badge--active')
    : ''
  const isUrgent = timeLeft <= 3

  const turnEl = document.getElementById('turn-info')
  if (turnEl) turnEl.textContent = isPlaying ? `轮到 ${seatLabels[state.turn]}` : '对局结束'

  const timerEl = document.getElementById('timer-badge')
  if (timerEl) {
    timerEl.className = `timer-badge ${timerClass} ${isUrgent ? 'timer-badge--urgent' : ''}`
    timerEl.textContent = `${timeLeft}s`
  }
}

function patchCenter(): void {
  const statusEl = document.getElementById('play-status')
  if (statusEl) statusEl.innerHTML = renderPlayStatus()

  const selEl = document.getElementById('selection-info')
  if (selEl) selEl.innerHTML = renderSelectionInfo()

  const msgEl = document.getElementById('status-message')
  if (msgEl) msgEl.innerHTML = renderStatusMessage()
}

function patchPlayZones(): void {
  const set = (id: string, html: string) => {
    const el = document.getElementById(id)
    if (el) el.innerHTML = html
  }
  set('pz-north', renderPlayZone('north'))
  set('pz-east', renderPlayZone('east'))
  set('pz-west', renderPlayZone('west'))
  set('pz-south', renderPlayZone('south'))
  set('pass-floats', renderPassFloats())
}

function patchLog(): void {
  const el = document.getElementById('log-float')
  if (el) {
    el.innerHTML = state.log.slice(0, 3).map((item) => {
      let cls = 'log-entry'
      if (/炸弹|王炸/.test(item)) cls += ' log-entry--bomb'
      else if (/过牌/.test(item)) cls += ' log-entry--pass'
      else if (/出牌/.test(item)) cls += ' log-entry--play'
      return `<div class="${cls}">${escapeHtml(item)}</div>`
    }).join('')
  }
}

function patchSeatTimers(): void {
  const timeLeft = getTimeLeft()
  const isUrgent = timeLeft < 10
  const timerHtml = `<span class="seat-timer ${isUrgent ? 'seat-timer--urgent' : 'seat-timer--active'}">${timeLeft}s</span>`
  const waitHtml = '<span class="seat-timer-wait">⏳</span>'

  const seats: SeatId[] = ['north', 'west', 'east']
  for (const seat of seats) {
    const el = document.querySelector(`#seat-${seat} .seat-timer, #seat-${seat} .seat-timer-wait`)
    if (el) {
      const isActive = state.turn === seat && state.phase === 'playing'
      el.outerHTML = isActive ? timerHtml : waitHtml
    }
  }
}

function patchHandSouth(): void {
  const el = document.getElementById('seat-south')
  if (el) {
    el.innerHTML = seatRenderers.south()
    setupCardEvents()
  }
}

function patchOverlays(): void {
  const resultEl = document.getElementById('result-overlay')
  if (resultEl) {
    const html = state.phase === 'finished' ? renderResultOverlay() : ''
    if (resultEl.innerHTML !== html) resultEl.innerHTML = html
  }

  const trackerEl = document.getElementById('tracker-overlay')
  if (trackerEl) {
    const html = trackerVisible ? renderTrackerOverlay() : ''
    if (trackerEl.innerHTML !== html) trackerEl.innerHTML = html
  }

  const dealEl = document.getElementById('deal-overlay')
  if (dealEl) {
    dealEl.innerHTML = isDealing ? renderDealOverlay() : ''
  }
}

// ===== 座位计时器 =====

function renderSeatTimer(_seat: SeatId): string {
  const timeLeft = getTimeLeft()
  const isUrgent = timeLeft < 10
  return `<span class="seat-timer ${isUrgent ? 'seat-timer--urgent' : 'seat-timer--active'}">${timeLeft}s</span>`
}

// ===== 各方位座位渲染 =====

function renderNorthSeat(): string {
  const player = state.players.north
  const isActive = state.turn === 'north'
  const cardCount = player.hand.length
  const visibleCards = Math.min(cardCount, 10)
  const cards = Array.from({ length: visibleCards }, () => renderBackCard('north')).join('')
  const timerHtml = isActive ? renderSeatTimer('north') : '<span class="seat-timer-wait">⏳</span>'
  // Phase 3: 剩余牌数颜色警示 + 队友标签
  const countColor = cardCount <= 2 ? 'color:#e74c3c;font-weight:800' : cardCount <= 5 ? 'color:#f5c542' : ''

  return `
    <section class="seat seat-north ${isActive ? 'active' : ''} ${player.finished ? 'finished' : ''}">
      <div class="seat-header">
        <div class="seat-avatar seat-avatar--teammate">
          <span class="seat-avatar__icon">${seatAvatar('north')}</span>
          <span class="seat-team-tag team-tag--ally">队友</span>
          ${timerHtml}
        </div>
        <div class="seat-profile">
          <strong>${player.name}</strong>
          <span style="${countColor}">${cardCount} 张${player.finished ? ' · 已出完' : ''}</span>
        </div>
      </div>
      <div class="hand hand-north">${cards}${cardCount > visibleCards ? `<span style="color:var(--muted);font-size:0.65rem;margin-left:4px">+${cardCount - visibleCards}</span>` : ''}</div>
    </section>
  `
}

function renderWestSeat(): string {
  const player = state.players.west
  const isActive = state.turn === 'west'
  const cardCount = player.hand.length
  const visibleCards = Math.min(cardCount, 8)
  const cards = Array.from({ length: visibleCards }, () => renderBackCard('west')).join('')
  const timerHtml = isActive ? renderSeatTimer('west') : '<span class="seat-timer-wait">⏳</span>'
  const countColor = cardCount <= 2 ? 'color:#e74c3c;font-weight:800' : cardCount <= 5 ? 'color:#f5c542' : ''

  return `
    <section class="seat seat-west ${isActive ? 'active' : ''} ${player.finished ? 'finished' : ''}">
      <div class="seat-header">
        <div class="seat-avatar seat-avatar--opponent">
          <span class="seat-avatar__icon">${seatAvatar('west')}</span>
          <span class="seat-team-tag team-tag--opp">对手</span>
          ${timerHtml}
        </div>
        <div class="seat-profile">
          <strong>${player.name}</strong>
          <span style="${countColor}">${cardCount} 张${player.finished ? ' · 已出完' : ''}</span>
        </div>
      </div>
      <div class="hand hand-west">${cards}${cardCount > visibleCards ? `<span style="color:var(--muted);font-size:0.6rem">+${cardCount - visibleCards}</span>` : ''}</div>
    </section>
  `
}

function renderEastSeat(): string {
  const player = state.players.east
  const isActive = state.turn === 'east'
  const cardCount = player.hand.length
  const visibleCards = Math.min(cardCount, 8)
  const cards = Array.from({ length: visibleCards }, () => renderBackCard('east')).join('')
  const timerHtml = isActive ? renderSeatTimer('east') : '<span class="seat-timer-wait">⏳</span>'
  const countColor = cardCount <= 2 ? 'color:#e74c3c;font-weight:800' : cardCount <= 5 ? 'color:#f5c542' : ''

  return `
    <section class="seat seat-east ${isActive ? 'active' : ''} ${player.finished ? 'finished' : ''}">
      <div class="seat-header">
        <div class="seat-avatar seat-avatar--opponent">
          <span class="seat-avatar__icon">${seatAvatar('east')}</span>
          <span class="seat-team-tag team-tag--opp">对手</span>
          ${timerHtml}
        </div>
        <div class="seat-profile">
          <strong>${player.name}</strong>
          <span style="${countColor}">${cardCount} 张${player.finished ? ' · 已出完' : ''}</span>
        </div>
      </div>
      <div class="hand hand-east">${cards}${cardCount > visibleCards ? `<span style="color:var(--muted);font-size:0.6rem">+${cardCount - visibleCards}</span>` : ''}</div>
    </section>
  `
}

function renderSouthSeat(): string {
  const player = state.players.south
  const isActive = state.turn === 'south'
  const sortedHand = getSouthSortedHand(player.hand)
  const cards = sortedHand.map((card) => renderSouthCard(card)).join('')
  const timerHtml = isActive ? renderSeatTimer('south') : '<span class="seat-timer-wait">⏳</span>'

  return `
    <section class="seat seat-south ${isActive ? 'active' : ''} ${player.finished ? 'finished' : ''}">
      <div class="seat-header">
        <div class="seat-avatar">
          <span class="seat-avatar__icon">${seatAvatar('south')}</span>
          ${timerHtml}
        </div>
        <div class="seat-profile">
          <strong>${player.name}</strong>
          <span>${player.hand.length} 张${player.finished ? ' · 已出完' : ''}</span>
        </div>
      </div>
      <div class="south-stage">
        <div class="south-play-slot">
          ${renderPlayZone('south')}
        </div>
        ${renderSouthControls()}
        <div class="hand-south-wrap">
          <div class="hand hand-south">${cards}</div>
        </div>
      </div>
    </section>
  `
}

// ===== 卡牌渲染 =====

function renderBackCard(seat: SeatId): string {
  return `
    <div class="card card-back card-back--${seat}">
      <span class="card-back__top">♠♥</span>
      <span class="card-back__mid">★</span>
      <span class="card-back__bot">♦♣</span>
    </div>
  `
}

function renderSouthCard(card: Card): string {
  const isRed = card.suit === 'heart' || card.suit === 'diamond'
  const selected = selectedCardIds.has(card.id)
  const toneClass = card.suit === 'joker' ? 'joker' : isRed ? 'red' : 'black'
  const isGroupGap = isGroupBoundary(card)
  const canDrag = state.phase === 'playing' && state.turn === 'south' && !state.players.south.finished
  const isLevelCard = card.rank === state.levelRank
  const beatHint = canBeatCard(card)
  const cornerText = card.suit === 'joker' ? card.label : `${card.rank}${isRed ? '♥' : '♠'}`

  return `
    <button type="button"
      class="card card-face ${toneClass} ${selected ? 'selected' : ''} ${canDrag ? 'draggable-card' : ''} ${isGroupGap ? 'group-gap' : ''} ${isLevelCard ? 'level-card' : ''} ${beatHint ? 'can-beat-hint' : ''}"
      data-card-id="${card.id}"
      draggable="${canDrag ? 'true' : 'false'}">
      <span class="card-corner card-corner--tl">${escapeHtml(cornerText)}</span>
      <span class="card-mid">${card.suit === 'joker' ? '🃏' : escapeHtml(card.label)}</span>
      <span class="card-corner card-corner--br">${escapeHtml(cornerText)}</span>
      ${isLevelCard ? '<span class="level-badge">级</span>' : ''}
    </button>
  `
}

function canBeatCard(card: Card): boolean {
  if (state.phase !== 'playing' || state.turn !== 'south') return false
  if (!state.trick.lastPlay) return false
  if (state.trick.lastPlay.type !== 'single') return false
  return card.rankValue > state.trick.lastPlay.primaryValue
}

function renderTrickCard(card: Card): string {
  const isRed = card.suit === 'heart' || card.suit === 'diamond'
  const toneClass = card.suit === 'joker' ? 'joker' : isRed ? 'red' : 'black'
  const cornerText = card.suit === 'joker' ? card.label : `${card.rank}${isRed ? '♥' : '♠'}`
  return `
    <div class="card card-face trick-card ${toneClass}">
      <span class="card-corner card-corner--tl">${escapeHtml(cornerText)}</span>
      <span class="card-mid">${card.suit === 'joker' ? '🃏' : escapeHtml(card.label)}</span>
      <span class="card-corner card-corner--br">${escapeHtml(cornerText)}</span>
    </div>
  `
}

// ===== 出牌区 =====

function renderPlayZone(seat: SeatId): string {
  const play = lastPlayBySeat[seat]
  if (!play) {
    return `<div class="play-zone play-zone--${seat} play-zone--empty">
      <span class="play-zone__label">${seatLabels[seat]}</span>
    </div>`
  }
  const cards = play.cards.map((c) => renderTrickCard(c)).join('')
  const isBomb = play.type === 'bomb' || play.type === 'rocket'
  const zoneClass = ['play-zone', `play-zone--${seat}`, 'play-zone--stack']
  if (isBomb) zoneClass.push('bomb-effect')
  const comboLabelHtml = `<div class="play-type-label combo-pop">${comboLabel(play.type)}</div>`
  return `
    <div class="${zoneClass.join(" ")}">
      <span class="play-zone__label">${seatLabels[seat]}</span>
      ${comboLabelHtml}
      <div class="play-zone__cards">${cards}</div>
    </div>
  `
}

// ===== 操作按钮 =====

function renderSouthControls(): string {
  const isPlaying = state.phase === 'playing' && state.turn === 'south' && !state.players.south.finished
  const hintDisabled = !isPlaying
  const playDisabledState = playDisabled()
  const passDisabledState = passDisabled()
  const clearDisabled = selectedCardIds.size === 0
  const sigDisabled = !isPlaying || signalCooldown

  return `
    <div class="south-controls">
      <div class="signal-bar">
        <button id="sig-help" class="signal-btn" type="button" ${sigDisabled ? 'disabled' : ''} title="求助">🆘</button>
        <button id="sig-pass" class="signal-btn" type="button" ${sigDisabled ? 'disabled' : ''} title="让过">⏭️</button>
        <button id="sig-bomb" class="signal-btn" type="button" ${sigDisabled ? 'disabled' : ''} title="要炸">💣</button>
        <button id="sig-run" class="signal-btn" type="button" ${sigDisabled ? 'disabled' : ''} title="要跑">🏃</button>
      </div>
      <button id="hint-btn" class="btn-hint" type="button" ${hintDisabled ? 'disabled' : ''}>提示</button>
      <button id="pass-btn" class="btn-pass" type="button" ${passDisabledState ? 'disabled' : ''}>不出</button>
      <button id="play-btn" class="btn-play-main" type="button" ${playDisabledState ? 'disabled' : ''}>出 牌</button>
      <div class="south-aux">
        <button id="clear-btn" class="btn-clear" type="button" ${clearDisabled ? 'disabled' : ''}>清空</button>
        <button id="fast-play-btn" class="btn-fast" type="button" ${hintDisabled ? 'disabled' : ''}>推荐</button>
      </div>
    </div>
  `
}

// ===== 状态信息 =====

function renderSelectionInfo(): string {
  if (state.turn !== 'south' || state.phase !== 'playing') {
    return ''
  }

  const cards = getSelectedCards()
  if (cards.length === 0) {
    return '<div class="selection-box muted">点击选牌 · 双击推荐 · 拖动出牌</div>'
  }

  const combo = detectCombo(cards, state.levelRank)
  if (!combo) {
    return '<div class="selection-box warn">当前选择不是合法牌型</div>'
  }

  if (state.trick.lastPlay && !canBeat(combo, state.trick.lastPlay)) {
    return `<div class="selection-box warn">${comboLabel(combo.type)} · 压不过上轮</div>`
  }

  return `<div class="selection-box good">${comboLabel(combo.type)} · 可出牌 ✓</div>`
}

function renderStatusMessage(): string {
  if (!statusMessage) return ''
  const cls = /合法|可出|推荐|提示|已自动/.test(statusMessage) ? 'good' : 'warn'
  return `<div class="selection-box ${cls}">${escapeHtml(statusMessage)}</div>`
}

// Phase 40: 出牌状态指示器
function renderPlayStatus(): string {
  if (state.phase === 'finished') return '<div class="play-status-indicator">🏆 对局结束</div>'
  if (state.phase !== 'playing') return ''

  const isMyTurn = state.turn === 'south'
  const hasLastPlay = state.trick.lastPlay !== null
  const isLeader = state.trick.leaderSeat === 'south' || (!hasLastPlay && state.turn === 'south')

  if (isLeader && !hasLastPlay) {
    return `<div class="play-status-indicator play-status--lead">${isMyTurn ? '✨ 你带头，出任意牌型' : `⏳ ${seatLabels[state.turn]}思考中...`}</div>`
  }
  if (isLeader && hasLastPlay) {
    return `<div class="play-status-indicator play-status--lead">${isMyTurn ? '✨ 新一轮，你带头' : `⏳ ${seatLabels[state.turn]}思考中...`}</div>`
  }
  if (hasLastPlay && state.trick.lastPlay) {
    const label = comboLabel(state.trick.lastPlay.type)
    return `<div class="play-status-indicator play-status--follow">${isMyTurn ? `⚠️ 压过 ${label}` : `⏳ ${seatLabels[state.turn]}思考中...`}</div>`
  }
  return `<div class="play-status-indicator play-status--wait">⏳ ${seatLabels[state.turn]}思考中...</div>`
}

// Phase 36: 报牌检测
function isReporting(): 'bao1' | 'bao2' | null {
  const southCards = state.players.south.hand.length
  if (southCards === 1) return 'bao1'
  if (southCards === 2) return 'bao2'
  return null
}

// Phase 36: 报牌浮字
let baoFloatShown = false

// Phase 24: 炸弹倍数系统
let currentMultiplier = 1
const MAX_MULTIPLIER = 64

function addBombMultiplier(): void {
  currentMultiplier = Math.min(currentMultiplier * 2, MAX_MULTIPLIER)
}

function renderMultiplier(): string {
  if (currentMultiplier <= 1) return '×1'
  return `×${currentMultiplier}`
}

// Phase 10: 级数进度条
function renderLevelProgress(): string {
  const lv = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
  const idx = lv.indexOf(state.gameLevel)
  const pct = Math.round(((idx + 1) / lv.length) * 100)
  return `<div class="level-progress"><div class="level-progress-bar" style="width:${pct}%"></div><span class="level-progress-text">${state.gameLevel}</span></div>`
}

// Phase 14: 对局统计
let statsBombsPlayed = 0
let statsMaxBombSize = 0
let statsCardsPlayed = 0

function resetGameStats(): void {
  statsBombsPlayed = 0
  statsMaxBombSize = 0
  statsCardsPlayed = 0
  currentMultiplier = 1
}

function recordPlayStats(cards: Card[], comboType: string): void {
  statsCardsPlayed += cards.length
  if (comboType === 'bomb' || comboType === 'rocket') {
    statsBombsPlayed++
    statsMaxBombSize = Math.max(statsMaxBombSize, cards.length)
    addBombMultiplier()
  }
}
function showBaoFloatIfNeeded(): void {
  const report = isReporting()
  if (report && !baoFloatShown) {
    baoFloatShown = true
    const el = document.createElement('div')
    el.className = 'bao-float'
    el.textContent = report === 'bao1' ? '🔔 报单！' : '🔔 报双！'
    document.querySelector('.table-board')?.appendChild(el)
    setTimeout(() => el.remove(), 2000)
  }
  if (!report) baoFloatShown = false
}

// ===== 结果浮层 =====

function renderResultOverlay(): string {
  if (!state.winnerTeam) return ''
  const winners = state.winnerTeam === 'northSouth' ? '南北队' : '东西队'
  const winnerClass = state.winnerTeam === 'northSouth' ? 'winner--ns' : 'winner--ew'
  const finishOrderHtml = state.finishOrder.map((seat, index) => {
    const remaining = state.players[seat].hand.length
    const medals = ['🥇', '🥈', '🥉', '']
    return `<li><strong>${medals[index] ?? ''} ${seatLabels[seat]}</strong> — ${remaining} 张剩余</li>`
  }).join('')

  // Phase 7: 级数变化（使用引擎函数计算实际升级数）
  const oldLevel = state.gameLevel
  const levelUpSteps = state.winnerTeam ? calculateLevelUp(state.finishOrder, state.winnerTeam) : 0
  const newLevel = state.winnerTeam ? advanceLevel(oldLevel, levelUpSteps) : oldLevel
  const levelLabel = levelUpSteps > 1 ? `(+${levelUpSteps})` : ''

  return `
    <div class="result-overlay">
      <div class="result-panel">
        <h2>🏆 对局结束</h2>
        <div class="result-banner">
          <span class="winner ${winnerClass}">${winners} 获胜！</span>
        </div>
        <div class="level-change">
          <span class="level-old">${oldLevel}</span>
          <span class="level-arrow">→</span>
          <span class="level-new">${newLevel} ${levelLabel}</span>
        </div>
        <div class="team-score-row">
          <span class="team-ns">南北：${state.players.north.hand.length === 0 && state.players.south.hand.length === 0 ? '全出完' : '未完'}</span>
          <span class="team-ew">东西：${state.players.east.hand.length === 0 && state.players.west.hand.length === 0 ? '全出完' : '未完'}</span>
        </div>
        <div>
          <h3 style="color:var(--muted);font-size:0.85rem;margin:0.5rem 0 0.3rem">出完顺序</h3>
          <ol class="finish-order">${finishOrderHtml}</ol>
        </div>
        <button id="quick-restart-btn" class="replay-btn quick-restart-btn" type="button">⚡ 再来一局</button>
        <button id="back-to-lobby-btn" class="replay-btn" type="button" style="background:linear-gradient(180deg,#607D8B,#455A64);margin-top:0.5rem;font-size:0.85rem">返回大厅</button>
      </div>
    </div>
  `
}

// ===== 辅助函数 =====

function seatAvatar(seat: SeatId): string {
  switch (seat) {
    case 'south': return '🐤'
    case 'north': return '👑'
    case 'east': return '🧢'
    case 'west': return '😎'
  }
}

function getSouthSortedHand(hand: Card[]): Card[] {
  // Bug #9: 使用缓存避免重复排序
  const cacheKey = hand.map(c => c.id).join(',')
  if (cachedSortedHandKey === cacheKey && cachedSortedHand) return cachedSortedHand

  const rankOrder = new Map<string, number>([
    ['2', 0],
    ['3', 1],
    ['4', 2],
    ['5', 3],
    ['6', 4],
    ['7', 5],
    ['8', 6],
    ['9', 7],
    ['10', 8],
    ['J', 9],
    ['Q', 10],
    ['K', 11],
    ['A', 12],
    ['SJ', 13],
    ['BJ', 14],
  ])

  const sorted = [...hand].sort((a, b) => {
    const aOrder = rankOrder.get(a.rank) ?? 100 + a.rankValue
    const bOrder = rankOrder.get(b.rank) ?? 100 + b.rankValue
    if (aOrder !== bOrder) return aOrder - bOrder
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit)
    return a.deckId - b.deckId || a.id.localeCompare(b.id)
  })

  cachedSortedHand = sorted
  cachedSortedHandKey = cacheKey
  return sorted
}

// Bug #9: 排序缓存
let cachedSortedHand: Card[] | null = null
let cachedSortedHandKey = ''

/** 判断牌是否是组间边界（腾讯掼蛋连续排序下保留视觉分组） */
function isGroupBoundary(card: Card): boolean {
  const sorted = getSouthSortedHand(state.players.south.hand)
  const idx = sorted.findIndex(c => c.id === card.id)
  if (idx === -1 || idx === sorted.length - 1) return false
  const next = sorted[idx + 1]
  if (card.rank !== next.rank) return true
  return false
}

function getSelectedCards(): Card[] {
  return state.players.south.hand.filter((card) => selectedCardIds.has(card.id))
}

function comboName(cards: Card[]): string {
  const combo = detectCombo(cards, state.levelRank)
  return combo ? comboLabel(combo.type) : `${cards.length} 张牌`
}

function comboLabel(type: string): string {
  switch (type) {
    case 'single': return '单张'
    case 'pair': return '对子'
    case 'triple': return '三张'
    case 'bomb': return '炸弹'
    case 'rocket': return '王炸'
    case 'straight': return '顺子'
    case 'pairStraight': return '连对'
    case 'tripleStraight': return '三顺'
    case 'tripleWithTwo': return '三带二'
    case 'tripleWithPair': return '三带对'
    case 'steel': return '钢板'
    default: return type
  }
}

function getTimeLeft(): number {
  const elapsed = Date.now() - state.turnStartedAt
  return Math.max(0, Math.ceil((state.turnTimeoutMs - elapsed) / 1000))
}

function playDisabled(): boolean {
  if (state.phase !== 'playing' || state.turn !== 'south' || state.players.south.finished) return true
  const cards = getSelectedCards()
  if (cards.length === 0) return true
  const combo = detectCombo(cards, state.levelRank)
  if (!combo) return true
  if (state.trick.lastPlay && !canBeat(combo, state.trick.lastPlay)) return true
  return false
}

function passDisabled(): boolean {
  if (state.phase !== 'playing' || state.turn !== 'south' || state.players.south.finished) return true
  return !state.trick.lastPlay && state.turn === state.openingStarter && !state.openingLeadCompleted
}

function validationMessage(): string {
  const cards = getSelectedCards()
  if (cards.length === 0) return selectionHint || ''
  const combo = detectCombo(cards, state.levelRank)
  if (!combo) return '当前选择不是合法牌型。'
  if (state.trick.lastPlay && !canBeat(combo, state.trick.lastPlay)) return '当前选择压不过上轮出牌。'
  return `当前选择：${comboLabel(combo.type)}，可出牌。`
}

// ===== 拖拽（已由 Pointer Events 替代，保留 drop 逻辑供调用） =====

function canDragCard(): boolean {
  return state.phase === 'playing' && state.turn === 'south' && !state.players.south.finished
}

// ===== 发牌动画遮罩 =====

function renderDealOverlay(): string {
  // 生成 108 张发牌动画卡牌（27×4）
  const seats: SeatId[] = ['south', 'west', 'north', 'east']
  const cards: string[] = []
  for (let i = 0; i < 27; i++) {
    for (const seat of seats) {
      const delay = cards.length * 10
      const dirClass = `deal-to-${seat}`
      cards.push(`<div class="deal-card ${dirClass}" style="animation-delay:${delay}ms"></div>`)
    }
  }
  return `
    <div class="deal-overlay">
      <div class="deal-pile">
        ${cards.join('')}
      </div>
      <div class="deal-text">发牌中...</div>
    </div>
  `
}

// ===== 过牌浮字 =====

function renderPassFloats(): string {
  return passFloats.map(f => {
    const posClass = `pass-float--${f.seat}`
    return `<div class="pass-float ${posClass}">${f.text}</div>`
  }).join('')
}

// ===== 记牌器浮层 =====

function renderTrackerOverlay(): string {
  const tracker = state.tracker
  const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王']
  const rankKeys = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', 'SJ', 'BJ']

  const cells = rankKeys.map((key, i) => {
    const remaining = tracker.total[key] - tracker.played[key]
    // Phase 38: 颜色编码
    let colorClass = 'tracker-cell--full'
    if (remaining <= 0) colorClass = 'tracker-cell--out'
    else if (remaining <= 1) colorClass = 'tracker-cell--low'
    else if (remaining <= 2) colorClass = 'tracker-cell--mid'
    const isLevelCard = key === state.levelRank
    return `<div class="tracker-cell ${colorClass} ${isLevelCard ? 'tracker-cell--level' : ''}">
      <div class="tracker-rank">${ranks[i]}${isLevelCard ? ' ⭐' : ''}</div>
      <div class="tracker-remaining">${remaining}</div>
    </div>`
  }).join('')

  return `
    <div class="tracker-overlay">
      <div class="tracker-panel">
        <div class="tracker-header">
          <h3>📋 记牌器</h3>
          <button id="tracker-close" class="tracker-close" type="button">×</button>
        </div>
        <div class="tracker-grid">${cells}</div>
        <div class="tracker-tip">🟢满 🟡少 🔴将尽 ⚪出完</div>
        <div class="tracker-tip">⭐ = 级牌 | 炸弹已出：${statsBombsPlayed}次</div>
      </div>
    </div>
  `
}

// ===== Pointer Events 替代 HTML5 DnD =====

function setupCardEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-card-id]').forEach((cardEl) => {
    const cardId = cardEl.dataset.cardId ?? ''
    let startY = 0
    let startX = 0
    let isDragging = false
    let lastClickTime = 0

    cardEl.addEventListener('pointerdown', (e) => {
      if (!canDragCard()) return
      startY = e.clientY
      startX = e.clientX
      cardEl.setPointerCapture(e.pointerId)
    })

    cardEl.addEventListener('pointermove', (e) => {
      if (!canDragCard()) return
      const dy = startY - e.clientY
      const dx = Math.abs(e.clientX - startX)
      if (!isDragging && dy > 20 && dx < 50) {
        isDragging = true
        cardEl.classList.add('card--dragging')
      }
      if (isDragging) {
        cardEl.style.transform = `translateY(${e.clientY - startY}px) scale(1.05)`
        cardEl.style.opacity = '0.8'
        cardEl.style.zIndex = '100'
      }
    })

    cardEl.addEventListener('pointerup', (e) => {
      cardEl.style.transform = ''
      cardEl.style.opacity = ''
      cardEl.style.zIndex = ''
      cardEl.classList.remove('card--dragging')

      if (isDragging) {
        isDragging = false
        // 检测是否拖到出牌区上方
        const target = document.elementFromPoint(e.clientX, e.clientY)
        if (target?.closest('.center-area, .play-zone--south')) {
          handleDropPlay(cardId)
        }
        return
      }

      // 双击检测
      const now = Date.now()
      if (now - lastClickTime < 350) {
        onCardDoubleClick(cardId)
        lastClickTime = 0
      } else {
        onCardToggle(cardId)
        lastClickTime = now
      }
    })

    cardEl.addEventListener('pointercancel', () => {
      cardEl.style.transform = ''
      cardEl.style.opacity = ''
      cardEl.style.zIndex = ''
      cardEl.classList.remove('card--dragging')
      isDragging = false
    })
  })
}

function handleDropPlay(cardId: string): void {
  const player = state.players.south
  if (state.phase !== 'playing' || state.turn !== 'south' || player.finished) return

  const draggedCard = player.hand.find((c) => c.id === cardId)
  if (!draggedCard) {
    statusMessage = '拖拽无效。'
    render()
    return
  }

  // Bug #2: 以用户拖的牌为准，找包含该牌的推荐牌型
  const recommended = chooseRecommendedCombo(player.hand, state.trick.lastPlay, state)
  if (!recommended || !recommended.cards.some((c) => c.id === cardId)) {
    statusMessage = '拖拽的牌不在推荐牌型中。'
    render()
    return
  }

  selectedCardIds = new Set(recommended.cards.map((item) => item.id))

  // 单张或拖拽牌正好是整个牌型 → 直接出牌
  if (recommended.type === 'single' || recommended.cards.length === 1 || recommended.cards.every(c => c.id === cardId)) {
    const prevLeader = state.trick.leaderSeat
    const result = playHumanCards(state, recommended.cards)
    if (!result.ok) {
      statusMessage = result.message ?? '拖拽出牌失败。'
      render()
      return
    }
    selectedCardIds = new Set()
    statusMessage = `拖拽出牌：${comboLabel(recommended.type)}。`
    playSound('play')
    updatePlayBySeat(prevLeader)
    render()
    scheduleNextTick()
    return
  }

  // 非单张 → 预选让用户确认
  selectionHint = `拖拽预选：${comboLabel(recommended.type)}。`
  statusMessage = `已预选：${comboLabel(recommended.type)}。`
  playSound('click')
  render()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
