/// <reference types="vite/client" />
import './style.css';
const W=300,H=500;
interface Bullet{x:number;y:number;dx:number;dy:number;enemy:boolean}
interface Enemy{x:number;y:number;hp:number;type:number;shootTimer:number}
interface PowerUp{x:number;y:number;type:'shield'|'spread'|'speed'}
interface Particle{x:number;y:number;dx:number;dy:number;life:number;color: string}

let px=W/2,py=H-60,score=0,lives=3,wave=1,alive=true,started=false;
let bullets:Bullet[]=[],enemies:Enemy[]=[],powerUps:PowerUp[]=[],particles:Particle[]=[];
let shield=0,spread=0,speedBoost=0,frameCount=0;
let best=0;const BEST_KEY='ss_best';try{best=parseInt(localStorage.getItem(BEST_KEY)||'0',10)||0;}catch{}
let audioCtx:AudioContext|null=null;
function sfx(f:number,d:number,t:OscillatorType='square'){if(!audioCtx)try{audioCtx=new AudioContext();}catch{return;}const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=t;o.frequency.value=f;g.gain.setValueAtTime(.08,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d);}
function saveBest(){if(score>best){best=score;try{localStorage.setItem(BEST_KEY,String(best));}catch{}}}
function spawnWave(){for(let i=0;i<wave+3;i++){enemies.push({x:30+Math.random()*(W-60),y:-20-Math.random()*100,hp:wave>3?2:1,type:Math.floor(Math.random()*3),shootTimer:Math.random()*100|0});}}
function init(){px=W/2;py=H-60;score=0;lives=3;wave=1;alive=true;started=true;bullets=[];enemies=[];powerUps=[];particles=[];shield=0;spread=0;speedBoost=0;spawnWave();}
function explode(x:number,y:number,c:string){for(let i=0;i<8;i++)particles.push({x,y,dx:(Math.random()-.5)*6,dy:(Math.random()-.5)*6,life:20+Math.random()*10|0,color:c});}
function update(){
  if(!alive||!started)return;frameCount++;
  if(shield>0)shield--;if(spread>0)spread--;if(speedBoost>0)speedBoost--;
  const spd=speedBoost>0?6:4;
  if(keys['ArrowLeft']||keys['a'])px=Math.max(15,px-spd);
  if(keys['ArrowRight']||keys['d'])px=Math.min(W-15,px+spd);
  if(keys['ArrowUp']||keys['w'])py=Math.max(H/2,py-spd);
  if(keys['ArrowDown']||keys['s'])py=Math.min(H-20,py+spd);
  // Auto-shoot
  if(frameCount%8===0){bullets.push({x:px,y:py-15,dx:0,dy:-8,enemy:false});if(spread>0){bullets.push({x:px-10,y:py-10,dx:-2,dy:-7,enemy:false});bullets.push({x:px+10,y:py-10,dx:2,dy:-7,enemy:false});}sfx(880,.05);}
  // Update bullets
  bullets=bullets.filter(b=>{b.x+=b.dx;b.y+=b.dy;return b.y>-20&&b.y<H+20&&b.x>-20&&b.x<W+20;});
  // Update enemies
  enemies.forEach(e=>{e.y+=.5+wave*.1;e.x+=Math.sin(frameCount*.02+e.type)*1;e.shootTimer--;if(e.shootTimer<=0&&Math.random()<.3){bullets.push({x:e.x,y:e.y+15,dx:0,dy:4,enemy:true});e.shootTimer=60+Math.random()*60|0;}});
  enemies=enemies.filter(e=>e.y<H+20);
  // Player bullets vs enemies
  bullets.filter(b=>!b.enemy).forEach(b=>{enemies.forEach(e=>{if(Math.abs(b.x-e.x)<18&&Math.abs(b.y-e.y)<18){e.hp--;b.y=-999;if(e.hp<=0){score+=100*wave;explode(e.x,e.y,'#ff0');e.y=9999;sfx(200,.15,'sawtooth');if(Math.random()<.15)powerUps.push({x:e.x,y:e.y,type:['shield','spread','speed'][Math.floor(Math.random()*3)] as PowerUp['type']});}}});});
  enemies=enemies.filter(e=>e.y<9000);
  // Enemy bullets vs player
  if(shield<=0){bullets.filter(b=>b.enemy).forEach(b=>{if(Math.abs(b.x-px)<12&&Math.abs(b.y-py)<12){lives--;b.y=999;explode(px,py,'#f00');sfx(150,.3,'sawtooth');if(lives<=0){alive=false;saveBest();}}});}
  // Power-ups
  powerUps=powerUps.filter(p=>{p.y+=2;if(Math.abs(p.x-px)<20&&Math.abs(p.y-py)<20){if(p.type==='shield')shield=300;if(p.type==='spread')spread=300;if(p.type==='speed')speedBoost=300;sfx(1200,.15,'sine');return false;}return p.y<H;});
  // Particles
  particles=particles.filter(p=>{p.x+=p.dx;p.y+=p.dy;p.life--;return p.life>0;});
  // Wave complete
  if(enemies.length===0){wave++;spawnWave();sfx(660,.2,'sine');}
}
const keys:Record<string,boolean>={};
window.addEventListener('keydown',e=>{keys[e.key]=true;});
window.addEventListener('keyup',e=>{keys[e.key]=false;});
// Touch
let touchX=0;let touchActive=false;
document.addEventListener('touchstart',e=>{const t=e.touches[0];touchX=t.clientX;touchActive=true;},{passive:true});
document.addEventListener('touchmove',e=>{if(!touchActive)return;const t=e.touches[0];const dx=t.clientX-touchX;px=Math.max(15,Math.min(W-15,px+dx*.5));touchX=t.clientX;},{passive:true});
document.addEventListener('touchend',()=>{touchActive=false;});
const app=document.getElementById('app')!;
function render(){
  app.innerHTML=`<div class="ss-wrapper"><div class="ss-header"><span class="ss-title">🚀 太空射击</span><div class="ss-info"><span>分数:${score}</span><span>❤️×${lives}</span><span>波次:${wave}</span><span class="ss-best">最佳:${best}</span></div></div><div class="ss-canvas-wrap"><canvas id="ss-canvas" width="${W}" height="${H}"></canvas>${!started?'<div class="ss-overlay"><div><h2>🚀 太空射击</h2><p>方向键/触屏移动</p><p>自动射击</p><button class="ss-btn primary" id="ss-go">开始</button></div></div>':''}${!alive?`<div class="ss-overlay"><div><h2>游戏结束</h2><div class="ss-score">${score}</div><p>波次:${wave}</p><button class="ss-btn primary" id="ss-retry">再来</button></div></div>`:''}</div></div>`;
  const c=document.getElementById('ss-canvas') as HTMLCanvasElement;const ctx=c.getContext('2d')!;
  ctx.fillStyle='#050510';ctx.fillRect(0,0,W,H);
  // Stars
  for(let i=0;i<30;i++){ctx.fillStyle='#fff';ctx.fillRect((i*97+frameCount)%W,(i*53+frameCount*.5)%H,1,1);}
  // Player
  ctx.fillStyle=shield>0?'#48dbfb':'#5f27cd';ctx.beginPath();ctx.moveTo(px,py-15);ctx.lineTo(px-12,py+10);ctx.lineTo(px+12,py+10);ctx.fill();
  // Enemies
  enemies.forEach(e=>{ctx.fillStyle=['#e74c3c','#f39c12','#9b59b6'][e.type];ctx.fillRect(e.x-12,e.y-8,24,16);ctx.fillStyle='#fff';ctx.fillRect(e.x-4,e.y-4,3,3);ctx.fillRect(e.x+1,e.y-4,3,3);});
  // Bullets
  bullets.forEach(b=>{ctx.fillStyle=b.enemy?'#ff6b6b':'#48dbfb';ctx.fillRect(b.x-2,b.y-6,4,12);});
  // Power-ups
  powerUps.forEach(p=>{ctx.fillStyle={shield:'#48dbfb',spread:'#feca57',speed:'#2ecc71'}[p.type];ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='8px sans-serif';ctx.textAlign='center';ctx.fillText(p.type[0].toUpperCase(),p.x,p.y+3);});
  // Particles
  particles.forEach(p=>{ctx.fillStyle=p.color;ctx.globalAlpha=p.life/30;ctx.fillRect(p.x,p.y,3,3);ctx.globalAlpha=1;});
  document.getElementById('ss-go')?.addEventListener('click',init);
  document.getElementById('ss-retry')?.addEventListener('click',init);
}
init();alive=false;started=false;
setInterval(()=>{update();render();},16);render();
