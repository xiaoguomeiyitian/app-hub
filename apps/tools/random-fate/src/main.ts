import '@app-hub/design-system/src/style.css';
import './style.css';

interface FateCard {
  rarity: 'N' | 'R' | 'SR' | 'SSR';
  role: string;
  icon: string;
  skill: string;
  world: string;
  story: string;
}

const roles = ['流浪剑客','暗影刺客','星辰法师','治愈圣女','机械师','龙骑士','时间旅行者','虚空行者','灵魂猎手','命运编织者','冰霜领主','炎之精灵','幻术师','亡灵统帅','光之勇者','深渊召唤师'];
const icons = ['⚔️','🗡️','🔮','💖','🔧','🐉','⏰','🌀','👻','🧵','❄️','🔥','🎭','💀','✨','🌑'];
const skills = ['时空斩','暗影突刺','星陨术','圣光复苏','机关改造','龙息咆哮','时光回溯','维度裂缝','灵魂收割','命运改写','极寒领域','烈焰风暴','幻象迷宫','亡者归来','光之审判','深渊之门'];
const worlds = ['永夜大陆','星辰海','机械之城','天空圣域','龙之谷','时间裂隙','虚空深渊','幽冥地府','光之国度','命运回廊','冰霜之境','炎阳荒原','幻梦森林','亡灵之森','圣光神殿','混沌虚空'];
const stories = [
  '背负着诅咒的命运，踏上寻找真相的旅途。',
  '曾是普通人，一场意外觉醒了超凡的力量。',
  '来自异世界的旅人，在这里寻找归乡之路。',
  '为了守护重要之人，不惜与世界为敌。',
  '失去了所有记忆，却拥有最强大的力量。',
  '命运的齿轮开始转动，预言中的勇者降临。',
];

function randomCard(): FateCard {
  const roll = Math.random();
  let rarity: FateCard['rarity'];
  if (roll < 0.50) rarity = 'N';
  else if (roll < 0.80) rarity = 'R';
  else if (roll < 0.95) rarity = 'SR';
  else rarity = 'SSR';

  const i = Math.floor(Math.random() * roles.length);
  return {
    rarity,
    role: roles[i],
    icon: icons[i],
    skill: skills[i],
    world: worlds[i],
    story: stories[Math.floor(Math.random() * stories.length)],
  };
}

let current: FateCard | null = null;
let flipped = false;
let history: FateCard[] = [];

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1>🎲 随机命运生成器</h1>
    <div class="sub">点击卡牌或按钮抽取你的命运</div>
    <div class="draw-area">
      <div class="card ${flipped ? 'flipped' : ''}" id="card">
        <div class="card-inner">
          <div class="card-front">
            <div class="sigil">🌀</div>
            <div class="hint">点击翻转</div>
          </div>
          ${current ? `<div class="card-back ${current.rarity}">
            <div class="rarity ${current.rarity}">${current.rarity}</div>
            <div class="role-icon">${current.icon}</div>
            <div class="role-name">${current.role}</div>
            <div class="role-skill">⚡ ${current.skill}</div>
            <div class="role-world">🌍 ${current.world}</div>
            <div class="story">${current.story}</div>
          </div>` : '<div class="card-back N">等待抽取...</div>'}
        </div>
      </div>
      <button class="draw-btn" id="drawBtn">🎰 抽取命运</button>
    </div>
    ${history.length ? `<div class="history"><h2>📜 历史 (${history.length})</h2>
      ${history.slice(0,10).map(h => `<div class="history-item">
        <span class="rarity ${h.rarity}" style="font-size:.7rem;padding:2px 8px">${h.rarity}</span>
        <span>${h.icon}</span>
        <span>${h.role} · ${h.skill}</span>
      </div>`).join('')}
    </div>` : ''}
  `;

  document.getElementById('card')!.addEventListener('click', () => { if (current) { flipped = !flipped; render(); } });
  document.getElementById('drawBtn')!.addEventListener('click', draw);
}

function draw() {
  const btn = document.getElementById('drawBtn') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = '🔮 命运转动中...';
  flipped = false;

  setTimeout(() => {
    current = randomCard();
    if (current) history.unshift(current);
    flipped = true;
    render();
  }, 1200);
}

render();
