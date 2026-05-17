import type { Direction, GameMode, GameState, OnlineConnectionState, OnlineRoomSnapshot, GameStats } from './types';
import { Game } from './game/Game';
import { Snake } from './game/Snake';
import { FoodManager } from './game/FoodManager';
import { CanvasRenderer } from './renderer/CanvasRenderer';
import { InputHandler } from './input/InputHandler';
import { UIManager } from './ui/UIManager';
import { AudioManager } from './audio/AudioManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT, ONLINE_JOIN_CODE_KEY, ONLINE_MAX_PLAYERS, ONLINE_TICK_MS, ONLINE_WS_PATH } from './config/constants';
import { addXp, getProgress, getEquippedSkin, getXpForLevel, getTodayTasks, updateTaskProgress } from './game/Progression';
import { saveScoreRecord, getScoreHistory, recordGhostFrame, saveGhost, drawScoreChart } from './game/GhostRecorder';
import type { Point } from './types';

// ── 类型 ──
interface OnlinePlayerView {
  playerId: string; socketId: string; nickname: string; seat: number;
  color: 'green' | 'red' | 'blue' | 'yellow'; ready: boolean; alive: boolean;
  score: number; direction: Direction; body: Point[]; disconnected: boolean;
}
interface OnlineSnapshotView {
  roomId: string; hostPlayerId: string; phase: 'waiting' | 'countdown' | 'playing' | 'ended';
  tick: number; countdownEndsAt: number | null; winnerPlayerId: string | null;
  message: string; foods: Point[]; players: OnlinePlayerView[];
}

function main(): void {
  // ── DOM ──
  const $ = (id: string) => document.getElementById(id);
  const entryScreen = $('entry-screen');
  const singleScreen = $('single-screen');
  const onlineScreen = $('online-screen');
  const canvas = $('game-canvas') as HTMLCanvasElement | null;
  const onlineCanvas = $('online-canvas') as HTMLCanvasElement | null;

  if (!canvas || !onlineCanvas) { console.error('canvas not found'); return; }

  // 设置 canvas 实际尺寸
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  onlineCanvas.width = CANVAS_WIDTH;
  onlineCanvas.height = CANVAS_HEIGHT;

  // ── 游戏对象（单机） ──
  const game = new Game();
  const renderer = new CanvasRenderer(canvas);
  const input = new InputHandler();
  const ui = new UIManager();
  const audio = new AudioManager();
  let currentMode: GameMode = 'classic';

  // ── 联机状态 ──
  let ws: WebSocket | null = null;
  let heartbeatTimer: number | null = null;
  let reconnectTimer: number | null = null;
  const tabSessionId = sessionStorage.getItem('snake_tab_sid') || (() => {
    const sid = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('snake_tab_sid', sid);
    return sid;
  })();
  let onlineState: OnlineConnectionState = {
    socketId: null, roomId: null, playerId: null, token: null,
    connected: false, phase: 'waiting', error: null,
  };
  let onlineSnapshot: OnlineSnapshotView | null = null;
  let matching = false;
  let matchTimerInterval: number | null = null;
  let matchStartMs = 0;
  let onlineRenderLoop: number | null = null;

  // ── 入口统计 ──
  function updateEntryStats(): void {
    const highScore = Number(localStorage.getItem('snake_high_score') || '0');
    const todayKey = 'snake_today_' + new Date().toISOString().slice(0, 10);
    const todayGames = Number(localStorage.getItem(todayKey) || '0');
    const hs = $('entry-high-score');
    const tg = $('entry-today-games');
    if (hs) hs.textContent = String(highScore);
    if (tg) tg.textContent = String(todayGames);
  }

  function recordGamePlayed(): void {
    const todayKey = 'snake_today_' + new Date().toISOString().slice(0, 10);
    const cur = Number(localStorage.getItem(todayKey) || '0');
    localStorage.setItem(todayKey, String(cur + 1));
  }

  // ── Phase 14: 设置面板 ──
  function initSettings(): void {
    const settingsBtn = $('settings-btn');
    const settingsOverlay = $('settings-overlay');
    const settingsClose = $('settings-close');
    const sfxSlider = $('setting-sfx') as HTMLInputElement | null;
    const bgmSlider = $('setting-bgm') as HTMLInputElement | null;
    const hapticCheck = $('setting-haptic') as HTMLInputElement | null;

    // Load saved settings
    const savedTheme = localStorage.getItem('snake_theme') || 'default';
    const savedSfx = localStorage.getItem('snake_sfx_volume');
    const savedBgm = localStorage.getItem('snake_bgm_volume');
    const savedHaptic = localStorage.getItem('snake_haptic');

    if (savedTheme !== 'default') document.body.className = `theme-${savedTheme}`;
    if (savedSfx && sfxSlider) sfxSlider.value = savedSfx;
    if (savedBgm && bgmSlider) bgmSlider.value = savedBgm;
    if (savedHaptic !== null && hapticCheck) hapticCheck.checked = savedHaptic === '1';

    // Highlight active theme swatch
    document.querySelectorAll('.theme-swatch').forEach(s => {
      s.classList.toggle('active', s.getAttribute('data-theme') === savedTheme);
    });

    settingsBtn?.addEventListener('click', () => settingsOverlay?.classList.remove('hidden'));
    settingsClose?.addEventListener('click', () => settingsOverlay?.classList.add('hidden'));

    // Theme switching
    document.querySelectorAll('.theme-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const theme = swatch.getAttribute('data-theme') || 'default';
        document.body.className = theme === 'default' ? '' : `theme-${theme}`;
        localStorage.setItem('snake_theme', theme);
        document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s === swatch));
      });
    });

    // Volume sliders
    sfxSlider?.addEventListener('input', () => {
      localStorage.setItem('snake_sfx_volume', sfxSlider.value);
      audio.setVolume('sfx', Number(sfxSlider.value) / 100);
    });
    bgmSlider?.addEventListener('input', () => {
      localStorage.setItem('snake_bgm_volume', bgmSlider.value);
      audio.setVolume('bgm', Number(bgmSlider.value) / 100);
    });
    hapticCheck?.addEventListener('change', () => {
      localStorage.setItem('snake_haptic', hapticCheck.checked ? '1' : '0');
    });
  }

  // ── Phase 7: 新手引导 ──
  function initTutorial(): void {
    if (localStorage.getItem('snake_tutorial_done')) return;
    const overlay = $('tutorial-overlay');
    const slides = document.querySelectorAll('.tutorial-slide');
    const dots = document.querySelectorAll('.tutorial-dot');
    const nextBtn = $('tutorial-next');
    const skipBtn = $('tutorial-skip');
    let currentSlide = 0;

    function showSlide(idx: number): void {
      slides.forEach((s, i) => s.classList.toggle('active', i === idx));
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      if (nextBtn) nextBtn.textContent = idx === slides.length - 1 ? '开始游戏' : '下一步';
    }

    function closeTutorial(): void {
      overlay?.classList.add('hidden');
      localStorage.setItem('snake_tutorial_done', '1');
    }

    nextBtn?.addEventListener('click', () => {
      if (currentSlide < slides.length - 1) {
        currentSlide++;
        showSlide(currentSlide);
      } else {
        closeTutorial();
      }
    });

    skipBtn?.addEventListener('click', closeTutorial);

    overlay?.classList.remove('hidden');
    showSlide(0);
  }

  // ── Phase 11: Toast 通知 ──
  function showToast(message: string, duration = 2000): void {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ── 图例面板 ──
  const legendBtn = $('legend-btn');
  const legendPanel = $('legend-panel');
  const legendClose = $('legend-close');
  legendBtn?.addEventListener('click', () => {
    legendPanel?.classList.toggle('hidden');
  });
  legendClose?.addEventListener('click', () => {
    legendPanel?.classList.add('hidden');
  });

  // ── 匹配提示轮播 ──
  const MATCH_TIPS = [
    '💡 使用方向键控制蛇移动',
    '💡 吃到金色食物得 3 分',
    '💡 技能卡可以在危机时救命',
    '💡 迷宫模式要注意障碍物',
    '💡 双蛇模式可以互相配合',
    '💡 在线对战中撞到对手身体也会死',
    '💡 造物主模式留下的轨迹会变成墙壁',
  ];
  let matchTipIdx = 0;
  let matchTipTimer: number | null = null;
  function startMatchTips(): void {
    const el = $('match-tip-text');
    if (!el) return;
    matchTipIdx = 0;
    el.textContent = MATCH_TIPS[0];
    matchTipTimer = window.setInterval(() => {
      matchTipIdx = (matchTipIdx + 1) % MATCH_TIPS.length;
      el.textContent = MATCH_TIPS[matchTipIdx];
    }, 3000);
  }
  function stopMatchTips(): void {
    if (matchTipTimer) { clearInterval(matchTipTimer); matchTipTimer = null; }
  }

  // ── 画面切换 ──
  function showScreen(id: 'entry' | 'single' | 'online'): void {
    entryScreen?.classList.toggle('hidden', id !== 'entry');
    singleScreen?.classList.toggle('hidden', id !== 'single');
    onlineScreen?.classList.toggle('hidden', id !== 'online');
    if (id === 'entry') updateEntryStats();
    if (id !== 'single') legendPanel?.classList.add('hidden');
  }

  // ── 入口按钮 ──
  $('entry-single-btn')?.addEventListener('click', () => {
    showScreen('single');
    game.setMode(currentMode);
    renderSinglePlayer();
  });

  $('entry-online-btn')?.addEventListener('click', () => {
    showScreen('online');
    connectOnlineSocket();
    showOnlineLobby();
  });

  $('back-to-entry-from-single')?.addEventListener('click', () => {
    game.pause?.();
    showScreen('entry');
  });

  $('back-to-entry-from-online')?.addEventListener('click', () => {
    stopOnlineSocket();
    showScreen('entry');
  });

  // ══════════════════════════════════
  // 单机模式
  // ══════════════════════════════════
  ui.updateHighScore(game.primaryScore.highScore);
  ui.setActiveMode(currentMode);

  let lastScore = 0;
  function renderSinglePlayer(): void {
    renderer.updateEffects();
    renderer.clear();
    // Phase 20: 大逃杀边界
    if (currentMode === 'royale' && game.currentRoyaleBorder > 0) {
      renderer.drawRoyaleBorder(game.currentRoyaleBorder);
    }
    renderer.drawObstacles(game.mazeRef);
    renderer.drawTrailWalls(game.trailWallsRef);
    renderer.drawFoods(game.foodManagerRef);
    const snakes = game.snakeRefs;
    for (let i = 0; i < snakes.length; i++) {
      renderer.drawSnake(snakes[i], i === 0 ? game.primaryEffects : undefined, i === 1);
    }
    if (game.isTimeStopped) renderer.drawTimeStopOverlay();
    // Phase 23: 幽灵蛇
    if (snakes.length > 0) recordGhostFrame(snakes[0].head);
    renderer.finishFrame();
  }

  game.bindRender(renderSinglePlayer);
  game.bindScoreChange((p, s) => {
    // Phase 6: 粒子 + 弹出文字
    if (p > lastScore) {
      const head = game.primarySnake.head;
      const px = head.x * 24 + 12;
      const py = head.y * 24 + 12;
      renderer.particles.emit(px, py, '#ff6b6b', 6);
      renderer.popups.add(px, py - 10, `+${p - lastScore}`, '#ffd93d');
      lastScore = p;
    } else {
      lastScore = p;
    }
    ui.updateScore(p); ui.updateDualScore(p, s);
  });
  game.bindSpeedChange(l => {
    ui.updateSpeed(l);
    if (l > 1) showToast(`<span class="toast-speed">⚡ 速度提升到 ${l} 级</span>`);
  });
  game.bindEffectChange(effects => ui.updateEffects(effects));
  game.bindSkillChange((cards, active) => ui.updateSkillSlots(cards, active));
  game.bindSkillGranted(() => {});
  // Phase 20: 限时模式倒计时
  game.bindTimerTick(remaining => {
    ui.updateTimer(remaining);
  });
  // Phase 20: 大逃杀边界
  game.bindBorderChange(border => {
    ui.updateBorder(border);
    // 刷新渲染以显示边界
    renderSinglePlayer();
  });
  // Phase 9: 音效增强
  game.bindSound(name => {
    if (name === 'collision') {
      audio.playCollision();
    } else if (name === 'special') {
      audio.playSkillSound();
    } else {
      audio.play(name as any);
    }
  });
  game.bindGameOver(stats => {
    renderer.flash();
    renderer.shake(8);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    // Phase 23: 保存得分记录 + 幽灵蛇
    saveScoreRecord(stats.score, currentMode);
    saveGhost();
    // Phase 20: 隐藏模式指示器
    ui.hideTimer();
    ui.hideBorder();
    renderSinglePlayer();
    const gameOverMsg = currentMode === 'timelimit' ? '⏱️ 时间到！按 空格键 或 点击按钮 重新开始' : '游戏结束！按 空格键 或 点击按钮 重新开始';
    setTimeout(() => {
      ui.updateHighScore(game.primaryScore.highScore);
      showGameStatsPanel(stats, gameOverMsg);
    }, 300);
  });
  game.bindWin(stats => {
    ui.updateHighScore(game.primaryScore.highScore);
    ui.hideTimer();
    ui.hideBorder();
    showGameStatsPanel(stats, '🎉 恭喜通关！你赢了！');
    renderSinglePlayer();
  });

  /** Phase 2: 显示游戏统计面板 */
  function showGameStatsPanel(stats: GameStats, message: string): void {
    const durStr = stats.duration < 60 ? `${stats.duration}s` : `${Math.floor(stats.duration/60)}m${stats.duration%60}s`;
    const newRecordHTML = stats.isNewRecord ? '<div class="stats-record">🏆 新纪录！</div>' : '';

    // Phase 22: 成长系统
    const oldProgress = getProgress();
    const newProgress = addXp(stats.score, stats.duration, false);
    const xpGained = newProgress.xp - oldProgress.xp;
    const levelUp = newProgress.level > oldProgress.level;
    const nextXp = getXpForLevel(newProgress.level + 1);
    const xpPercent = Math.min(100, Math.floor((newProgress.xp / nextXp) * 100));
    const levelHTML = `
      <div class="stats-xp">
        <span class="xp-gain">+${xpGained} XP</span>
        ${levelUp ? '<span class="xp-levelup">⬆ 升级！</span>' : ''}
        <div class="xp-bar"><div class="xp-fill" style="width:${xpPercent}%"></div></div>
        <span class="xp-level">Lv.${newProgress.level}</span>
      </div>`;

    // Phase 22: 每日任务
    const tasks = getTodayTasks();
    const tasksHTML = tasks.filter(t => !t.completed).slice(0, 2).map(t =>
      `<div class="task-item"><span>${t.task.desc}</span><span>${Math.min(t.progress, t.task.target)}/${t.task.target}</span></div>`
    ).join('');

    // Phase 23: 得分折线图
    const history = getScoreHistory();
    const chartHTML = history.length >= 2 ? '<canvas id="score-chart" width="280" height="80"></canvas>' : '';

    ui.showCustomOverlay(`
      <div class="stats-panel">
        <div class="stats-score">${stats.score}</div>
        <div class="stats-label">得分</div>
        ${newRecordHTML}
        ${levelHTML}
        <div class="stats-grid">
          <div class="stat-item"><div class="stat-value">${durStr}</div><div class="stat-name">存活时间</div></div>
          <div class="stat-item"><div class="stat-value">${stats.foodsEaten}</div><div class="stat-name">吃食物</div></div>
          <div class="stat-item"><div class="stat-value">${stats.maxSpeed}</div><div class="stat-name">最高速度</div></div>
          <div class="stat-item"><div class="stat-value">${stats.skillsUsed}</div><div class="stat-name">使用技能</div></div>
        </div>
        ${chartHTML}
        ${tasksHTML ? `<div class="stats-tasks">${tasksHTML}</div>` : ''}
        <div class="stats-actions">
          <button class="stats-share-btn" id="stats-share">📤 分享战绩</button>
        </div>
        <p class="stats-message">${message}</p>
        <button class="stats-restart-btn" id="stats-restart">再来一局</button>
      </div>
    `);

    // Phase 23: 绘制折线图
    if (history.length >= 2) {
      const chartCanvas = document.getElementById('score-chart') as HTMLCanvasElement | null;
      if (chartCanvas) {
        const chartCtx = chartCanvas.getContext('2d');
        if (chartCtx) drawScoreChart(chartCtx, 0, 0, 280, 80);
      }
    }

    // Update task progress
    updateTaskProgress('eat50', stats.foodsEaten);
    updateTaskProgress('score100', stats.score);
    updateTaskProgress('play3', 1);
    updateTaskProgress('survive60', stats.duration);
    updateTaskProgress('useSkill5', stats.skillsUsed);

    document.getElementById('stats-restart')?.addEventListener('click', () => startSingleGame());
    document.getElementById('stats-share')?.addEventListener('click', () => {
      const text = `🐍 贪吃蛇大作战\n🏆 得分: ${stats.score}\n⏱️ 存活: ${durStr}\n🍎 吃食物: ${stats.foodsEaten}\n⚡ 最高速度: ${stats.maxSpeed}\n🎯 使用技能: ${stats.skillsUsed}\n📊 Lv.${newProgress.level}`;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('stats-share');
        if (btn) btn.textContent = '✅ 已复制！';
      }).catch(() => {});
    });
  }

  // 检测当前是否在联机画面
  function isInOnline(): boolean { return !onlineScreen?.classList.contains('hidden'); }

  input.bindDirection(dir => {
    if (isInOnline() && onlineState.roomId) {
      sendWs({ type: 'input', data: { dir } });
    } else {
      game.setDirection(dir);
    }
  });
  input.bindSkill(slot => game.useSkill(slot));
  input.bindPause(() => {
    if (game.state === 'IDLE' || game.state === 'GAME_OVER' || game.state === 'WIN') {
      startSingleGame();
    } else {
      game.togglePause();
      if (game.state === 'PAUSED') ui.showPause(); else ui.hidePause();
    }
  });

  function startSingleGame(): void {
    ui.hideMenu(); ui.hidePause();
    game.setMode(currentMode); game.start();
    lastScore = 0;
    audio.resetNoteIndex();
    ui.hideTimer();
    ui.hideBorder();
    renderSinglePlayer();
    recordGamePlayed();
  }

  ui.onStart(startSingleGame);
  ui.onModeChange(mode => {
    if (mode === 'online') return;
    currentMode = mode;
    ui.setActiveMode(mode);
    game.setMode(mode);
    renderSinglePlayer();
  });
  ui.onMuteToggle(() => { audio.toggleMute(); ui.setMuted(audio.muted); });

  // D-pad & skill buttons
  document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const dir = (btn as HTMLElement).dataset.dir;
      if (!dir) return;
      if (isInOnline() && onlineState.roomId) {
        sendWs({ type: 'input', data: { dir } });
      } else {
        game.setDirection(dir);
      }
    });
  });
  const dpadPause = $('dpad-pause');
  dpadPause?.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    if (game.state === 'IDLE' || game.state === 'GAME_OVER' || game.state === 'WIN') startSingleGame();
    else { game.togglePause(); if (game.state === 'PAUSED') ui.showPause(); else ui.hidePause(); }
  });
  document.querySelectorAll('.skill-btn[data-skill]').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      game.useSkill(Number((btn as HTMLElement).dataset.skill));
    });
  });

  // Canvas resize
  function resizeCanvas(target: HTMLCanvasElement): void {
    const isMobile = window.innerWidth <= 600 || window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile) { target.style.width = ''; target.style.height = ''; return; }
    const maxW = window.innerWidth - 16, maxH = window.innerHeight * 0.48;
    const ratio = CANVAS_HEIGHT / CANVAS_WIDTH;
    let w = maxW, h = w * ratio;
    if (h > maxH) { h = maxH; w = h / ratio; }
    target.style.width = `${Math.floor(w)}px`;
    target.style.height = `${Math.floor(h)}px`;
  }
  resizeCanvas(canvas);
  resizeCanvas(onlineCanvas);
  window.addEventListener('resize', () => { resizeCanvas(canvas); resizeCanvas(onlineCanvas); });

  // ══════════════════════════════════
  // 联机模式
  // ══════════════════════════════════
  const onlineNickEl = $('online-nickname') as HTMLInputElement | null;
  const onlineRoomIdEl = $('online-room-id') as HTMLInputElement | null;
  const onlineMatchBtn = $('online-match-btn');
  const onlineCancelMatchBtn = $('online-cancel-match-btn');
  const matchingOverlay = $('matching-overlay');
  const matchTimerEl = $('match-timer');
  const matchHintEl = $('match-hint');
  const onlineLobby = $('online-lobby');
  const onlineRoomPanel = $('online-room-panel');
  const onlineRoomHeader = $('online-room-header');
  const onlineRoomPhaseEl = $('online-room-phase');
  const onlineRoomTipEl = $('online-room-tip');
  const onlineStatusEl = $('online-status');
  const onlineRoomInfoEl = $('online-room-info');
  const onlineCreateBtn = $('online-create-btn');
  const onlineJoinBtn = $('online-join-btn');
  const onlineReadyBtn = $('online-ready-btn');
  const onlineStartBtn = $('online-start-btn');
  const onlineLeaveBtn = $('online-leave-btn');

  function sendWs(payload: { type: string; data?: unknown }): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer !== null) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }
  function startHeartbeat(): void {
    stopHeartbeat();
    heartbeatTimer = window.setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) sendWs({ type: 'ping' });
    }, 20_000);
  }

  function saveStoredJoinState(): void {
    if (!onlineState.roomId || !onlineState.playerId || !onlineState.token) return;
    localStorage.setItem(ONLINE_JOIN_CODE_KEY + '_' + tabSessionId, JSON.stringify({ roomId: onlineState.roomId, playerId: onlineState.playerId, token: onlineState.token }));
  }
  function readStoredJoinState(): { roomId: string; playerId: string; token: string } | null {
    try { const r = localStorage.getItem(ONLINE_JOIN_CODE_KEY + '_' + tabSessionId); return r ? JSON.parse(r) : null; } catch { return null; }
  }
  function clearStoredJoinState(): void {
    localStorage.removeItem(ONLINE_JOIN_CODE_KEY + '_' + tabSessionId);
  }

  function setOnlineStatus(text: string): void { if (onlineStatusEl) onlineStatusEl.textContent = text; }
  function setOnlineRoomInfo(text: string): void {
    if (!onlineRoomInfoEl) return;
    onlineRoomInfoEl.textContent = text;
    onlineRoomInfoEl.style.display = '';
  }

  function showOnlineLobby(): void {
    onlineLobby?.classList.remove('hidden');
    matchingOverlay?.classList.add('hidden');
    onlineRoomPanel?.classList.add('hidden');
    if (onlineRoomPhaseEl) onlineRoomPhaseEl.textContent = '房间待机';
    if (onlineRoomTipEl) onlineRoomTipEl.textContent = '输入昵称后可快速匹配，或创建/加入房间后点击准备开始。';
    clearOnlineCanvas();
    drawOnlineText('联机对战');
  }

  function clearOnlineCanvas(): void {
    const ctx = onlineCanvas?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  function drawOnlineText(text: string): void {
    const ctx = onlineCanvas?.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.restore();
  }

  // ── WS 连接 ──
  function connectOnlineSocket(): void {
    stopOnlineSocket();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}${ONLINE_WS_PATH}`;
    ws = new WebSocket(url);
    onlineState.connected = false;
    setOnlineStatus('正在连接...');

    ws.onopen = () => {
      onlineState.connected = true;
      setOnlineStatus('已连接');
      startHeartbeat();
      const cached = readStoredJoinState();
      if (cached) sendWs({ type: 'reconnect', data: cached });
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as { type: string; data?: any };
      switch (msg.type) {
        case 'connected':
          onlineState.socketId = msg.data?.socketId ?? null;
          break;
        case 'room_joined':
        case 'match_found':
          handleRoomJoined(msg.data, msg.type === 'match_found');
          break;
        case 'match_queued':
          setOnlineStatus(`匹配队列中 #${msg.data?.position ?? '?'}`);
          break;
        case 'match_bot_joined':
          setOnlineStatus(`🤖 ${msg.data?.message ?? '机器人已加入'}`);
          break;
        case 'match_cancelled':
          stopMatchingUI();
          setOnlineStatus('已取消匹配');
          showOnlineLobby();
          break;
        case 'room_state':
        case 'game_state':
          updateOnlineSnapshot(msg.data);
          break;
        case 'game_start':
          onlineState.phase = 'playing';
          setOnlineStatus('🎮 对局开始！');
          break;
        case 'game_over':
          onlineState.phase = 'ended';
          setOnlineStatus('对局结束');
          updateOnlineSnapshot(msg.data);
          // Phase 8: 显示再来一局按钮
          showRematchOption();
          break;
        case 'rematch_start':
          // Phase 8: 再来一局开始
          onlineState.phase = 'countdown';
          setOnlineStatus('🔄 再来一局！倒计时中...');
          updateOnlineSnapshot(msg.data?.room);
          break;
        case 'spectate_joined':
          // Phase 8: 观战模式
          onlineState.roomId = msg.data?.roomId ?? msg.data?.room?.roomId ?? null;
          onlineState.playerId = msg.data?.playerId ?? null;
          onlineState.token = msg.data?.token ?? null;
          onlineState.phase = msg.data?.room?.phase ?? 'playing';
          setOnlineStatus(`👁️ 观战中 · 房间 ${onlineState.roomId}`);
          updateOnlineSnapshot(msg.data?.room);
          showOnlineRoom(msg.data?.room);
          break;
        case 'pong': break;
        case 'error':
          setOnlineStatus('⚠️ ' + String(msg.data?.message ?? '错误'));
          break;
      }
    };

    ws.onclose = () => {
      onlineState.connected = false;
      stopHeartbeat();
      if (onlineState.roomId) {
        setOnlineStatus('连接断开，重连中...');
        reconnectTimer = window.setTimeout(connectOnlineSocket, 1500);
      }
    };
    ws.onerror = () => { setOnlineStatus('连接错误'); };
  }

  function stopOnlineSocket(): void {
    stopHeartbeat();
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    stopOnlineRenderLoop();
    if (ws) { try { ws.close(); } catch {} ws = null; }
  }

  function handleRoomJoined(data: any, isMatchFound: boolean): void {
    stopMatchingUI();
    const room = data?.room ?? null;
    onlineState.roomId = data?.roomId ?? room?.roomId ?? null;
    onlineState.playerId = data?.playerId ?? null;
    onlineState.token = data?.token ?? null;
    onlineState.phase = room?.phase ?? 'waiting';
    saveStoredJoinState();
    setOnlineStatus(isMatchFound ? `✅ 匹配成功！房间 ${onlineState.roomId}` : `已进入房间 ${onlineState.roomId}`);
    updateOnlineSnapshot(room);
    // Phase 8: 分享链接
    if (data?.shareUrl) handleRoomShare(data.shareUrl, onlineState.roomId ?? '');
    showOnlineRoom(room);
  }

  function showOnlineRoom(snapshot?: OnlineSnapshotView): void {
    onlineLobby?.classList.add('hidden');
    matchingOverlay?.classList.add('hidden');
    onlineRoomPanel?.classList.remove('hidden');
    if (onlineScreen) onlineScreen.classList.remove('hidden');
    if (snapshot && onlineRoomHeader) {
      onlineRoomHeader.textContent = `房间 ${snapshot.roomId} · ${snapshot.players.length}/${ONLINE_MAX_PLAYERS} · ${snapshot.phase}`;
    }
    if (onlineRoomPhaseEl) {
      const phaseText = snapshot?.phase === 'waiting' ? '房间待机' : snapshot?.phase === 'countdown' ? '倒计时中' : snapshot?.phase === 'playing' ? '游戏进行中' : snapshot?.phase === 'ended' ? '对局结束' : '房间中';
      onlineRoomPhaseEl.textContent = phaseText;
    }
    if (onlineRoomTipEl) {
      onlineRoomTipEl.textContent = snapshot?.phase === 'waiting' ? '进入房间后请先点击“准备”，房主可点击“开始”发起对局。' : snapshot?.phase === 'countdown' ? '倒计时开始，准备好进入战斗。' : snapshot?.phase === 'playing' ? '游戏开始，使用方向键控制你的蛇。' : snapshot?.phase === 'ended' ? '对局结束，可返回大厅或点击再来一局。' : '房间已连接。';
    }
    startOnlineRenderLoop();
  }

  // ── 联机渲染（60fps + 插值平滑） ──
  let prevSnapshot: OnlineSnapshotView | null = null;
  let snapshotAt = 0;
  const TICK_MS_DISPLAY = 350;

  function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

  function updateOnlineSnapshot(snapshot?: OnlineSnapshotView): void {
    if (!snapshot) return;
    prevSnapshot = onlineSnapshot;
    onlineSnapshot = snapshot;
    snapshotAt = performance.now();
    setOnlineRoomInfo(`房间: ${snapshot.roomId} · ${snapshot.phase} · 玩家: ${snapshot.players.length}/${ONLINE_MAX_PLAYERS} · ${snapshot.message}`);
    if (onlineRoomPhaseEl) {
      const phaseText = snapshot.phase === 'waiting' ? '房间待机' : snapshot.phase === 'countdown' ? '倒计时中' : snapshot.phase === 'playing' ? '游戏进行中' : snapshot.phase === 'ended' ? '对局结束' : '房间中';
      onlineRoomPhaseEl.textContent = phaseText;
    }
    if (onlineRoomTipEl) {
      onlineRoomTipEl.textContent = snapshot.phase === 'waiting' ? '进入房间后请先点击“准备”，房主可点击“开始”发起对局。' : snapshot.phase === 'countdown' ? '倒计时开始，准备好进入战斗。' : snapshot.phase === 'playing' ? '游戏开始，使用方向键控制你的蛇。' : snapshot.phase === 'ended' ? '对局结束，可返回大厅或点击再来一局。' : '房间已连接。';
    }
    if (onlineRoomHeader) {
      onlineRoomHeader.textContent = `房间 ${snapshot.roomId} · ${snapshot.players.length}/${ONLINE_MAX_PLAYERS} · ${snapshot.phase}`;
    }
  }

  function getInterpolatedPlayers(): OnlinePlayerView[] {
    if (!onlineSnapshot) return [];
    const snap = onlineSnapshot;
    const prev = prevSnapshot;
    const elapsed = performance.now() - snapshotAt;
    const t = Math.min(elapsed / TICK_MS_DISPLAY, 1);
    if (snap.phase !== 'playing' || !prev || t >= 1) return snap.players;
    const prevMap = new Map(prev.players.map(p => [p.playerId, p]));
    return snap.players.map(player => {
      const pp = prevMap.get(player.playerId);
      if (!pp || pp.body.length !== player.body.length) return player;
      const body = player.body.map((seg, i) => {
        const ps = pp.body[i];
        if (!ps) return seg;
        return { x: lerp(ps.x, seg.x, t), y: lerp(ps.y, seg.y, t) };
      });
      return { ...player, body };
    });
  }

  function startOnlineRenderLoop(): void {
    stopOnlineRenderLoop();
    onlineRenderLoop = requestAnimationFrame(renderOnlineFrame);
  }
  function stopOnlineRenderLoop(): void {
    if (onlineRenderLoop) { cancelAnimationFrame(onlineRenderLoop); onlineRenderLoop = null; }
  }

  function renderOnlineFrame(): void {
    renderOnline();
    onlineRenderLoop = requestAnimationFrame(renderOnlineFrame);
  }

  function renderOnline(): void {
    if (!onlineCanvas) return;
    const ctx = onlineCanvas.getContext('2d');
    if (!ctx) return;

    // Background gradient + grid
    const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, '#0f0c29');
    bgGrad.addColorStop(0.5, '#1a1a3e');
    bgGrad.addColorStop(1, '#24243e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle grid
    const cellW = CANVAS_WIDTH / 40, cellH = CANVAS_HEIGHT / 25;
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= 40; x++) {
      ctx.beginPath(); ctx.moveTo(x * cellW, 0); ctx.lineTo(x * cellW, CANVAS_HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= 25; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cellH); ctx.lineTo(CANVAS_WIDTH, y * cellH); ctx.stroke();
    }

    if (!onlineSnapshot) { drawOnlineText('等待中...'); return; }
    const snap = onlineSnapshot;

    // Draw foods with glow
    for (const food of (snap.foods || [])) {
      const cx = food.x * cellW + cellW / 2;
      const cy = food.y * cellH + cellH / 2;
      const r = Math.min(cellW, cellH) * 0.38;
      // Glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2);
      glow.addColorStop(0, 'rgba(255, 107, 107, 0.4)');
      glow.addColorStop(1, 'rgba(255, 107, 107, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2, 0, Math.PI * 2);
      ctx.fill();
      // Core
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw players with rounded corners + eyes
    const drawPlayers = getInterpolatedPlayers();
    for (const p of drawPlayers) {
      const headColor = p.color === 'red' ? '#ff6b6b' : p.color === 'blue' ? '#74b9ff' : p.color === 'yellow' ? '#fdcb6e' : '#00d4aa';
      const bodyColor = p.color === 'red' ? '#e55050' : p.color === 'blue' ? '#5dade2' : p.color === 'yellow' ? '#f6c344' : '#00b894';

      p.body.forEach((seg, idx) => {
        const sx = seg.x * cellW + 2;
        const sy = seg.y * cellH + 2;
        const sw = cellW - 4;
        const sh = cellH - 4;
        const isHead = idx === 0;
        const radius = isHead ? 6 : 4;

        // Rounded rect
        ctx.fillStyle = isHead ? headColor : bodyColor;
        ctx.beginPath();
        ctx.moveTo(sx + radius, sy);
        ctx.lineTo(sx + sw - radius, sy);
        ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + radius);
        ctx.lineTo(sx + sw, sy + sh - radius);
        ctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - radius, sy + sh);
        ctx.lineTo(sx + radius, sy + sh);
        ctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - radius);
        ctx.lineTo(sx, sy + radius);
        ctx.quadraticCurveTo(sx, sy, sx + radius, sy);
        ctx.closePath();
        ctx.fill();

        // Eyes on head
        if (isHead && p.body.length > 1) {
          const dx = p.direction === 'RIGHT' ? 1 : p.direction === 'LEFT' ? -1 : 0;
          const dy = p.direction === 'DOWN' ? 1 : p.direction === 'UP' ? -1 : 0;
          const eyeR = 2.5;
          const eyeOff = 4;
          // Eye positions based on direction
          let e1x, e1y, e2x, e2y;
          if (dx !== 0) {
            e1x = sx + sw / 2 + dx * 3; e1y = sy + sh / 2 - eyeOff;
            e2x = sx + sw / 2 + dx * 3; e2y = sy + sh / 2 + eyeOff;
          } else {
            e1x = sx + sw / 2 - eyeOff; e1y = sy + sh / 2 + dy * 3;
            e2x = sx + sw / 2 + eyeOff; e2y = sy + sh / 2 + dy * 3;
          }
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(e1x, e1y, eyeR, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(e2x, e2y, eyeR, 0, Math.PI * 2); ctx.fill();
        }
      });

      // Nickname above head with background
      if (p.body.length > 0) {
        const hx = p.body[0].x * cellW + cellW / 2;
        const hy = p.body[0].y * cellH - 6;
        const label = p.nickname + (p.alive ? '' : ' ☠');
        ctx.font = 'bold 10px sans-serif';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(hx - tw / 2 - 4, hy - 9, tw + 8, 14);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, hx, hy);
        ctx.textBaseline = 'alphabetic';
      }
    }

    // Scoreboard - top bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 30);
    ctx.textAlign = 'left';
    let sx = 10;
    for (const p of snap.players) {
      const dotColor = p.color === 'red' ? '#ff6b6b' : p.color === 'blue' ? '#74b9ff' : p.color === 'yellow' ? '#fdcb6e' : '#00d4aa';
      // Color dot
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(sx, 15, 5, 0, Math.PI * 2);
      ctx.fill();
      sx += 10;
      // Name + score
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${p.nickname}`, sx + 2, 19);
      ctx.fillStyle = '#ffd93d';
      ctx.fillText(` ${p.score}`, sx + 2 + ctx.measureText(p.nickname).width, 19);
      sx += ctx.measureText(`${p.nickname} ${p.score}`).width + 20;
    }

    // Phase overlays
    if (snap.phase === 'countdown') {
      onlineRoomPanel?.classList.remove('hidden');
      const secs = Math.max(0, Math.ceil(((snap.countdownEndsAt ?? 0) - Date.now()) / 1000));
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, CANVAS_HEIGHT / 2 - 40, CANVAS_WIDTH, 80);
      ctx.fillStyle = '#00d4aa';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(secs), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 16);
    } else if (snap.phase === 'playing') {
      onlineRoomPanel?.classList.remove('hidden');
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`tick ${snap.tick}`, CANVAS_WIDTH - 8, CANVAS_HEIGHT - 8);
    } else if (snap.phase === 'ended') {
      onlineRoomPanel?.classList.remove('hidden');
      const sorted = [...snap.players].sort((a, b) => b.score - a.score);
      const medals = ['🥇', '🥈', '🥉', ''];
      const panelH = 50 + sorted.length * 28 + 60;
      const panelY = CANVAS_HEIGHT / 2 - panelH / 2;

      // Panel background
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(ctx, 40, panelY, CANVAS_WIDTH - 80, panelH, 12);
      ctx.fill();

      // Title
      const winner = snap.players.find(p => p.playerId === snap.winnerPlayerId);
      ctx.fillStyle = '#ffd93d';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(winner ? `${medals[0]} ${winner.nickname} 获胜！` : '对局结束', CANVAS_WIDTH / 2, panelY + 28);

      // Player rankings
      sorted.forEach((p, i) => {
        const dotColor = p.color === 'red' ? '#ff6b6b' : p.color === 'blue' ? '#74b9ff' : p.color === 'yellow' ? '#fdcb6e' : '#00d4aa';
        const y = panelY + 52 + i * 28;
        // Medal or rank
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(medals[i] || `#${i+1}`, 60, y);
        // Color dot
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(90, y - 4, 5, 0, Math.PI * 2);
        ctx.fill();
        // Name
        ctx.fillStyle = p.alive ? '#fff' : '#888';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(p.nickname + (p.alive ? '' : ' ☠'), 100, y);
        // Score
        ctx.fillStyle = '#ffd93d';
        ctx.textAlign = 'right';
        ctx.fillText(`${p.score}分`, CANVAS_WIDTH - 60, y);
      });

      // Hint
      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('点击返回大厅', CANVAS_WIDTH / 2, panelY + panelH - 16);
    }

  /** 圆角矩形辅助 */
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  }

  // ── 联机按钮事件 ──
  onlineMatchBtn?.addEventListener('click', () => {
    const nickname = onlineNickEl?.value?.trim() || '玩家';
    sendWs({ type: 'match', data: { nickname, maxPlayers: 2 } });
    startMatchingUI();
  });

  onlineCancelMatchBtn?.addEventListener('click', () => {
    sendWs({ type: 'cancel_match', data: {} });
    stopMatchingUI();
    showOnlineLobby();
  });

  onlineCreateBtn?.addEventListener('click', () => {
    const nickname = onlineNickEl?.value?.trim() || '玩家';
    sendWs({ type: 'create_room', data: { nickname, maxPlayers: 2 } });
  });

  onlineJoinBtn?.addEventListener('click', () => {
    const nickname = onlineNickEl?.value?.trim() || '玩家';
    const roomId = onlineRoomIdEl?.value?.trim().toUpperCase();
    if (!roomId) { setOnlineStatus('请输入房间号'); return; }
    sendWs({ type: 'join_room', data: { roomId, nickname } });
  });

  onlineReadyBtn?.addEventListener('click', () => sendWs({ type: 'ready', data: { ready: true } }));
  onlineStartBtn?.addEventListener('click', () => sendWs({ type: 'start_game', data: {} }));

  onlineLeaveBtn?.addEventListener('click', () => {
    sendWs({ type: 'leave_room', data: {} });
    onlineState.roomId = null; onlineState.playerId = null; onlineState.token = null;
    onlineSnapshot = null;
    clearStoredJoinState();
    stopOnlineRenderLoop();
    showOnlineLobby();
    setOnlineStatus('已离开房间');
  });

  // End screen click → back to lobby
  onlineCanvas?.addEventListener('click', () => {
    if (onlineSnapshot?.phase === 'ended') {
      sendWs({ type: 'leave_room', data: {} });
      onlineState.roomId = null; onlineState.playerId = null; onlineState.token = null;
      onlineSnapshot = null;
      clearStoredJoinState();
      stopOnlineRenderLoop();
      showOnlineLobby();
      setOnlineStatus('已连接');
    }
  });

  // Phase 8: 再来一局按钮
  function showRematchOption(): void {
    if (!onlineRoomPanel) return;
    onlineRoomPanel?.classList.remove('hidden');
    // 在房间面板中显示再来一局按钮
    const existingBtn = document.getElementById('online-rematch-btn');
    if (existingBtn) return; // 已存在
    const actionsRow = onlineRoomPanel?.querySelector('.online-actions');
    if (!actionsRow) return;
    const rematchBtn = document.createElement('button');
    rematchBtn.id = 'online-rematch-btn';
    rematchBtn.className = 'online-btn primary';
    rematchBtn.textContent = '🔄 再来一局';
    rematchBtn.addEventListener('click', () => {
      sendWs({ type: 'rematch', data: {} });
      rematchBtn.textContent = '✅ 已准备';
      rematchBtn.classList.add('success');
      rematchBtn.setAttribute('disabled', 'true');
    });
    actionsRow.appendChild(rematchBtn);
  }

  // Phase 8: 房间码分享
  function handleRoomShare(shareUrl: string, roomId: string): void {
    if (!shareUrl) return;
    // 在房间面板显示分享按钮
    const infoEl = onlineRoomInfoEl;
    if (!infoEl) return;
    const fullUrl = `${window.location.origin}${window.location.pathname}${shareUrl}`;
    infoEl.innerHTML = `房间: <b>${roomId}</b> <button id="copy-room-link" class="online-btn small" style="margin-left:8px">📋 复制链接</button>`;
    infoEl.style.display = '';
    document.getElementById('copy-room-link')?.addEventListener('click', () => {
      navigator.clipboard.writeText(fullUrl).then(() => {
        const btn = document.getElementById('copy-room-link');
        if (btn) btn.textContent = '✅ 已复制！';
      }).catch(() => {});
    });
  }

  function startMatchingUI(): void {
    matching = true;
    matchStartMs = Date.now();
    onlineLobby?.classList.add('hidden');
    matchingOverlay?.classList.remove('hidden');
    if (matchTimerEl) matchTimerEl.textContent = '0';
    if (matchHintEl) matchHintEl.textContent = '正在寻找对手';
    startMatchTips();
    matchTimerInterval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - matchStartMs) / 1000);
      if (matchTimerEl) matchTimerEl.textContent = String(elapsed);
      if (matchHintEl && elapsed >= 5) matchHintEl.textContent = '即将加入机器人陪玩...';
    }, 500);
  }

  function stopMatchingUI(): void {
    matching = false;
    if (matchTimerInterval) { clearInterval(matchTimerInterval); matchTimerInterval = null; }
    stopMatchTips();
    matchingOverlay?.classList.add('hidden');
  }

  // ── 初始化 ──
  updateEntryStats();
  showScreen('entry');
  clearOnlineCanvas();
  initTutorial();
  initSettings();

  // Phase 8: URL 房间码自动加入
  const urlParams = new URLSearchParams(window.location.search);
  const autoJoinRoom = urlParams.get('room');
  if (autoJoinRoom) {
    showScreen('online');
    connectOnlineSocket();
    // 延迟加入等待 WebSocket 连接
    setTimeout(() => {
      const nickname = onlineNickEl?.value?.trim() || '玩家';
      sendWs({ type: 'join_room', data: { roomId: autoJoinRoom.toUpperCase(), nickname } });
      // 清理 URL 参数
      window.history.replaceState({}, '', window.location.pathname);
    }, 1000);
  }
}

main();
