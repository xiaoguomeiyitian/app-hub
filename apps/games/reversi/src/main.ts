import './style.css';
const SIZE=8;
let board:number[][]=Array.from({length:SIZE},()=>Array(SIZE).fill(0));
let turn=1,score=[0,0];
let mode:'ai'|'online'='ai';
let connState='离线';
let matchState='';
let resultText='';

function init():void{
  board=Array.from({length:SIZE},()=>Array(SIZE).fill(0));
  board[3][3]=2;board[4][4]=2;board[3][4]=1;board[4][3]=1;turn=1;updateScore();resultText='';matchState='';connState='离线';
}

function canPlace(r:number,c:number,p:number):boolean{
  if(board[r][c]!==0)return false;
  const opp=p===1?2:1;
  for(const[dr,dc]of[[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]as[number,number][]){
    let nr=r+dr,nc=c+dc,found=false;
    while(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[nr][nc]===opp){nr+=dr;nc+=dc;found=true;}
    if(found&&nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[nr][nc]===p)return true;
  }return false;
}

function flip(r:number,c:number,p:number):void{
  board[r][c]=p;
  const opp=p===1?2:1;
  for(const[dr,dc]of[[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]as[number,number][]){
    const toFlip:[number,number][]=[];
    let nr=r+dr,nc=c+dc;
    while(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[nr][nc]===opp){toFlip.push([nr,nc]);nr+=dr;nc+=dc;}
    if(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[nr][nc]===p)for(const[fr,fc]of toFlip)board[fr][fc]=p;
  }
}

function updateScore():void{score=[0,0];for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){if(board[r][c]===1)score[0]++;if(board[r][c]===2)score[1]++;}}

function aiMove():void{
  let best:{r:number,c:number,flips:number}|null=null;
  for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
    if(canPlace(r,c,2)){
      let f=0;const opp=1;
      for(const[dr,dc]of[[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]as[number,number][]){
        let nr=r+dr,nc=c+dc,cnt=0;
        while(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[nr][nc]===opp){cnt++;nr+=dr;nc+=dc;}
        if(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[nr][nc]===2)f+=cnt;
      }
      if(!best||f>best.flips)best={r,c,flips:f};
    }
  }
  if(best){flip(best.r,best.c,2);turn=1;updateScore();render();}
}

const app=document.getElementById('app')!;
function render():void{
  const avail=turn===1?board.some((row,r)=>row.some((_,c)=>canPlace(r,c,1))):true;
  app.innerHTML=`<div class="rv-wrapper"><div class="rv-header"><span>🔄 黑白棋</span><span>⚫${score[0]} ⚪${score[1]}</span><button id="rv-restart" class="rv-btn">重开</button></div>
  <div class="rv-topbar"><button id="rv-mode-ai" class="rv-btn ${mode==='ai'?'primary':''}">单机</button><button id="rv-mode-online" class="rv-btn ${mode==='online'?'primary':''}">联机入口</button><span class="rv-conn">${connState}</span><span class="rv-match">${matchState}</span></div>
  <div class="rv-grid" style="grid-template-columns:repeat(${SIZE},1fr)">${board.map((row,r)=>row.map((cell,c)=>{
    const can=turn===1&&canPlace(r,c,1);
    return`<div class="rv-cell ${cell===1?'rv-black':cell===2?'rv-white':''} ${can?'rv-can':''}" data-r="${r}" data-c="${c}"></div>`;
  }).join('')).join('')}</div>
  <div class="rv-turn">${turn===1?'⚫ 你':'⚪ AI'} 回合 ${!avail?'(无子可下)':''}</div>
  <div class="rv-result">${resultText}</div></div>`;
  document.querySelectorAll('[data-r]').forEach(el=>el.addEventListener('click',()=>{
    if(turn!==1||mode==='online')return;
    const r=parseInt((el as HTMLElement).dataset.r!),c=parseInt((el as HTMLElement).dataset.c!);
    if(!canPlace(r,c,1))return;
    flip(r,c,1);updateScore();turn=2;render();setTimeout(aiMove,400);
  }));
  document.getElementById('rv-restart')?.addEventListener('click',()=>{init();render();});
  document.getElementById('rv-mode-ai')?.addEventListener('click',()=>{mode='ai';connState='离线';matchState='';resultText='';render();});
  document.getElementById('rv-mode-online')?.addEventListener('click',()=>{mode='online';connState='🟡 准备联机';matchState='匹配 / 好友房入口待接入';resultText='联机样板入口已预留';render();});
}
init();render();
