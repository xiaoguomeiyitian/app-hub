import './style.css';
type Role='werewolf'|'villager'|'seer'|'witch'|'hunter'|'guard';
type Phase='night'|'day_discuss'|'day_vote'|'finished';
interface Player{id:number;name:string;role:Role;alive:boolean;votes:number;}
const ROLE_NAMES:Record<Role,string>={werewolf:'🐺 狼人',villager:'👤 村民',seer:'🔮 预言家',witch:'🧙 女巫',hunter:'🔫 猎人',guard:'🛡️ 守卫'};

let players:Player[]=[],phase:Phase='night',nightAction='',dayTarget=-1,winner='',log:string[];

function init():void{
  const names=['你','玩家2','玩家3','玩家4','玩家5','玩家6'];
  const roles:Role[]=['werewolf','werewolf','villager','seer','witch','villager'];
  players=names.map((n,i)=>({id:i,name:n,role:roles[i],alive:true,votes:0}));
  phase='night';nightAction='';dayTarget=-1;winner='';log=['游戏开始！夜晚降临...'];
}

function checkWin():string{
  const wolves=players.filter(p=>p.alive&&p.role==='werewolf').length;
  const villagers=players.filter(p=>p.alive&&p.role!=='werewolf').length;
  if(wolves===0)return '好人阵营获胜！🎉';
  if(wolves>=villagers)return '狼人阵营获胜！🐺';
  return '';
}

const app=document.getElementById('app')!;
function render():void{
  const aliveList=players.filter(p=>p.alive);
  app.innerHTML=`<div class="ww-wrapper">
    <div class="ww-header"><span>🐺 狼人杀</span><span>${phase==='night'?'🌙 夜晚':'☀️ 白天'}</span><button id="ww-restart" class="ww-btn">重开</button></div>
    <div class="ww-phase">${phase==='night'?'狼人请睁眼...':phase==='day_discuss'?'讨论阶段':'投票阶段'}</div>
    <div class="ww-players">${players.map(p=>`<div class="ww-player ${p.alive?'':'ww-dead'} ${p.id===0?'ww-you':''}">${p.name} ${p.alive?'':'💀'} ${p.id===0&&p.alive?ROLE_NAMES[p.role]:''}</div>`).join('')}</div>
    ${renderActions()}
    ${winner?`<div class="ww-winner">${winner}</div>`:''}
    <div class="ww-log">${log.slice(0,5).map(l=>`<div>${l}</div>`).join('')}</div>
  </div>`;
  bindEvents();
}

function renderActions():string{
  if(winner)return'';
  const me=players[0];
  if(phase==='night'&&me.alive&&me.role==='werewolf'){
    return`<div class="ww-actions"><p>选择袭击目标：</p>${players.filter(p=>p.alive&&p.role!=='werewolf').map(p=>`<button class="ww-btn" data-action="kill" data-id="${p.id}">${p.name}</button>`).join('')}</div>`;
  }
  if(phase==='day_discuss'){
    return`<div class="ww-actions"><button class="ww-btn primary" data-action="vote_start">开始投票</button></div>`;
  }
  if(phase==='day_vote'){
    return`<div class="ww-actions"><p>投票放逐：</p>${players.filter(p=>p.alive&&p.id!==0).map(p=>`<button class="ww-btn" data-action="vote" data-id="${p.id}">${p.name}</button>`).join('')}<button class="ww-btn" data-action="skip">跳过</button></div>`;
  }
  return'';
}

function bindEvents():void{
  document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>{
    const action=(el as HTMLElement).dataset.action!;
    const id=parseInt((el as HTMLElement).dataset.id||'-1');
    if(action==='kill'){
      players[id].alive=false;
      log.unshift(`夜晚：${players[id].name} 被袭击了！`);
      phase='day_discuss';
      const w=checkWin();if(w){winner=w;}
      render();
    }
    if(action==='vote_start'){phase='day_vote';render();}
    if(action==='vote'){
      // AI votes randomly
      for(const p of players){if(p.alive&&p.id!==0)p.votes=Math.random()>0.5?1:0;}
      players[id].votes++;
      const voted=players.filter(p=>p.alive).sort((a,b)=>b.votes-a.votes)[0];
      if(voted&&voted.votes>0){voted.alive=false;log.unshift(`白天：${voted.name} 被投票出局！`);}
      phase='night';log.unshift('夜晚降临...');
      const w=checkWin();if(w){winner=w;}else{
        // AI wolf kills
        const targets=players.filter(p=>p.alive&&p.role!=='werewolf');
        if(targets.length){const t=targets[Math.floor(Math.random()*targets.length)];t.alive=false;log.unshift(`夜晚：${t.name} 被袭击了！`);}
        const w2=checkWin();if(w2)winner=w2;
      }
      render();
    }
    if(action==='skip'){phase='night';log.unshift('夜晚降临...');render();}
  }));
  document.getElementById('ww-restart')?.addEventListener('click',()=>{init();render();});
}
init();render();
