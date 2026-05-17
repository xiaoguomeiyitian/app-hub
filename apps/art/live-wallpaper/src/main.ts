import './style.css';
import '@app-hub/utils/theme/variables.css';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; alpha: number; color: string;
  life: number; maxLife: number;
  phase: number;
  char?: string;
  angle?: number;
}

const THEMES = ['stars','aurora','sakura','bubbles','matrix','fireflies','snow'] as const;
type Theme = typeof THEMES[number];

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W=0,H=0;
function resize(){ W=canvas.width=innerWidth; H=canvas.height=innerHeight; }
resize();
addEventListener('resize', resize);

let theme: Theme='stars';
let particles: Particle[] = [];
let mouseX=W/2, mouseY=H/2;
let density=150, speedMul=8, sizeMul=3;

canvas.addEventListener('pointermove', e=>{ mouseX=e.clientX; mouseY=e.clientY; });

function rand(min:number,max:number){ return min+Math.random()*(max-min); }

function createParticle(t: Theme): Particle {
  const base: Particle = {
    x:0,y:0,vx:0,vy:0,size:3,alpha:1,color:'#fff',life:0,maxLife:300,phase:Math.random()*Math.PI*2,
  };
  const s=speedMul/8, sz=sizeMul/3;
  switch(t){
    case 'stars':
      base.x=Math.random()*W; base.y=Math.random()*H;
      base.size=rand(0.5,2.5)*sz; base.alpha=rand(0.2,1); base.maxLife=rand(200,600);
      base.color=['#ffffff','#aaccff','#ffddaa','#ffaacc','#aaffcc'][Math.floor(Math.random()*5)];
      break;
    case 'aurora':
      base.x=Math.random()*W; base.y=rand(H*0.1,H*0.6);
      base.vx=rand(-0.5,0.5)*s; base.vy=rand(-0.1,0.1)*s;
      base.size=rand(2,8)*sz; base.alpha=rand(0.05,0.2); base.maxLife=rand(200,500);
      base.color=['#00ff88','#00ccff','#8800ff','#ff00cc','#00ffcc'][Math.floor(Math.random()*5)];
      break;
    case 'sakura':
      base.x=rand(-50,W+50); base.y=rand(-50,-10);
      base.vx=rand(-0.5,0.5)*s; base.vy=rand(0.5,2)*s;
      base.size=rand(3,8)*sz; base.alpha=rand(0.5,0.9); base.maxLife=rand(300,600);
      base.angle=Math.random()*Math.PI*2; base.color=['#ffb7c5','#ff69b4','#ffc0cb','#ff91a4','#ffe4e1'][Math.floor(Math.random()*5)];
      break;
    case 'bubbles':
      base.x=Math.random()*W; base.y=H+10;
      base.vx=rand(-0.3,0.3)*s; base.vy=rand(-2,-0.5)*s;
      base.size=rand(2,12)*sz; base.alpha=rand(0.1,0.4); base.maxLife=rand(300,600); base.color='#88ccff';
      break;
    case 'matrix':
      base.x=Math.floor(Math.random()*(W/14))*14; base.y=rand(-200,0);
      base.vy=rand(2,6)*s; base.size=14; base.alpha=1; base.maxLife=rand(100,300);
      base.char=String.fromCharCode(0x30A0+Math.random()*96); base.color='#00ff41';
      break;
    case 'fireflies':
      base.x=Math.random()*W; base.y=Math.random()*H;
      base.vx=rand(-0.5,0.5)*s; base.vy=rand(-0.5,0.5)*s;
      base.size=rand(2,5)*sz; base.alpha=rand(0,1); base.maxLife=rand(200,500); base.color='#ccff00';
      break;
    case 'snow':
      base.x=Math.random()*W; base.y=rand(-20,-5);
      base.vx=rand(-0.5,0.5)*s; base.vy=rand(0.5,2)*s;
      base.size=rand(1,5)*sz; base.alpha=rand(0.4,0.9); base.maxLife=rand(300,700); base.color='#ffffff';
      break;
  }
  return base;
}

function update(p: Particle): boolean {
  p.life++;
  const s=speedMul/8;
  switch(theme){
    case 'stars':
      p.alpha=0.3+Math.sin(p.phase+p.life*0.03)*0.5;
      p.vx+=(mouseX-p.x)*0.00002; p.vy+=(mouseY-p.y)*0.00002;
      break;
    case 'aurora':
      p.x+=p.vx+Math.sin(p.phase+p.life*0.01)*0.5; p.y+=Math.sin(p.phase+p.life*0.02)*0.3;
      p.alpha=0.05+Math.sin(p.phase+p.life*0.02)*0.1;
      break;
    case 'sakura':
      p.x+=p.vx+Math.sin(p.phase+p.life*0.03)*1.5; p.y+=p.vy; p.angle=(p.angle??0)+0.02*s;
      break;
    case 'bubbles':
      p.x+=p.vx+Math.sin(p.phase+p.life*0.02)*0.5; p.y+=p.vy;
      const dx=mouseX-p.x, dy=mouseY-p.y; const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<150){ p.vx+=dx/dist*0.05; p.vy+=dy/dist*0.05; }
      break;
    case 'matrix':
      p.y+=p.vy; if(Math.random()<0.05) p.char=String.fromCharCode(0x30A0+Math.random()*96);
      p.alpha=Math.max(0,1-p.y/H);
      break;
    case 'fireflies':
      p.vx+=rand(-0.1,0.1)*s; p.vy+=rand(-0.1,0.1)*s; p.vx*=0.99; p.vy*=0.99;
      p.vx+=(mouseX-p.x)*0.0003; p.vy+=(mouseY-p.y)*0.0003;
      p.alpha=0.2+Math.sin(p.phase+p.life*0.08)*0.8;
      break;
    case 'snow':
      p.x+=p.vx+Math.sin(p.phase+p.life*0.02)*0.8; p.y+=p.vy;
      break;
  }
  p.x+=p.vx; p.y+=p.vy;
  return p.life<p.maxLife && p.y<H+50 && p.y>-50 && p.x>-50 && p.x<W+50;
}

function draw(p: Particle){
  ctx.globalAlpha=Math.max(0,Math.min(1,p.alpha));
  if(theme==='sakura'){
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle??0);
    ctx.fillStyle=p.color; ctx.beginPath(); ctx.ellipse(0,0,p.size,p.size*0.5,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  }else if(theme==='matrix'){
    ctx.fillStyle=p.color; ctx.font=`${p.size}px monospace`; ctx.fillText(p.char??'0',p.x,p.y);
  }else if(theme==='bubbles'){
    ctx.strokeStyle=p.color; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(p.x-p.size*0.3,p.y-p.size*0.3,p.size*0.3,0,Math.PI*2); ctx.fill();
  }else if(theme==='aurora'){
    ctx.fillStyle=p.color; ctx.beginPath(); ctx.ellipse(p.x,p.y,p.size*3,p.size,0,0,Math.PI*2); ctx.fill();
  }else if(theme==='fireflies'){
    const grad=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size*4);
    grad.addColorStop(0,p.color); grad.addColorStop(1,'transparent');
    ctx.fillStyle=grad; ctx.fillRect(p.x-p.size*4,p.y-p.size*4,p.size*8,p.size*8);
    ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*0.5,0,Math.PI*2); ctx.fill();
  }else{
    ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
  }
}

function getBg(): string{
  switch(theme){
    case 'stars': case 'aurora': return '#0a0a1a';
    case 'sakura': return '#1a0a12';
    case 'bubbles': return '#001a2e';
    case 'matrix': return '#000000';
    case 'fireflies': return '#0a1a05';
    case 'snow': return '#0d1117';
    default: return '#0a0a1a';
  }
}

function animate(){
  ctx.fillStyle=getBg(); ctx.fillRect(0,0,W,H);
  while(particles.length<density) particles.push(createParticle(theme));
  particles=particles.filter(p=>{ const alive=update(p); if(alive) draw(p); return alive; });
  ctx.globalAlpha=1;
  requestAnimationFrame(animate);
}
animate();

// UI
const app=document.getElementById('app')!;
function buildUI(){
  app.innerHTML=`<div class="lw-ui">
    <h1>🌌 动态壁纸生成器</h1>
    <div class="controls">
      <label>主题: ${THEMES.map(t=>`<button class="theme-btn ${theme===t?'active':''}" data-t="${t}">${t}</button>`).join('')}</label>
      <label>粒子密度 <input type="range" id="density" min="20" max="500" value="${density}"/> ${density}</label>
      <label>速度 <input type="range" id="speed" min="1" max="20" value="${speedMul}"/> ${speedMul}</label>
      <label>大小 <input type="range" id="size" min="1" max="10" value="${sizeMul}"/> ${sizeMul}</label>
      <button class="btn primary" id="rec">⏺ 录制 5 秒</button>
    </div>
  </div>`;

  document.querySelectorAll('.theme-btn').forEach(el=>{ el.addEventListener('click',()=>{ theme=(el as HTMLElement).dataset.t as Theme; particles=[]; document.querySelectorAll('.theme-btn').forEach(b=>b.classList.remove('active')); el.classList.add('active'); }); });

  (document.getElementById('density') as HTMLInputElement).addEventListener('input',e=>{ density=+(e.target as HTMLInputElement).value; });
  (document.getElementById('speed') as HTMLInputElement).addEventListener('input',e=>{ speedMul=+(e.target as HTMLInputElement).value; });
  (document.getElementById('size') as HTMLInputElement).addEventListener('input',e=>{ sizeMul=+(e.target as HTMLInputElement).value; });

  document.getElementById('rec')!.addEventListener('click', async ()=>{
    const stream=canvas.captureStream(30);
    const rec=new MediaRecorder(stream,{ mimeType:'video/webm;codecs=vp9' });
    rec.ondataavailable=e=>{ if(e.data.size>0){ const url=URL.createObjectURL(e.data); const a=document.createElement('a'); a.href=url; a.download='wallpaper.webm'; a.click(); URL.revokeObjectURL(url); } };
    rec.start(); await new Promise(r=>setTimeout(r,15000)); rec.stop();
  });
}
buildUI();
