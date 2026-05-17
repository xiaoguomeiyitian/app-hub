const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const info = document.getElementById('info')!;
let W: number = 0;
let H: number = 0;

function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize();
addEventListener('resize', resize);

const RADIUS = 200; // Fixed radius, recalculated in render
const STAR_COUNT = 500;

interface Star { x: number; y: number; size: number; alpha: number }
interface City { lat: number; lon: number; name: string; pop: number }

const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  size: Math.random() * 1.5 + 0.3,
  alpha: Math.random() * 0.8 + 0.2,
}));

// Major cities
const cities: City[] = [
  { lat: 39.9, lon: 116.4, name: '北京', pop: 21 },
  { lat: 35.7, lon: 139.7, name: '东京', pop: 37 },
  { lat: 40.7, lon: -74.0, name: '纽约', pop: 20 },
  { lat: 51.5, lon: -0.1, name: '伦敦', pop: 9 },
  { lat: 48.9, lon: 2.3, name: '巴黎', pop: 11 },
  { lat: 55.8, lon: 37.6, name: '莫斯科', pop: 12 },
  { lat: -33.9, lon: 151.2, name: '悉尼', pop: 5 },
  { lat: 22.3, lon: 114.2, name: '香港', pop: 7 },
  { lat: 1.3, lon: 103.8, name: '新加坡', pop: 6 },
  { lat: 37.6, lon: 127.0, name: '首尔', pop: 10 },
  { lat: 19.4, lon: -99.1, name: '墨西哥城', pop: 21 },
  { lat: -23.5, lon: -46.6, name: '圣保罗', pop: 22 },
  { lat: 28.6, lon: 77.2, name: '新德里', pop: 32 },
  { lat: 31.2, lon: 121.5, name: '上海', pop: 28 },
  { lat: 25.2, lon: 55.3, name: '迪拜', pop: 3 },
  { lat: 34.1, lon: -118.2, name: '洛杉矶', pop: 4 },
  { lat: 41.9, lon: 12.5, name: '罗马', pop: 3 },
  { lat: 52.5, lon: 13.4, name: '柏林', pop: 4 },
  { lat: 30.0, lon: 31.2, name: '开罗', pop: 21 },
  { lat: -1.3, lon: 36.8, name: '内罗毕', pop: 5 },
  { lat: 13.8, lon: 100.5, name: '曼谷', pop: 11 },
  { lat: -6.2, lon: 106.8, name: '雅加达', pop: 11 },
  { lat: 33.9, lon: -118.4, name: '洛杉矶', pop: 4 },
  { lat: 45.5, lon: -73.6, name: '蒙特利尔', pop: 4 },
  { lat: -34.6, lon: -58.4, name: '布宜诺斯', pop: 15 },
];

let rotY = 0;
let rotX = 0.15;
let dragRotY = 0;
let dragRotX = 0;
let dragging = false;
let lastMX = 0, lastMY = 0;
let autoRotate = true;

canvas.addEventListener('pointerdown', e => { dragging = true; lastMX = e.clientX; lastMY = e.clientY; autoRotate = false; });
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  dragRotY += (e.clientX - lastMX) * 0.005;
  dragRotX += (e.clientY - lastMY) * 0.005;
  dragRotX = Math.max(-0.8, Math.min(0.8, dragRotX));
  lastMX = e.clientX; lastMY = e.clientY;
});
canvas.addEventListener('pointerup', () => { dragging = false; setTimeout(() => { autoRotate = true; }, 3000); });

function latLonTo3D(lat: number, lon: number): { x: number; y: number; z: number } {
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  return {
    x: Math.cos(latRad) * Math.sin(lonRad) * RADIUS,
    y: -Math.sin(latRad) * RADIUS,
    z: Math.cos(latRad) * Math.cos(lonRad) * RADIUS,
  };
}

function rotate3D(x: number, y: number, z: number): { x: number; y: number; z: number } {
  // Rotate Y
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  let x1 = x * cosY - z * sinY;
  let z1 = x * sinY + z * cosY;
  // Rotate X
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  let y1 = y * cosX - z1 * sinX;
  let z2 = y * sinX + z1 * cosX;
  return { x: x1, y: y1, z: z2 };
}

function project(x: number, y: number, z: number): { sx: number; sy: number; scale: number } {
  const fov = 600;
  const scale = fov / (fov + z + RADIUS * 2);
  return { sx: x * scale + W / 2, sy: y * scale + H / 2, scale };
}

// Simplified land check (approximate continents)
function isLand(lat: number, lon: number): boolean {
  // Normalize lon to -180..180
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;

  // Asia
  if (lat > 20 && lat < 60 && lon > 60 && lon < 150) return true;
  if (lat > 45 && lat < 75 && lon > 30 && lon < 60) return true;
  // Europe
  if (lat > 35 && lat < 60 && lon > -10 && lon < 30) return true;
  // Africa
  if (lat > -35 && lat < 35 && lon > -20 && lon < 50) return true;
  // North America
  if (lat > 25 && lat < 70 && lon > -130 && lon < -60) return true;
  if (lat > 15 && lat < 30 && lon > -120 && lon < -80) return true;
  // South America
  if (lat > -55 && lat < 10 && lon > -80 && lon < -35) return true;
  // Australia
  if (lat > -40 && lat < -10 && lon > 110 && lon < 155) return true;
  // India
  if (lat > 8 && lat < 35 && lon > 68 && lon < 90) return true;
  // Japan/Korea
  if (lat > 30 && lat < 45 && lon > 125 && lon < 145) return true;
  // Southeast Asia
  if (lat > -10 && lat < 20 && lon > 95 && lon < 120) return true;
  // Greenland
  if (lat > 60 && lat < 83 && lon > -55 && lon < -15) return true;

  return false;
}

function getSunLon(): number {
  // Sun longitude based on UTC time
  const now = new Date();
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  return -(utcHours / 24 * 360 - 180); // sun at noon = 0°
}

function isDaytime(lat: number, lon: number): boolean {
  const sunLon = getSunLon();
  let dLon = lon - sunLon;
  while (dLon > 180) dLon -= 360;
  while (dLon < -180) dLon += 360;
  return Math.abs(dLon) < 90;
}

function render() {
  // Update size
  const r = Math.min(W, H) * 0.32;

  // Background
  ctx.fillStyle = '#000508';
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (const s of stars) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,220,255,${s.alpha})`;
    ctx.fill();
  }

  // Milky way hint
  const mwGrad = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.5, H * 0.5, W * 0.6);
  mwGrad.addColorStop(0, 'rgba(80,100,150,0.05)');
  mwGrad.addColorStop(0.5, 'rgba(60,80,120,0.03)');
  mwGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = mwGrad;
  ctx.fillRect(0, 0, W, H);

  // Earth atmosphere glow
  const atmGrad = ctx.createRadialGradient(W / 2, H / 2, r * 0.9, W / 2, H / 2, r * 1.15);
  atmGrad.addColorStop(0, 'rgba(60,130,255,0)');
  atmGrad.addColorStop(0.5, 'rgba(60,130,255,0.08)');
  atmGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = atmGrad;
  ctx.fillRect(0, 0, W, H);

  // Draw earth surface - render as grid points
  const gridStep = 3;
  const points: { sx: number; sy: number; depth: number; lat: number; lon: number; scale: number }[] = [];

  for (let lat = -90; lat <= 90; lat += gridStep) {
    for (let lon = -180; lon <= 180; lon += gridStep) {
      const p3d = latLonTo3D(lat, lon);
      const pr = rotate3D(p3d.x, p3d.y, p3d.z);

      // Only render front-facing points
      if (pr.z < 0) continue;

      const screen = project(pr.x, pr.y, pr.z);
      // Check if on sphere
      const distFromCenter = Math.sqrt((screen.sx - W / 2) ** 2 + (screen.sy - H / 2) ** 2);
      if (distFromCenter > r * screen.scale * 1.05) continue;

      points.push({ sx: screen.sx, sy: screen.sy, depth: pr.z, lat, lon, scale: screen.scale });
    }
  }

  // Sort by depth (back to front)
  points.sort((a, b) => a.depth - b.depth);

  const sunLon = getSunLon();

  for (const p of points) {
    let dLon = p.lon - sunLon;
    while (dLon > 180) dLon -= 360;
    while (dLon < -180) dLon += 360;
    const dayFactor = Math.max(0, Math.min(1, (90 - Math.abs(dLon)) / 30)); // 0=night, 1=day

    const land = isLand(p.lat, p.lon);
    const size = Math.max(1.5, 2.5 * p.scale);

    let r2: number, g: number, b: number;
    if (land) {
      if (dayFactor > 0.5) {
        // Day: green-brown land
        const t = dayFactor;
        r2 = Math.floor(40 + t * 60);
        g = Math.floor(80 + t * 80);
        b = Math.floor(30 + t * 20);
      } else {
        // Night: dark with city lights
        r2 = 15; g = 20; b = 15;
      }
    } else {
      // Ocean
      if (dayFactor > 0.5) {
        const t = dayFactor;
        r2 = Math.floor(10 + t * 20);
        g = Math.floor(30 + t * 60);
        b = Math.floor(80 + t * 100);
      } else {
        r2 = 5; g = 10; b = 30;
      }
    }

    ctx.fillStyle = `rgb(${r2},${g},${b})`;
    ctx.fillRect(p.sx - size / 2, p.sy - size / 2, size, size);
  }

  // City lights on night side
  for (const city of cities) {
    const p3d = latLonTo3D(city.lat, city.lon);
    const pr = rotate3D(p3d.x, p3d.y, p3d.z);
    if (pr.z < 0) continue;
    const screen = project(pr.x, pr.y, pr.z);
    const distFromCenter = Math.sqrt((screen.sx - W / 2) ** 2 + (screen.sy - H / 2) ** 2);
    if (distFromCenter > r * screen.scale * 1.02) continue;

    let dLon = city.lon - sunLon;
    while (dLon > 180) dLon -= 360;
    while (dLon < -180) dLon += 360;
    const isNight = Math.abs(dLon) > 80;

    if (isNight) {
      const glow = Math.max(0, 1 - (Math.abs(dLon) - 80) / 10);
      const citySize = 2 + city.pop * 0.3;
      const grad = ctx.createRadialGradient(screen.sx, screen.sy, 0, screen.sx, screen.sy, citySize * 3);
      grad.addColorStop(0, `rgba(255,220,100,${0.6 * glow})`);
      grad.addColorStop(0.5, `rgba(255,180,50,${0.3 * glow})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(screen.sx - citySize * 3, screen.sy - citySize * 3, citySize * 6, citySize * 6);

      ctx.beginPath();
      ctx.arc(screen.sx, screen.sy, citySize * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,240,150,${0.8 * glow})`;
      ctx.fill();
    }
  }

  // Day/night terminator line (subtle glow on sphere edge)
  const termLon = sunLon + 90;
  ctx.strokeStyle = 'rgba(255,200,100,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let lat = -90; lat <= 90; lat += 2) {
    const p3d = latLonTo3D(lat, termLon);
    const pr = rotate3D(p3d.x, p3d.y, p3d.z);
    if (pr.z < 0) { started = false; continue; }
    const screen = project(pr.x, pr.y, pr.z);
    const dist = Math.sqrt((screen.sx - W / 2) ** 2 + (screen.sy - H / 2) ** 2);
    if (dist > r * screen.scale * 1.05) { started = false; continue; }
    if (!started) { ctx.moveTo(screen.sx, screen.sy); started = true; }
    else ctx.lineTo(screen.sx, screen.sy);
  }
  ctx.stroke();

  // Sphere outline
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(60,130,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Rotation
  if (autoRotate) {
    rotY += 0.003;
  } else {
    rotY += dragRotY * 0.3;
    rotX += dragRotX * 0.3;
    dragRotY *= 0.95;
    dragRotX *= 0.95;
  }

  // Update star positions (parallax)
  for (const s of stars) {
    s.x += Math.sin(rotY) * 0.1;
    if (s.x > W) s.x = 0;
    if (s.x < 0) s.x = W;
  }

  // Info
  const now = new Date();
  const utc = now.toUTCString().slice(17, 25);
  info.textContent = `拖拽旋转 | UTC: ${utc} | 太阳经度: ${sunLon.toFixed(1)}°`;

  requestAnimationFrame(render);
}

render();
