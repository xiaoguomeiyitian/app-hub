import './style.css';
const SIZE=9;
let board: number[][] = Array.from({length:SIZE},()=>Array(SIZE).fill(0)); // 0=empty,1=black,2=white
let turn = 1;
let captured = {black:0,white:0};

function place(r:number,c:number): boolean {
  if(board[r][c]!==0) return false;
  board[r][c]=turn;
  // Simple capture: check if any opponent group has no liberties
  const opp = turn===1?2:1;
  const visited = new Set<string>();
  for(const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]] as [number,number][]) {
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[nr][nc]===opp&&!visited.has(`${nr},${nc}`)) {
      if(!hasLiberty(nr,nc,opp,visited)) { captureGroup(nr,nc,opp); }
    }
  }
  turn = turn===1?2:1;
  return true;
}

function hasLiberty(r:number,c:number,p:number,visited:Set<string>): boolean {
  const key=`${r},${c}`;
  if(visited.has(key)) return false;
  if(r<0||r>=SIZE||c<0||c>=SIZE) return false;
  if(board[r][c]===0) return true;
  if(board[r][c]!==p) return false;
  visited.add(key);
  return [[0,1],[0,-1],[1,0],[-1,0]].some(([dr,dc])=>hasLiberty(r+dr,c+dc,p,visited));
}

function captureGroup(r:number,c:number,p:number): void {
  const visited = new Set<string>();
  const group: [number,number][] = [];
  const stack = [[r,c]];
  while(stack.length) {
    const [cr,cc]=stack.pop()!;
    const key=`${cr},${cc}`;
    if(visited.has(key)||cr<0||cr>=SIZE||cc<0||cc>=SIZE||board[cr][cc]!==p) continue;
    visited.add(key); group.push([cr,cc]);
    stack.push([cr+1,cc],[cr-1,cc],[cr,cc+1],[cr,cc-1]);
  }
  for(const [gr,gc] of group) board[gr][gc]=0;
  captured[turn===1?'black':'white']+=group.length;
}

const app = document.getElementById('app')!;
function render(): void {
  const cellSize = SIZE<=9?40:32;
  app.innerHTML = `<div class="go-wrapper">
    <div class="go-header"><span>⚫ 围棋 ${SIZE}×${SIZE}</span><span>黑 ${captured.black} | 白 ${captured.white}</span><button id="go-restart" class="go-btn">重开</button></div>
    <div class="go-board" style="grid-template-columns:repeat(${SIZE},1fr)">
      ${board.map((row,r)=>row.map((cell,c)=>`<div class="go-cell ${cell===1?'go-black':cell===2?'go-white':''}" data-r="${r}" data-c="${c}"></div>`).join('')).join('')}
    </div>
    <div class="go-turn">${turn===1?'⚫ 黑方':'⚪ 白方'} 回合</div>
  </div>`;
  document.querySelectorAll('[data-r]').forEach(el=>el.addEventListener('click',()=>{
    const r=parseInt((el as HTMLElement).dataset.r!),c=parseInt((el as HTMLElement).dataset.c!);
    if(place(r,c)) render();
  }));
  document.getElementById('go-restart')?.addEventListener('click',()=>{board=Array.from({length:SIZE},()=>Array(SIZE).fill(0));turn=1;captured={black:0,white:0};render();});
}
render();
