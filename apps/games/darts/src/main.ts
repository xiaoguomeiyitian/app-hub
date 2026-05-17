import './style.css';
const SECTIONS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
let score = 301, throws = 0, history: number[] = [];

function getScore(x: number, y: number): number {
  const cx=150,cy=150,dist=Math.sqrt((x-cx)**2+(y-cy)**2);
  if(dist<6) return 50; // bullseye
  if(dist<12) return 25; // outer bull
  let angle = Math.atan2(y-cy,x-cx)*180/Math.PI+90;
  if(angle<0) angle+=360;
  const idx = Math.floor((angle%360)/18)%20;
  const section = SECTIONS[idx];
  if(dist>130&&dist<142) return section*3; // triple
  if(dist>142&&dist<155) return section*2; // double
  if(dist<130) return section;
  return 0;
}

let lastHit = '';

function handleThrow(e: MouseEvent): void {
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  const x = (e.clientX-rect.left)/rect.width*300;
  const y = (e.clientY-rect.top)/rect.height*300;
  const pts = getScore(x,y);
  if(score-pts>=0) { score-=pts; throws++; history.push(pts); lastHit=pts>0?`+${pts}`:'Miss'; }
  else lastHit='Bust!';
  render();
}

const app = document.getElementById('app')!;
function render(): void {
  app.innerHTML = `<div class="dt-wrapper">
    <div class="dt-header"><span>🎯 飞镖 301</span><span>剩余: ${score} | 投掷: ${throws}</span><button id="dt-restart" class="dt-btn">重开</button></div>
    <div class="dt-board" id="dt-board">
      <svg viewBox="0 0 300 300" width="300" height="300">
        <circle cx="150" cy="150" r="155" fill="#222" stroke="#444" stroke-width="2"/>
        ${SECTIONS.map((s,i)=>{
          const a1=(i*18-9)*Math.PI/180, a2=(i*18+9)*Math.PI/180;
          const x1=150+155*Math.sin(a1),y1=150-155*Math.cos(a1);
          const x2=150+155*Math.sin(a2),y2=150-155*Math.cos(a2);
          return `<text x="${150+140*Math.sin(i*18*Math.PI/180)}" y="${150-140*Math.cos(i*18*Math.PI/180)}" fill="#aaa" font-size="10" text-anchor="middle">${s}</text>`;
        }).join('')}
        <circle cx="150" cy="150" r="12" fill="#2ecc71" stroke="#27ae60" stroke-width="1"/>
        <circle cx="150" cy="150" r="6" fill="#e74c3c" stroke="#c0392b" stroke-width="1"/>
        <circle cx="150" cy="150" r="155" fill="none" stroke="#444" stroke-width="2"/>
      </svg>
    </div>
    <div class="dt-last">${lastHit}</div>
    <div class="dt-history">${history.slice(-10).map(h=>`<span class="dt-hist">${h}</span>`).join(' ')}</div>
    ${score===0?'<div class="dt-win">🎉 完成！'+throws+'投</div>':''}
  </div>`;
  document.getElementById('dt-board')?.addEventListener('click',(e)=>handleThrow(e as any));
  document.getElementById('dt-restart')?.addEventListener('click',()=>{score=301;throws=0;history=[];lastHit='';render();});
}
render();
