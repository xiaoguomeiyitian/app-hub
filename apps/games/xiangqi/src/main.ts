import './style.css';
import { Game } from './game.js';
import { OnlineGame } from './online-game.js';
import { PUZZLES, getPuzzleProgress, type Puzzle } from './puzzles.js';
import { PuzzleGame } from './puzzle-game.js';
import { getHistory, exportGameToText } from './history.js';
import { ReviewManager } from './review.js';
import { TIME_TIERS, type TimeTierKey } from './time-tiers.js';

const app = document.getElementById('app')!;

function showModeSelect(): void {
  // 检查 URL ?room=CODE
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  if (roomCode && roomCode.length === 6) {
    window.history.replaceState({}, '', window.location.pathname);
    const online = new OnlineGame(app, showModeSelect);
    online.connectAndJoinRoom(roomCode.toUpperCase());
    return;
  }

  app.innerHTML = `
    <div class="lobby single-lobby">
      <div class="lobby-badge">中国象棋 · 触屏友好</div>
      <h1>♟ 中国象棋</h1>
      <p class="lobby-note">选择游戏模式</p>
      <div class="lobby-form mode-form">
        <button id="btn-single" class="btn btn-primary-action mode-btn">
          <span class="mode-title">🎮 单机对局</span>
          <span class="mode-sub">本地人机 · 可选执棋和难度</span>
        </button>
        <button id="btn-puzzle" class="btn btn-primary-action mode-btn">
          <span class="mode-title">🧩 残局挑战</span>
          <span class="mode-sub">经典残局 · 解题闯关</span>
        </button>
        <button id="btn-online" class="btn btn-primary-action online-btn mode-btn">
          <span class="mode-title">🌐 联机对战</span>
          <span class="mode-sub">实时对战 · 先选档位再开局</span>
        </button>
        <button id="btn-friend" class="btn btn-primary-action mode-btn">
          <span class="mode-title">👫 好友对战</span>
          <span class="mode-sub">房间码邀请 · 实时对战</span>
        </button>
        <button id="btn-history" class="btn btn-secondary mode-btn">
          <span class="mode-title">📜 历史对局</span>
          <span class="mode-sub">回顾对局 · 复盘分析</span>
        </button>
      </div>
      <p class="lobby-note mode-tip">手机、平板、电脑都可以顺手操作</p>
      <div class="spectate-bar">
        <span class="spectate-count" id="spectate-count">当前 0 局对战</span>
        <button id="btn-spectate" class="btn btn-secondary btn-mini">👁 随机观战</button>
      </div>
    </div>
  `;

  document.getElementById('btn-single')?.addEventListener('click', () => {
    new Game(app, showModeSelect);
  });

  document.getElementById('btn-puzzle')?.addEventListener('click', () => {
    showPuzzleSelect();
  });

  document.getElementById('btn-online')?.addEventListener('click', () => {
    const online = new OnlineGame(app, () => {
      online.disconnect();
      showModeSelect();
    });
    showTimeTierSelect(online);
  });

  document.getElementById('btn-friend')?.addEventListener('click', () => {
    showFriendRoom();
  });

  document.getElementById('btn-history')?.addEventListener('click', () => {
    showHistory();
  });

  document.getElementById('btn-spectate')?.addEventListener('click', () => {
    const online = new OnlineGame(app, showModeSelect);
    online.connectAndSpectate();
  });

  // 获取观战数
  fetchSpectateCount();
}

function fetchSpectateCount(): void {
  const online = new OnlineGame(app, showModeSelect);
  online.onSpectateCount((count: number) => {
    const el = document.getElementById('spectate-count');
    if (el) el.textContent = `当前 ${count} 局对战`;
  });
  online.connectAndSpectateList();
}

function showPuzzleSelect(): void {
  const progress = getPuzzleProgress();

  const difficultyLabels: Record<number, string> = { 1: '入门', 2: '初级', 3: '中级', 4: '高级', 5: '大师' };
  const puzzleCards = PUZZLES.map(p => {
    const stars = progress[p.id] || 0;
    const completed = stars > 0;
    const starText = completed ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : '';
    return `
      <div class="puzzle-card ${completed ? 'completed' : ''}" data-id="${p.id}">
        <div class="puzzle-card-header">
          <span class="puzzle-difficulty-badge">${difficultyLabels[p.difficulty]}</span>
          <span class="puzzle-difficulty-stars">${'⭐'.repeat(p.difficulty)}</span>
        </div>
        <div class="puzzle-name">${p.name}</div>
        <div class="puzzle-stars">${starText}</div>
        <div class="puzzle-tags">${p.tags.join(' · ')}</div>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="lobby single-lobby">
      <div class="lobby-topbar">
        <button class="btn btn-secondary lobby-back-btn" id="btn-back-puzzle">返回模式选择</button>
      </div>
      <h1>🧩 残局挑战</h1>
      <p class="lobby-note">完成经典残局，提升棋力（${Object.keys(progress).length}/${PUZZLES.length}）</p>
      <div class="puzzle-grid">
        ${puzzleCards}
      </div>
    </div>
  `;

  document.getElementById('btn-back-puzzle')?.addEventListener('click', () => {
    showModeSelect();
  });

  document.querySelectorAll('.puzzle-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id')!;
      const puzzle = PUZZLES.find(p => p.id === id);
      if (puzzle) startPuzzle(puzzle);
    });
  });
}

function startPuzzle(puzzle: Puzzle): void {
  const puzzleIndex = PUZZLES.indexOf(puzzle);
  new PuzzleGame(puzzle, app, (_stars) => {
    // 下一关
    const next = PUZZLES[puzzleIndex + 1];
    if (next) {
      startPuzzle(next);
    } else {
      showPuzzleSelect();
    }
  }, () => {
    showPuzzleSelect();
  });
}

function showTimeTierSelect(online: OnlineGame): void {
  let selectedTier: TimeTierKey = 'rapid';

  app.innerHTML = `
    <div class="lobby single-lobby">
      <div class="lobby-badge">在线匹配 · 先选档位</div>
      <h1>⏱ 选择对局档位</h1>
      <p class="lobby-note">只有相同档位的玩家才能匹配到一起</p>
      <div class="lobby-form tier-form">
        <div class="tier-grid" id="tier-grid">
          ${TIME_TIERS.map((tier) => `
            <div class="tier-card ${tier.key === selectedTier ? 'active' : ''}" data-tier="${tier.key}">
              <div class="tier-name">${tier.label}</div>
              <div class="tier-desc">${tier.description}</div>
            </div>
          `).join('')}
        </div>
        <button id="btn-start-online" class="btn btn-primary-action mode-btn">
          <span class="mode-title">开始匹配</span>
          <span class="mode-sub">将寻找相同档位的对手</span>
        </button>
        <button id="btn-back-mode" class="btn btn-secondary mode-btn">
          <span class="mode-title">返回</span>
          <span class="mode-sub">回到模式选择</span>
        </button>
      </div>
    </div>
  `;

  document.querySelectorAll('.tier-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.tier-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      selectedTier = card.getAttribute('data-tier') as TimeTierKey;
    });
  });

  document.getElementById('btn-start-online')?.addEventListener('click', () => {
    online.setTimeTier(selectedTier);
    online.connectAndMatch();
  });

  document.getElementById('btn-back-mode')?.addEventListener('click', () => {
    showModeSelect();
  });
}

function showFriendRoom(): void {
  app.innerHTML = `
    <div class="lobby single-lobby">
      <div class="lobby-topbar">
        <button class="btn btn-secondary lobby-back-btn" id="btn-back-friend">返回模式选择</button>
      </div>
      <h1>👫 好友对战</h1>
      <p class="lobby-note">创建房间分享码给好友，或输入房间码加入</p>
      <div class="lobby-form friend-form">
        <button id="btn-create-room" class="btn btn-primary-action mode-btn">
          <span class="mode-title">🏠 创建房间</span>
          <span class="mode-sub">你执红先手</span>
        </button>
        <div class="join-room-section">
          <div class="join-room-label">或输入房间码加入</div>
          <div class="join-room-row">
            <input id="room-code-input" class="room-code-input" type="text"
              maxlength="6" placeholder="6位房间码"
              autocomplete="off" autocapitalize="characters" inputmode="text" />
            <button id="btn-join-room" class="btn btn-primary-action btn-mini">加入</button>
          </div>
          <div class="join-room-error" id="join-error" style="display:none"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-back-friend')?.addEventListener('click', showModeSelect);
  document.getElementById('btn-create-room')?.addEventListener('click', showWaitingRoom);

  const tryJoin = () => {
    const code = (document.getElementById('room-code-input') as HTMLInputElement).value.trim();
    if (code.length !== 6) {
      const errEl = document.getElementById('join-error')!;
      errEl.textContent = '请输入 6 位房间码';
      errEl.style.display = 'block';
      return;
    }
    const online = new OnlineGame(app, showModeSelect);
    online.connectAndJoinRoom(code.toUpperCase());
  };

  document.getElementById('btn-join-room')?.addEventListener('click', tryJoin);
  document.getElementById('room-code-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryJoin();
  });
}

function showWaitingRoom(): void {
  const online = new OnlineGame(app, showModeSelect);

  app.innerHTML = `
    <div class="lobby single-lobby">
      <div class="lobby-topbar">
        <button class="btn btn-secondary lobby-back-btn" id="btn-cancel-wait">取消</button>
      </div>
      <h1>🏠 等待好友加入</h1>
      <p class="lobby-note">将房间码分享给好友</p>
      <div class="room-code-display">
        <div class="room-code-value" id="room-code-value">------</div>
      </div>
      <button class="btn btn-secondary" id="btn-copy-code" style="margin:0 auto 12px;display:block">📋 复制房间码</button>
      <div class="room-share-tip">
        <p>或分享链接给好友：</p>
        <div class="room-link" id="room-link">生成中...</div>
      </div>
      <div class="waiting-spinner">⏳ 等待对手加入...</div>
    </div>
  `;

  document.getElementById('btn-cancel-wait')?.addEventListener('click', () => {
    online.disconnect();
    showFriendRoom();
  });

  online.onCreateRoom((code: string) => {
    const codeEl = document.getElementById('room-code-value');
    if (codeEl) codeEl.textContent = code;

    const link = `${window.location.origin}${window.location.pathname}?room=${code}`;
    const linkEl = document.getElementById('room-link');
    if (linkEl) linkEl.textContent = link;

    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('btn-copy-code')!;
        btn.textContent = '✅ 已复制';
        setTimeout(() => { btn.textContent = '📋 复制房间码'; }, 2000);
      }).catch(() => {
        // fallback: select text
        const el = document.getElementById('room-code-value');
        if (el) {
          const range = document.createRange();
          range.selectNode(el);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        }
      });
    });
  });

  online.connectAndCreateRoom();
}

function showHistory(): void {
  const history = getHistory();

  const resultLabel = { win: '胜', lose: '负', draw: '和' };
  const resultEmoji = { win: '🟢', lose: '🔴', draw: '🟡' };
  const resultColor = { win: '#22c55e', lose: '#ef4444', draw: '#eab308' };

  app.innerHTML = `
    <div class="lobby single-lobby">
      <div class="lobby-topbar">
        <button class="btn btn-secondary lobby-back-btn" id="btn-back-history">返回模式选择</button>
      </div>
      <h1>📜 历史对局</h1>
      <p class="lobby-note">${history.length > 0 ? `最近 ${history.length} 局` : '暂无对局记录'}</p>
      <div class="history-list">
        ${history.map(r => {
          const date = new Date(r.timestamp);
          const dateStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
          const durationMin = Math.floor(r.duration / 60);
          const durationSec = r.duration % 60;
          const durStr = durationMin > 0 ? `${durationMin}分${durationSec}秒` : `${durationSec}秒`;
          return `
            <div class="history-card" data-id="${r.id}">
              <div class="history-result" style="color:${resultColor[r.result]}">${resultEmoji[r.result]} ${resultLabel[r.result]}</div>
              <div class="history-info">
                <div class="history-opponent">${r.myColor === 'red' ? '🔴' : '⚫'} vs ${r.opponent}</div>
                <div class="history-meta">${r.moveCount} 步 · ${durStr} · ${dateStr}</div>
              </div>
              <div class="history-action">
                <button class="btn btn-secondary btn-mini btn-review-history" data-id="${r.id}">📊 复盘</button>
                <button class="btn btn-secondary btn-mini btn-export-history" data-id="${r.id}">📋</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-back-history')?.addEventListener('click', showModeSelect);

  const startReview = (id: string) => {
    const record = history.find(r => r.id === id);
    if (record) {
      const review = new ReviewManager(record.moves);
      review.renderUI(app, () => showHistory());
    }
  };

  app.querySelectorAll('.btn-review-history').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      startReview((btn as HTMLElement).getAttribute('data-id') || '');
    });
  });

  app.querySelectorAll('.history-card').forEach(card => {
    card.addEventListener('click', () => {
      startReview(card.getAttribute('data-id') || '');
    });
  });

  app.querySelectorAll('.btn-export-history').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).getAttribute('data-id') || '';
      const record = history.find(r => r.id === id);
      if (record) {
        const text = exportGameToText(record);
        navigator.clipboard.writeText(text).then(() => {
          (btn as HTMLElement).textContent = '✅';
          setTimeout(() => { (btn as HTMLElement).textContent = '📋'; }, 2000);
        }).catch(() => {});
      }
    });
  });
}

showModeSelect();
