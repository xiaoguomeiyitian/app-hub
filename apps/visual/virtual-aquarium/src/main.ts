import './style.css';

const W = Math.min(900, window.innerWidth - 32);
const H = Math.min(500, Math.floor(W * 500 / 900));
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

interface Fish {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; tailColor: string;
  species: string;
  wobble: number; // for swimming animation
}

interface Bubble { x: number; y: number; vy: number; size: number; alpha: number }
interface Food { x: number; y: number; vy: number; size: number }

let fishes: Fish[] = [];
let bubbles: Bubble[] = [];
let foods: Food[] = [];
let seaweeds: { x: number; height: number; phase: number }[] = [];

const SPECIES: Record<string, { color: string; tail: string; minSize: number; maxSize: number }> = {
  '小丑鱼': { color: '#ff8c00', tail: '#ff6600', minSize: 15, maxSize: 25 },
  '蓝魔鱼': { color: '#4488ff', tail: '#2266dd', minSize: 12, maxSize: 20 },
  '神仙鱼': { color: '#ffcc00', tail: '#ffaa00', minSize: 20, maxSize: 30 },
  '热带鱼': { color: '#ff4488', tail: '#cc2266', minSize: 10, maxSize: 18 },
  '灯笼鱼': { color: '#88ffaa', tail: '#44dd88', minSize: 8, maxSize: 14 },
  '河豚': { color: '#aaddff', tail: '#88bbdd', minSize: 18, maxSize: 28 },
};

function initSeaweeds() {
  seaweeds = [];
  for (let i = 0; i < 15; i++) {
    seaweeds.push({ x: 30 + Math.random() * (W - 60), height: 40 + Math.random() * 80, phase: Math.random() * Math.PI * 2 });
  }
}

function addFish(species: string) {
  const sp = SPECIES[species];
  const size = sp.minSize + Math.random() * (sp.maxSize - sp.minSize);
  const dir = Math.random() > 0.5 ? 1 : -1;
  fishes.push({
    x: dir > 0 ? -30 : W + 30,
    y: 60 + Math.random() * (H - 120),
    vx: dir * (0.5 + Math.random() * 1.5),
    vy: (Math.random() - 0.5) * 0.5,
    size,
    color: sp.color,
    tailColor: sp.tail,
    species,
    wobble: Math.random() * Math.PI * 2,
  });
}

function initFishes() {
  fishes = [];
  for (let i = 0; i < 8; i++) {
    const sp = Object.keys(SPECIES)[Math.floor(Math.random() * Object.keys(SPECIES).length)];
    const spDef = SPECIES[sp];
    const size = spDef.minSize + Math.random() * (spDef.maxSize - spDef.minSize);
    const dir = Math.random() > 0.5 ? 1 : -1;
    fishes.push({
      x: 50 + Math.random() * (W - 100),
      y: 60 + Math.random() * (H - 120),
      vx: dir * (0.5 + Math.random() * 1.5),
      vy: (Math.random() - 0.5) * 0.5,
      size, color: spDef.color, tailColor: spDef.tail,
      species: sp, wobble: Math.random() * Math.PI * 2,
    });
  }
}

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1>🐠 虚拟水族箱</h1>
    <div class="controls">
      ${Object.keys(SPECIES).map(s => `<button class="btn" data-sp="${s}">${s}</button>`).join('')}
      <button class="btn" id="feedBtn">🍞 喂食</button>
      <button class="btn" id="bubbleBtn">🫧 气泡</button>
    </div>
    <canvas id="cv" width="${W}" height="${H}"></canvas>
    <div class="info">点击水面投放鱼 | 点击水面喂食 | 点击底部放气泡</div>
  `;

  document.querySelectorAll('[data-sp]').forEach(el => {
    el.addEventListener('click', () => addFish((el as HTMLElement).dataset.sp!));
  });
  document.getElementById('feedBtn')!.addEventListener('click', () => {
    for (let i = 0; i < 5; i++) foods.push({ x: 100 + Math.random() * (W - 200), y: 10, vy: 0.5 + Math.random() * 0.5, size: 3 });
  });
  document.getElementById('bubbleBtn')!.addEventListener('click', () => {
    for (let i = 0; i < 10; i++) bubbles.push({ x: 50 + Math.random() * (W - 100), y: H, vy: -(1 + Math.random() * 2), size: 2 + Math.random() * 5, alpha: 0.5 + Math.random() * 0.4 });
  });

  const cv = document.getElementById('cv') as HTMLCanvasElement;
  cv.addEventListener('click', e => {
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * W;
    const y = (e.clientY - rect.top) / rect.height * H;
    if (y < 60) {
      // Add random fish
      const sp = Object.keys(SPECIES)[Math.floor(Math.random() * Object.keys(SPECIES).length)];
      addFish(sp);
    } else if (y > H - 40) {
      // Add bubbles
      for (let i = 0; i < 5; i++) bubbles.push({ x: x + (Math.random() - 0.5) * 20, y: H, vy: -(1 + Math.random() * 2), size: 2 + Math.random() * 5, alpha: 0.5 });
    } else {
      // Drop food
      for (let i = 0; i < 3; i++) foods.push({ x: x + (Math.random() - 0.5) * 20, y: y, vy: 0.3 + Math.random() * 0.5, size: 3 });
    }
  });

  canvas = cv;
  ctx = cv.getContext('2d')!;
}

function drawFish(f: Fish) {
  const dir = f.vx > 0 ? 1 : -1;
  const wobbleX = Math.sin(f.wobble) * 2;

  ctx.save();
  ctx.translate(f.x + wobbleX, f.y);
  ctx.scale(dir, 1);

  // Body
  ctx.fillStyle = f.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, f.size, f.size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  ctx.fillStyle = f.tailColor;
  ctx.beginPath();
  const tailWag = Math.sin(f.wobble * 3) * 5;
  ctx.moveTo(-f.size * 0.8, 0);
  ctx.lineTo(-f.size * 1.4, -f.size * 0.4 + tailWag);
  ctx.lineTo(-f.size * 1.4, f.size * 0.4 + tailWag);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(f.size * 0.4, -f.size * 0.1, f.size * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(f.size * 0.45, -f.size * 0.1, f.size * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Dorsal fin
  ctx.fillStyle = f.tailColor;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(-f.size * 0.2, -f.size * 0.45);
  ctx.lineTo(f.size * 0.1, -f.size * 0.8);
  ctx.lineTo(f.size * 0.3, -f.size * 0.45);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

function update() {
  // Water background with gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#001525');
  grad.addColorStop(0.5, '#002040');
  grad.addColorStop(1, '#001830');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Light rays from top
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 5; i++) {
    const x = 100 + i * 180;
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 30, H);
    ctx.lineTo(x + 30, H);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Sand bottom
  ctx.fillStyle = '#c4a35a';
  ctx.fillRect(0, H - 20, W, 20);
  ctx.fillStyle = '#b8973e';
  for (let i = 0; i < W; i += 8) {
    ctx.fillRect(i, H - 20 + Math.random() * 5, 4, 4);
  }

  // Seaweed
  for (const sw of seaweeds) {
    sw.phase += 0.02;
    ctx.strokeStyle = '#2d8a4e';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sw.x, H - 20);
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      const sway = Math.sin(sw.phase + t * 2) * 10 * t;
      ctx.lineTo(sw.x + sway, H - 20 - sw.height * t);
    }
    ctx.stroke();
  }

  // Bubbles
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y += b.vy;
    b.x += Math.sin(b.y * 0.03) * 0.3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(150,200,255,${b.alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = `rgba(200,230,255,${b.alpha * 0.3})`;
    ctx.fill();
    if (b.y < -10) bubbles.splice(i, 1);
  }

  // Food
  for (let i = foods.length - 1; i >= 0; i--) {
    const f = foods[i];
    f.y += f.vy;
    f.vy += 0.01; // slow acceleration
    ctx.fillStyle = '#d4a35a';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
    ctx.fill();
    if (f.y > H - 25) foods.splice(i, 1);
  }

  // Fish AI
  for (const f of fishes) {
    f.wobble += 0.1;

    // Find nearest food
    let nearestFood: Food | null = null;
    let nearestDist = 150;
    for (const food of foods) {
      const d = Math.sqrt((f.x - food.x) ** 2 + (f.y - food.y) ** 2);
      if (d < nearestDist) { nearestDist = d; nearestFood = food; }
    }

    if (nearestFood) {
      // Swim toward food
      const dx = nearestFood.x - f.x;
      const dy = nearestFood.y - f.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      f.vx += (dx / dist) * 0.1;
      f.vy += (dy / dist) * 0.1;
      // Eat food
      if (dist < f.size) {
        const fi = foods.indexOf(nearestFood);
        if (fi >= 0) foods.splice(fi, 1);
      }
    } else {
      // Random wandering
      f.vx += (Math.random() - 0.5) * 0.05;
      f.vy += (Math.random() - 0.5) * 0.03;
    }

    // Avoid edges
    if (f.x < 40) f.vx += 0.1;
    if (f.x > W - 40) f.vx -= 0.1;
    if (f.y < 30) f.vy += 0.05;
    if (f.y > H - 50) f.vy -= 0.05;

    // Speed limit
    const speed = Math.sqrt(f.vx ** 2 + f.vy ** 2);
    if (speed > 2) { f.vx *= 2 / speed; f.vy *= 2 / speed; }

    f.x += f.vx;
    f.y += f.vy;

    // Random bubbles from fish
    if (Math.random() < 0.005) {
      bubbles.push({ x: f.x, y: f.y - f.size * 0.3, vy: -(0.5 + Math.random()), size: 1 + Math.random() * 2, alpha: 0.4 });
    }

    drawFish(f);
  }

  // Water surface shimmer
  ctx.fillStyle = 'rgba(100,180,255,0.05)';
  for (let x = 0; x < W; x += 20) {
    const h = 3 + Math.sin(x * 0.05 + Date.now() * 0.002) * 3;
    ctx.fillRect(x, 0, 15, h);
  }

  requestAnimationFrame(update);
}

initSeaweeds();
initFishes();
render();
update();
