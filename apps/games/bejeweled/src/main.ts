import './style.css';
const SIZE = 8, TYPES = 7;
const COLORS = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c'];
const ICONS = ['💎','🔷','🟢','⭐','💜','🔶','💠'];
type Grid = number[][];
let grid: Grid, score = 0, selected: [number,number]|null = null;

function init(): void {
  grid = Array.from({length:SIZE}, () => Array.from({length:SIZE}, () => Math.floor(Math.random()*TYPES)));
  // Remove initial matches
  let hasMatch = true;
  while(hasMatch) { hasMatch = false; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) {
    if(c>=2 && grid[r][c]===grid[r][c-1] && grid[r][c]===grid[r][c-2]) { grid[r][c]=(grid[r][c]+1)%TYPES; hasMatch=true; }
    if(r>=2 && grid[r][c]===grid[r-1][c] && grid[r][c]===grid[r-2][c]) { grid[r][c]=(grid[r][c]+1)%TYPES; hasMatch=true; }
  }}
  score = 0; selected = null;
}

function swap(r1:number,c1:number,r2:number,c2:number): void { [grid[r1][c1],grid[r2][c2]]=[grid[r2][c2],grid[r1][c1]]; }

function findMatches(): [number,number][] {
  const matches: [number,number][] = [];
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) {
    if(c>=2 && grid[r][c]===grid[r][c-1] && grid[r][c]===grid[r][c-2]) matches.push([r,c],[r,c-1],[r,c-2]);
    if(r>=2 && grid[r][c]===grid[r-1][c] && grid[r][c]===grid[r-2][c]) matches.push([r,c],[r-1,c],[r-2,c]);
  }
  return [...new Set(matches.map(([r,c])=>`${r},${c}`))].map(s=>s.split(',').map(Number) as [number,number]);
}

function removeAndDrop(): void {
  let matches = findMatches();
  while(matches.length > 0) {
    score += matches.length * 10;
    for(const [r,c] of matches) grid[r][c] = -1;
    // Drop
    for(let c=0;c<SIZE;c++) {
      let write = SIZE-1;
      for(let r=SIZE-1;r>=0;r--) { if(grid[r][c]!==-1) { grid[write][c]=grid[r][c]; if(write!==r) grid[r][c]=-1; write--; } }
      for(let r=write;r>=0;r--) grid[r][c] = Math.floor(Math.random()*TYPES);
    }
    matches = findMatches();
  }
}

const app = document.getElementById('app')!;
function render(): void {
  app.innerHTML = `<div class="bjw-wrapper">
    <div class="bjw-header"><span>💎 宝石迷阵</span><span>得分: ${score}</span><button id="bjw-restart" class="bjw-btn">重开</button></div>
    <div class="bjw-grid" style="grid-template-columns:repeat(${SIZE},1fr)">
      ${grid.map((row,r)=>row.map((cell,c)=>{
        const sel = selected && selected[0]===r && selected[1]===c;
        return `<div class="bjw-cell ${sel?'bjw-sel':''}" data-r="${r}" data-c="${c}" style="background:${COLORS[cell]||'#333'}">${ICONS[cell]||''}</div>`;
      }).join('')).join('')}
    </div>
  </div>`;
  document.querySelectorAll('[data-r]').forEach(el=>el.addEventListener('click',()=>{
    const r=parseInt((el as HTMLElement).dataset.r!),c=parseInt((el as HTMLElement).dataset.c!);
    if(!selected) selected=[r,c];
    else {
      const [sr,sc]=selected;
      if(Math.abs(sr-r)+Math.abs(sc-c)===1) { swap(sr,sc,r,c); const m=findMatches(); if(m.length===0) swap(sr,sc,r,c); else removeAndDrop(); }
      selected=null;
    }
    render();
  }));
  document.getElementById('bjw-restart')?.addEventListener('click',()=>{init();render();});
}
init(); render();
