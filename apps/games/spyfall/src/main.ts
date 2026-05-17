/// <reference types="vite/client" />
import './style.css';

const LOCATIONS = ['飞机', '海滩', '银行', '电影院', '医院', '学校', '餐厅', '超市', '酒店', '博物馆', '游乐园', '图书馆', '消防站', '警察局', '健身房', '动物园'];
const ROLES = ['机长', '空乘', '乘客', '游客', '银行家', '保安', '导演', '演员', '医生', '护士', '老师', '学生', '厨师', '顾客', '经理', '小偷'];

type Phase = 'setup' | 'playing' | 'voting' | 'result';
let phase: Phase = 'setup';
let players: string[] = ['你', '电脑A', '电脑B', '电脑C', '电脑D'];
let location = '';
let spyIdx = 0;
let myRole = '';
let currentPlayer = 0;
let round = 1;
const maxRounds = 3;
let timeLeft = 180;
let timer: number | null = null;
let votes: Record<number, number> = {};
let resultMsg = '';

let audioCtx: AudioContext | null = null;
function sfx(freq: number, dur: number, type: OscillatorType = 'sine'): void {
  if (!audioCtx) { try { audioCtx = new AudioContext(); } catch { return; } }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

function shuffle<T>(arr: T[]): T[] {
  const b = [...arr];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function startGame(): void {
  location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  spyIdx = Math.floor(Math.random() * players.length);
  const roles = shuffle(ROLES);
  myRole = spyIdx === 0 ? '你是间谍！不知道地点' : roles[0] + '（' + location + '）';
  phase = 'playing';
  round = 1;
  currentPlayer = 0;
  timeLeft = 180;
  votes = {};
  if (timer) { clearInterval(timer); }
  timer = window.setInterval(() => {
    if (phase === 'playing') {
      timeLeft--;
      if (timeLeft <= 0) { phase = 'voting'; sfx(440, 0.3); }
    }
    render();
  }, 1000);
  sfx(660, 0.2);
  render();
}

function castVote(target: number): void {
  if (phase !== 'voting') { return; }
  votes[target] = (votes[target] || 0) + 1;
  for (let i = 1; i < players.length; i++) {
    if (i !== target) {
      const t = Math.floor(Math.random() * players.length);
      votes[t] = (votes[t] || 0) + 1;
    }
  }
  let maxVotes = 0;
  let votedOut = 0;
  for (const [k, v] of Object.entries(votes)) {
    if (v > maxVotes) { maxVotes = v; votedOut = parseInt(k, 10); }
  }
  if (votedOut === spyIdx) {
    resultMsg = '间谍被抓到了！间谍是 ' + players[spyIdx] + '（' + location + '）';
  } else {
    resultMsg = players[votedOut] + '被投出，但不是间谍！间谍是 ' + players[spyIdx];
  }
  phase = 'result';
  sfx(880, 0.3);
  render();
}

const app = document.getElementById('app')!;

function render(): void {
  app.innerHTML = `<div class="sf-wrapper">
    <h1 class="sf-title">🕵️ 谁是卧底</h1>
    <div class="sf-phase">${phase === 'setup' ? '' : phase === 'playing' ? '游戏中' : '投票'}</div>
    ${phase === 'setup' ? '<div class="sf-setup"><p>5人局：1间谍+4平民</p><p>间谍不知道地点，需隐藏身份</p><button class="sf-btn primary" id="sf-start">开始游戏</button></div>' : ''}
    ${phase === 'playing' ? `<div class="sf-game"><div class="sf-role">${myRole}</div><div class="sf-timer">⏱ ${timeLeft}s</div><div class="sf-round">第${round}/${maxRounds}轮</div><div class="sf-players">${players.map((p, i) => `<div class="sf-player ${i === 0 ? 'you' : ''}">${p}${i === currentPlayer ? ' 👈' : ''}</div>`).join('')}</div><button class="sf-btn" id="sf-ask">提问轮到你了</button><button class="sf-btn danger" id="sf-vote">进入投票</button></div>` : ''}
    ${phase === 'voting' ? `<div class="sf-vote"><h3>投票！谁是间谍？</h3><div class="sf-vote-btns">${players.map((p, i) => `<button class="sf-btn vote-btn" data-v="${i}">${p}</button>`).join('')}</div></div>` : ''}
    ${phase === 'result' ? `<div class="sf-result"><h3>${resultMsg}</h3><button class="sf-btn primary" id="sf-replay">再来一局</button></div>` : ''}
  </div>`;

  document.getElementById('sf-start')?.addEventListener('click', startGame);
  document.getElementById('sf-vote')?.addEventListener('click', () => { phase = 'voting'; render(); });
  document.getElementById('sf-ask')?.addEventListener('click', () => { currentPlayer = (currentPlayer + 1) % players.length; sfx(500, 0.05); render(); });
  document.querySelectorAll('[data-v]').forEach(el => el.addEventListener('click', () => castVote(parseInt((el as HTMLElement).dataset.v!, 10))));
  document.getElementById('sf-replay')?.addEventListener('click', () => { phase = 'setup'; render(); });
}

render();
