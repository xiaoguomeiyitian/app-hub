import './style.css';

// ===== 词库 =====
const WORDS = [
  'about','above','abuse','actor','acute','admit','adopt','adult','after','again',
  'agent','agree','ahead','alarm','album','alert','alike','alive','allow','alone',
  'along','alter','among','anger','angle','angry','apart','apple','apply','arena',
  'argue','arise','armor','array','aside','asset','avoid','awake','award','aware',
  'badly','baker','bases','basic','batch','beach','began','begin','being','below',
  'bench','berry','birth','black','blade','blame','blank','blast','blaze','bleed',
  'blend','blind','block','blood','bloom','blown','board','boost','bound','brain',
  'brand','brave','bread','break','breed','brick','brief','bring','broad','broke',
  'brown','brush','build','bunch','burst','buyer','cabin','cable','candy','cargo',
  'carry','catch','cause','chain','chair','charm','chart','chase','cheap','check',
  'cheek','cheer','chess','chest','chief','child','china','chose','chunk','claim',
  'clash','class','clean','clear','clerk','click','cliff','climb','cling','clock',
  'clone','close','cloud','coach','coast','color','comet','coral','could','count',
  'court','cover','crack','craft','crane','crash','crazy','cream','crime','cross',
  'crowd','cruel','crush','curve','cycle','daily','dance','death','debug','delay',
  'depth','dirty','doubt','draft','drain','drama','drank','dream','dress','dried',
  'drink','drive','drove','dying','eager','early','earth','eight','elect','elite',
  'empty','enemy','enjoy','enter','equal','error','essay','event','every','exact',
  'exist','extra','faith','false','fault','feast','fence','fever','fiber','field',
  'fifth','fifty','fight','final','first','fixed','flame','flash','flesh','float',
  'flood','floor','fluid','focus','force','forge','forth','forum','found','frame',
  'frank','fraud','fresh','front','froze','fruit','fully','funny','ghost','giant',
  'given','glass','globe','gloom','glory','going','grace','grade','grain','grand',
  'grant','graph','grasp','grass','grave','great','green','greet','grief','grill',
  'grind','gross','group','grove','grown','guard','guess','guest','guide','guilt',
  'hairy','happy','harsh','haven','heart','heavy','hence','hobby','honey','honor',
  'horse','hotel','house','human','humor','ideal','image','imply','index','indie',
  'inner','input','irony','issue','ivory','jewel','joker','judge','juice','knife',
  'knock','known','label','labor','lance','large','laser','later','laugh','layer',
  'learn','least','leave','legal','lemon','level','light','limit','linen','liver',
  'local','logic','loose','lover','lower','loyal','lucky','lunch','magic','major',
  'maker','manor','march','match','mayor','meant','media','mercy','merge','merit',
  'metal','meter','might','minor','minus','model','money','month','moral','motor',
  'mount','mouse','mouth','movie','music','naval','nerve','never','newly','night',
  'noble','noise','north','noted','novel','nurse','nylon','occur','ocean','offer',
  'often','olive','onset','opera','orbit','order','organ','other','outer','ovary',
  'owner','oxide','ozone','paint','panel','panic','paper','party','paste','patch',
  'pause','peace','peach','pearl','penny','phase','phone','photo','piano','piece',
  'pilot','pitch','pixel','pizza','place','plain','plane','plant','plate','plaza',
  'plead','pluck','plumb','plume','plump','plunge','point','poker','polar','polio',
  'polka','porch','pound','power','press','price','pride','prime','print','prior',
  'prize','probe','prone','proof','prose','proud','prove','proxy','pulse','punch',
  'pupil','purse','queen','query','quest','queue','quick','quiet','quota','quote',
  'radar','radio','raise','rally','range','rapid','ratio','reach','ready','rebel',
  'refer','reign','relax','rider','ridge','rifle','right','rigid','risky','rival',
  'river','robin','robot','rocky','rogue','roman','rough','round','route','royal',
  'rugby','ruler','rural','sadly','saint','salad','sauce','scale','scare','scene',
  'scope','score','seize','sense','serve','seven','shade','shaft','shake','shall',
  'shame','shape','share','sharp','sheet','shelf','shell','shift','shine','shirt',
  'shock','shoot','shore','short','shout','shown','sight','sigma','silly','since',
  'sixth','sixty','sized','skill','skull','slave','sleep','slice','slide','slope',
  'smart','smell','smile','smoke','snake','solar','solid','solve','sorry','sound',
  'south','space','spare','spark','speak','speed','spell','spend','spent','spice',
  'split','spoke','spoon','sport','spray','squad','stack','staff','stage','stain',
  'stake','stale','stand','stark','start','state','steak','steal','steam','steel',
  'steep','steer','stern','stick','stiff','still','stock','stone','stood','store',
  'storm','story','stove','strip','stuck','study','stuff','style','sugar','suite',
  'sunny','super','surge','swamp','swear','sweet','swept','swift','swing','sword',
  'swore','swung','table','taste','teach','tears','teeth','tempo','tense','tenth',
  'terry','theme','thick','thing','think','third','those','three','threw','throw',
  'thumb','tiger','tight','timer','tired','title','toast','today','token','total',
  'touch','tough','tower','toxic','trace','track','trade','trail','train','trait',
  'trash','treat','trend','trial','tribe','trick','tried','troop','truck','truly',
  'trump','trunk','trust','truth','tumor','tuned','twice','twist','ultra','uncle',
  'under','unify','union','unite','unity','until','upper','upset','urban','usage',
  'usual','utter','valid','value','valve','verse','video','vigor','viola','viral',
  'virus','visit','vital','vivid','vocal','vodka','voice','voter','waist','waste',
  'watch','water','weave','weigh','weird','wheat','wheel','where','which','while',
  'white','whole','whose','wider','width','witch','woman','women','world','worry',
  'worse','worst','worth','would','wound','wrath','write','wrote','yacht','yield',
  'young','youth','zebra','zonal',
];

const KEYBOARD = ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];

// ===== 统计 =====
const STATS_KEY = 'wordle_stats';

interface WordleStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  guessDist: number[]; // index 0 = guess 1, index 5 = guess 6
  lastPlayed: string; // date string
}

function loadStats(): WordleStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { played: 0, won: 0, currentStreak: 0, maxStreak: 0, guessDist: [0,0,0,0,0,0], lastPlayed: '', ...s };
    }
  } catch {}
  return { played: 0, won: 0, currentStreak: 0, maxStreak: 0, guessDist: [0,0,0,0,0,0], lastPlayed: '' };
}

function saveStats(s: WordleStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
}

let stats = loadStats();

// ===== 游戏状态 =====
let target = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
let guesses: string[] = [];
let current = '';
let won = false;
let lost = false;
let showStats = false;

function getColor(guess: string, i: number): string {
  if (guess[i] === target[i]) return '#6aaa64';
  if (target.includes(guess[i])) return '#c9b458';
  return '#787c7e';
}

function getShareText(): string {
  let text = `Wordle ${won ? guesses.length : 'X'}/6\n\n`;
  for (const g of guesses) {
    for (let i = 0; i < 5; i++) {
      const c = getColor(g, i);
      text += c === '#6aaa64' ? '🟩' : c === '#c9b458' ? '🟨' : '⬛';
    }
    text += '\n';
  }
  return text;
}

const app = document.getElementById('app')!;

function render(): void {
  // 棋盘
  const rows = Array.from({ length: 6 }, (_, i) => {
    const g = guesses[i] || (i === guesses.length ? current.padEnd(5) : '');
    return `<div class="wl-row">${g.split('').map((ch, j) => {
      const color = i < guesses.length ? getColor(guesses[i], j) : (ch !== ' ' ? '#3a3a3c' : '#121213');
      const border = i === guesses.length && ch !== ' ' ? '#565758' : '#3a3a3c';
      return `<div class="wl-cell" style="background:${color};border-color:${border}">${ch !== ' ' ? ch : ''}</div>`;
    }).join('')}</div>`;
  }).join('');

  // 键盘颜色
  const keyColors: Record<string, string> = {};
  for (const g of guesses) {
    for (let i = 0; i < 5; i++) {
      const ch = g[i], c = getColor(g, i);
      if (!keyColors[ch] || c === '#6aaa64' || (c === '#c9b458' && keyColors[ch] !== '#6aaa64')) {
        keyColors[ch] = c;
      }
    }
  }

  const kb = KEYBOARD.map(row => `<div class="wl-kbrow">${row.split('').map(ch =>
    `<button class="wl-key" style="background:${keyColors[ch] || '#818384'}" data-key="${ch}">${ch}</button>`
  ).join('')}</div>`).join('');

  // 游戏结束消息
  let msg = '';
  if (won) msg = `<div class="wl-msg win">🎉 猜对了！用了 ${guesses.length} 次</div>`;
  else if (lost) msg = `<div class="wl-msg lose">💀 答案是: ${target}</div>`;

  // 统计面板
  const winPct = stats.played > 0 ? Math.round(stats.won / stats.played * 100) : 0;
  const statsPanel = showStats ? `
    <div class="wl-stats-overlay">
      <div class="wl-stats-card">
        <h2>📊 统计</h2>
        <div class="wl-stats-grid">
          <div class="wl-stat-num">${stats.played}</div>
          <div class="wl-stat-num">${winPct}</div>
          <div class="wl-stat-num">${stats.currentStreak}</div>
          <div class="wl-stat-num">${stats.maxStreak}</div>
          <div class="wl-stat-label">已玩</div>
          <div class="wl-stat-label">胜率%</div>
          <div class="wl-stat-label">当前连胜</div>
          <div class="wl-stat-label">最高连胜</div>
        </div>
        <h3>猜测分布</h3>
        <div class="wl-dist">
          ${stats.guessDist.map((n, i) => {
            const max = Math.max(...stats.guessDist, 1);
            const pct = Math.round(n / max * 100);
            return `<div class="wl-dist-row"><span>${i + 1}</span><div class="wl-dist-bar" style="width:${Math.max(pct, 7)}%">${n}</div></div>`;
          }).join('')}
        </div>
        <div class="wl-stats-actions">
          ${(won || lost) ? '<button class="wl-btn share-btn" id="wl-share">📋 分享结果</button>' : ''}
          <button class="wl-btn" id="wl-close-stats">关闭</button>
        </div>
      </div>
    </div>
  ` : '';

  app.innerHTML = `<div class="wl-wrapper">
    <div class="wl-header">
      <span>🐸 Wordle</span>
      <div class="wl-header-btns">
        <button class="wl-btn icon-btn" id="wl-stats-btn" title="统计">📊</button>
        <button class="wl-btn" id="wl-restart">重来</button>
      </div>
    </div>
    ${msg}
    <div class="wl-board">${rows}</div>
    <div class="wl-kb">
      ${kb}
      <div class="wl-kbrow">
        <button class="wl-key wl-enter" data-key="ENTER">确定</button>
        <button class="wl-key wl-back" data-key="BACK">←</button>
      </div>
    </div>
    ${statsPanel}
  </div>`;

  // 事件绑定
  document.querySelectorAll('[data-key]').forEach(el => el.addEventListener('click', () => {
    handleKey((el as HTMLElement).dataset.key!);
  }));
  document.getElementById('wl-restart')?.addEventListener('click', restart);
  document.getElementById('wl-stats-btn')?.addEventListener('click', () => { showStats = true; render(); });
  document.getElementById('wl-close-stats')?.addEventListener('click', () => { showStats = false; render(); });
  document.getElementById('wl-share')?.addEventListener('click', () => {
    navigator.clipboard.writeText(getShareText()).then(() => {
      const btn = document.getElementById('wl-share') as HTMLButtonElement;
      if (btn) { btn.textContent = '✅ 已复制'; setTimeout(() => render(), 1500); }
    }).catch(() => {});
  });
}

function recordWin(): void {
  stats.played++;
  stats.won++;
  stats.currentStreak++;
  if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;
  stats.guessDist[guesses.length - 1]++;
  stats.lastPlayed = new Date().toDateString();
  saveStats(stats);
}

function recordLoss(): void {
  stats.played++;
  stats.currentStreak = 0;
  stats.lastPlayed = new Date().toDateString();
  saveStats(stats);
}

function handleKey(key: string): void {
  if (won || lost) return;
  if (key === 'BACK') {
    current = current.slice(0, -1);
  } else if (key === 'ENTER') {
    if (current.length !== 5) return;
    // 检查是否在词库中
    if (!WORDS.includes(current.toLowerCase())) {
      // 闪烁提示不在词库
      const msgEl = document.querySelector('.wl-msg');
      if (msgEl) { msgEl.textContent = '不在词库中'; }
      else {
        const board = document.querySelector('.wl-board');
        if (board) board.insertAdjacentHTML('beforebegin', '<div class="wl-msg" id="wl-temp-msg">不在词库中</div>');
        setTimeout(() => document.getElementById('wl-temp-msg')?.remove(), 1500);
      }
      return;
    }
    guesses.push(current);
    if (current === target) {
      won = true;
      recordWin();
      showStats = true;
    } else if (guesses.length >= 6) {
      lost = true;
      recordLoss();
      showStats = true;
    }
    current = '';
  } else if (key.length === 1 && current.length < 5) {
    current += key;
  }
  render();
}

function restart(): void {
  target = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
  guesses = [];
  current = '';
  won = false;
  lost = false;
  showStats = false;
  render();
}

window.addEventListener('keydown', e => {
  if (showStats && e.key === 'Escape') { showStats = false; render(); return; }
  if (e.key === 'Backspace') handleKey('BACK');
  else if (e.key === 'Enter') handleKey('ENTER');
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
});

render();
