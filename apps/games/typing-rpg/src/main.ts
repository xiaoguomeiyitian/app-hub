import './style.css';

// ============ WORD LISTS ============
const EASY_WORDS = ['cat','dog','run','hit','map','red','top','fox','cup','pen','sun','hat','big','ice','arm','leg','eye','ear','sky','sea','war','key','box','fly','bow','mix','joy','fun','zip','log','dig','hop','jog','nap','rip','van','web','yam','zen','elm'];
const MEDIUM_WORDS = ['battle','dragon','castle','knight','wizard','potion','shadow','crystal','shield','sword','forest','mountain','dungeon','treasure','monster','legend','quest','magic','ancient','kingdom','phoenix','thunder','spirit','frozen','shadow','assault','victory','defeat','honor','glory'];
const HARD_WORDS = ['adventure','champion','conqueror','enchanted','guardian','immortal','necromancer','sorcerer','berserker','paladin','archmage','holy','darkness','legendary','mythical','catastrophe','apocalypse','sovereignty','excalibur','resurrection'];
const BOSS_WORDS = ['unprecedented','extraordinary','bibliography','catastrophic','thermodynamics','electromagnetic','photosynthesis','circumference','metamorphosis','quintessential','paradigm','hypothesis','synchronize','infrastructure','algorithm'];

// ============ GAME STATE ============
interface Player {
  name: string; hp: number; maxHp: number; mp: number; maxMp: number;
  atk: number; def: number; exp: number; expNext: number; level: number;
  gold: number; kills: number;
  equip: { sword: number; shield: number; boots: number };
}

interface Monster {
  name: string; word: string; hp: number; maxHp: number;
  atk: number; def: number; expReward: number; goldReward: number;
  isBoss: boolean; emoji: string;
}

type GameState = 'title' | 'battle' | 'levelup' | 'shop' | 'gameover';

let state: GameState = 'title';
let player: Player;
let monster: Monster;
let typed = '';
let combo = 0;
let maxCombo = 0;
let wordsTyped = 0;
let level = 1;

function newPlayer(): Player {
  return {
    name: '勇者', hp: 100, maxHp: 100, mp: 30, maxMp: 30,
    atk: 10, def: 5, exp: 0, expNext: 50, level: 1, gold: 0, kills: 0,
    equip: { sword: 0, shield: 0, boots: 0 },
  };
}

function spawnMonster(): Monster {
  const isBoss = level % 5 === 0;
  const tier = Math.min(2, Math.floor(level / 4));
  const words = isBoss ? BOSS_WORDS : tier === 0 ? EASY_WORDS : tier === 1 ? MEDIUM_WORDS : HARD_WORDS;
  const word = words[Math.floor(Math.random() * words.length)];
  const multiplier = isBoss ? 3 : 1;
  const levelMul = 1 + level * 0.15;

  const emojis = isBoss ? ['👹','🐉','💀','👿','🦁'] : ['👹','👺','🦇','🐺','🕷️','🐍','👾','🧟','🦴','👻'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];

  return {
    name: isBoss ? `第${level}层 Boss` : `怪物 Lv.${level}`,
    word,
    hp: Math.floor((20 + level * 8) * multiplier),
    maxHp: Math.floor((20 + level * 8) * multiplier),
    atk: Math.floor((5 + level * 2) * multiplier * levelMul),
    def: Math.floor((2 + level) * multiplier),
    expReward: Math.floor((10 + level * 5) * multiplier),
    goldReward: Math.floor((5 + level * 3) * multiplier),
    isBoss,
    emoji,
  };
}

function totalAtk(): number { return player.atk + player.equip.sword * 5; }
function totalDef(): number { return player.def + player.equip.shield * 3; }

function playerAttack(): { dmg: number; crit: boolean } {
  const base = totalAtk() + Math.floor(Math.random() * 5);
  const crit = Math.random() < 0.15;
  const dmg = Math.max(1, (crit ? base * 2 : base) - monster.def);
  return { dmg, crit };
}

function monsterAttack(): number {
  const base = monster.atk + Math.floor(Math.random() * 3);
  return Math.max(1, base - totalDef());
}

function addExp(amount: number) {
  player.exp += amount;
  while (player.exp >= player.expNext) {
    player.exp -= player.expNext;
    player.level++;
    player.expNext = Math.floor(player.expNext * 1.5);
    player.maxHp += 15;
    player.hp = player.maxHp;
    player.maxMp += 5;
    player.mp = player.maxMp;
    player.atk += 2;
    player.def += 1;
    state = 'levelup';
  }
}

// ============ RENDER ============
function render() {
  const app = document.getElementById('app')!;

  if (state === 'title') {
    app.innerHTML = `
      <div class="title-screen">
        <h1>⚔️ 打字RPG</h1>
        <div class="sub">Typing is Attacking!</div>
        <button class="btn" id="startBtn">🎮 开始冒险</button>
        <div class="hint">打出屏幕上的单词来攻击怪物 | 消灭怪物获取经验升级</div>
      </div>
    `;
    document.getElementById('startBtn')!.addEventListener('click', () => {
      player = newPlayer();
      level = 1;
      combo = 0; maxCombo = 0; wordsTyped = 0;
      monster = spawnMonster();
      typed = '';
      state = 'battle';
      render();
    });
    return;
  }

  if (state === 'levelup') {
    app.innerHTML = `
      <div class="level-up">
        <h2>⬆️ 升级！Lv.${player.level}</h2>
        <div class="rewards">
          HP +15 → ${player.maxHp} | MP +5 → ${player.maxMp}<br>
          ATK +2 → ${player.atk} | DEF +1 → ${player.def}
        </div>
        <button class="btn" id="continueBtn">继续冒险</button>
      </div>
    `;
    document.getElementById('continueBtn')!.addEventListener('click', () => {
      state = 'battle';
      render();
    });
    return;
  }

  if (state === 'shop') {
    const items: { name: string; desc: string; cost: number; slot: string }[] = [
      { name: '⚔️ 强化剑', desc: `ATK +5 (当前 Lv.${player.equip.sword})`, cost: 30 + player.equip.sword * 20, slot: 'sword' },
      { name: '🛡️ 强化盾', desc: `DEF +3 (当前 Lv.${player.equip.shield})`, cost: 25 + player.equip.shield * 15, slot: 'shield' },
      { name: '👢 强化靴', desc: `每级 +2 HP (当前 Lv.${player.equip.boots})`, cost: 20 + player.equip.boots * 12, slot: 'boots' },
      { name: '💊 回复药', desc: '恢复 50% HP', cost: 15, slot: 'potion' },
    ];
    app.innerHTML = `
      <div class="shop">
        <h2>🏪 商店 | 💰 ${player.gold}G</h2>
        <div class="shop-items">
          ${items.map((it, i) => `
            <div class="shop-item" data-idx="${i}">
              <div><div class="name">${it.name}</div><div class="desc">${it.desc}</div></div>
              <div class="cost">${it.cost}G</div>
              <button class="btn-buy" ${player.gold < it.cost ? 'disabled' : ''}>购买</button>
            </div>
          `).join('')}
        </div>
        <button class="btn" id="leaveShop" style="background:#333;color:#fff;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;font-family:inherit">离开商店</button>
      </div>
    `;
    document.querySelectorAll('.shop-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = +(el as HTMLElement).dataset.idx!;
        const it = items[idx];
        if (player.gold >= it.cost) {
          player.gold -= it.cost;
          if (it.slot === 'potion') {
            player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.5));
          } else if (it.slot === 'sword' || it.slot === 'shield' || it.slot === 'boots') {
            player.equip[it.slot]++;
          }
          render();
        }
      });
    });
    document.getElementById('leaveShop')!.addEventListener('click', () => {
      state = 'battle';
      render();
    });
    return;
  }

  if (state === 'gameover') {
    app.innerHTML = `
      <div class="game-over">
        <h2>💀 游戏结束</h2>
        <div class="stats-summary">
          等级: Lv.${player.level}<br>
          击杀: ${player.kills}<br>
          最高连击: ${maxCombo}<br>
          打字数: ${wordsTyped}<br>
          到达层数: 第 ${level} 层
        </div>
        <button class="btn" id="retryBtn">🔄 重新开始</button>
      </div>
    `;
    document.getElementById('retryBtn')!.addEventListener('click', () => {
      state = 'title';
      render();
    });
    return;
  }

  // Battle state
  const hpPct = (player.hp / player.maxHp * 100).toFixed(0);
  const mpPct = (player.mp / player.maxMp * 100).toFixed(0);
  const expPct = (player.exp / player.expNext * 100).toFixed(0);
  const mhpPct = (monster.hp / monster.maxHp * 100).toFixed(0);

  // Word display
  const wordHtml = monster.word.split('').map((ch, i) => {
    if (i < typed.length) {
      return typed[i] === ch ? `<span class="correct">${ch}</span>` : `<span class="wrong">${ch}</span>`;
    } else if (i === typed.length) {
      return `<span class="current">${ch}</span>`;
    }
    return `<span class="pending">${ch}</span>`;
  }).join('');

  app.innerHTML = `
    <div class="game-area">
      <div class="battle-bg">
        <div class="stars">${Array.from({length:30},()=>`<div class="star" style="left:${Math.random()*100}%;top:${Math.random()*60}%;width:${Math.random()*2+1}px;height:${Math.random()*2+1}px;opacity:${Math.random()*0.5+0.3}"></div>`).join('')}</div>
        <div class="ground"></div>
      </div>

      <div class="hud">
        <div class="player-hud">
          <div class="hud-name">⚔️ ${player.name} Lv.${player.level}</div>
          <div class="bar hp-bar"><div class="bar-fill" style="width:${hpPct}%"></div><div class="bar-text">${player.hp}/${player.maxHp}</div></div>
          <div class="bar mp-bar"><div class="bar-fill" style="width:${mpPct}%"></div><div class="bar-text">${player.mp}/${player.maxMp}</div></div>
          <div class="bar exp-bar"><div class="bar-fill" style="width:${expPct}%"></div><div class="bar-text">${player.exp}/${player.expNext}</div></div>
        </div>
        <div class="enemy-hud">
          <div class="hud-name">${monster.emoji} ${monster.name}</div>
          <div class="bar hp-bar"><div class="bar-fill" style="width:${mhpPct}%"></div><div class="bar-text">${monster.hp}/${monster.maxHp}</div></div>
        </div>
      </div>

      <div class="chars">
        <div class="char-sprite" id="playerSprite">🗡️</div>
        <div class="char-sprite" id="enemySprite">${monster.emoji}</div>
      </div>

      <div class="word-area">
        <div class="word-display">${wordHtml}</div>
        <div class="word-hint">${monster.isBoss ? '🔥 BOSS战！' : `第 ${level} 层`} | 💰 ${player.gold}G</div>
      </div>

      ${combo > 1 ? `<div class="combo">🔥 ${combo}x Combo!</div>` : ''}
    </div>

    <div class="bottom-bar">
      <div class="equip">
        <div class="equip-slot"><span class="slot-name">⚔️ 剑</span><span class="slot-value">+${player.equip.sword * 5}</span></div>
        <div class="equip-slot"><span class="slot-name">🛡️ 盾</span><span class="slot-value">+${player.equip.shield * 3}</span></div>
        <div class="equip-slot"><span class="slot-name">👢 靴</span><span class="slot-value">Lv.${player.equip.boots}</span></div>
      </div>
      <div class="input-area">
        <input id="wordInput" placeholder="输入单词攻击..." autocomplete="off" autofocus/>
      </div>
      <div class="stats">
        <div class="stat-item">⚔️ ATK:${totalAtk()}</div>
        <div class="stat-item">🛡️ DEF:${totalDef()}</div>
        <div class="stat-item">💀 ${player.kills}</div>
      </div>
    </div>
  `;

  const input = document.getElementById('wordInput') as HTMLInputElement;
  input.focus();

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase();
    typed = val;

    // Check if word is complete
    if (val === monster.word) {
      wordsTyped++;
      combo++;
      if (combo > maxCombo) maxCombo = combo;

      // Player attacks
      const { dmg, crit } = playerAttack();
      monster.hp -= dmg;
      input.value = '';
      typed = '';

      // Visual feedback
      const playerSprite = document.getElementById('playerSprite')!;
      const enemySprite = document.getElementById('enemySprite')!;
      playerSprite.classList.add('attacking');
      setTimeout(() => playerSprite.classList.remove('attacking'), 150);
      enemySprite.classList.add('hit');
      setTimeout(() => enemySprite.classList.remove('hit'), 300);

      // Damage number
      showDmgNum(dmg, crit, 'player');

      if (monster.hp <= 0) {
        // Monster defeated
        player.kills++;
        player.gold += monster.goldReward;
        addExp(monster.expReward);
        if (state === 'battle') {
          // Every 3 kills offer shop
          if (player.kills % 3 === 0) {
            state = 'shop';
          } else {
            level++;
            monster = spawnMonster();
          }
        }
      } else {
        // Monster attacks back
        const mDmg = monsterAttack();
        player.hp -= mDmg;
        const bootsHp = player.equip.boots * 2;
        player.hp += bootsHp; // boots bonus
        showDmgNum(mDmg, false, 'enemy');

        if (player.hp <= 0) {
          player.hp = 0;
          state = 'gameover';
        }
      }

      render();
    } else if (val.length > 0 && !monster.word.startsWith(val)) {
      // Wrong character
      combo = 0;
    }
  });
}

function showDmgNum(dmg: number, crit: boolean, type: 'player' | 'enemy') {
  const el = document.createElement('div');
  el.className = `dmg-num ${type === 'player' ? 'player-dmg' : 'enemy-dmg'} ${crit ? 'crit' : ''}`;
  el.textContent = crit ? `💥${dmg}` : `-${dmg}`;
  el.style.left = type === 'player' ? '70%' : '30%';
  el.style.top = '40%';
  document.querySelector('.game-area')!.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

render();
