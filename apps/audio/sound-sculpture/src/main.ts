import { openDB, type IDBPDatabase } from 'idb';
import { AudioRecorder } from '@app-hub/utils/audio-recorder';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W: number, H: number;

function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize();
addEventListener('resize', resize);

type Mode = 'bars' | 'wave' | 'mountain';
let mode: Mode = 'bars';
let recording = false;
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let freqData = new Uint8Array(128);
let timeData = new Uint8Array(128);
let smoothFreq = new Float32Array(128);

let rotY = 0;
let rotX = 0.3;
let autoRotate = true;
let dragRotY = 0;
let dragRotX = 0;
let dragging = false;
let lastMX = 0, lastMY = 0;

// Recording
let recorder: AudioRecorder | null = null;
let recordingBlob: Blob | null = null;
let isRecording = false;

async function startRecording() {
  recorder = new AudioRecorder(null as any);
  await recorder.start();
  isRecording = true;
  (document.getElementById('recordBtn') as HTMLButtonElement).textContent = '⏹ 停止';
  setTimeout(async () => {
    if (isRecording) await stopRecording();
  }, 30000);
}
async function stopRecording(): Promise<void> {
  if (!recorder) return;
  recordingBlob = await recorder.stop();
  isRecording = false;
  (document.getElementById('recordBtn') as HTMLButtonElement).textContent = '🎙️ 录制30s';
}
async function exportWav() {
  if (!recordingBlob) { alert('请先录制音频'); return; }
  const url = URL.createObjectURL(recordingBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sound-sculpture-${Date.now()}.wav`;
  a.click();
  URL.revokeObjectURL(url);
}

// Preset DB
const DB_NAME = 'sound-sculpture-presets';
const STORE_NAME = 'presets';
let presetDb: IDBPDatabase | null = null;
async function initDb() {
  presetDb = await openDB(DB_NAME, 1, {
    upgrade(db) { if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME); }
  });
}
interface Preset { name: string; mode: Mode; rotY: number; rotX: number; autoRotate: boolean; }
async function savePreset(name: string) {
  if (!presetDb) await initDb();
  const preset: Preset = { name, mode, rotY, rotX, autoRotate };
  await presetDb!.put(STORE_NAME, preset, name);
  alert(`预设 "${name}" 已保存`);
  await refreshPresetList();
}
async function loadPreset(name: string) {
  if (!presetDb) await initDb();
  const preset = (await presetDb!.get(STORE_NAME, name)) as Preset | undefined;
  if (!preset) return;
  mode = preset.mode;
  rotY = preset.rotY;
  rotX = preset.rotX;
  autoRotate = preset.autoRotate;
  updateModeButtons();
  alert(`预设 "${name}" 已加载`);
}
async function refreshPresetList() {
  if (!presetDb) await initDb();
  const select = document.getElementById('presetSelect') as HTMLSelectElement;
  select.innerHTML = '<option value="">加载预设</option>';
  const tx = presetDb!.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  let cursor = await store.openCursor();
  while (cursor) {
    const opt = document.createElement('option');
    opt.value = cursor.key as string;
    opt.textContent = cursor.key as string;
    select.appendChild(opt);
    cursor = await cursor.continue();
  }
}

canvas.addEventListener('pointerdown', e => { dragging = true; lastMX = e.clientX; lastMY = e.clientY; autoRotate = false; });
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  dragRotY += (e.clientX - lastMX) * 0.005;
  dragRotX += (e.clientY - lastMY) * 0.005;
  dragRotX = Math.max(-1, Math.min(1, dragRotX));
  lastMX = e.clientX; lastMY = e.clientY;
});
canvas.addEventListener('pointerup', () => { dragging = false; setTimeout(() => { autoRotate = true; }, 2000); });

async function startMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
    smoothFreq = new Float32Array(analyser.frequencyBinCount);
    recording = true;
    const btn = document.getElementById('startBtn')!;
    btn.textContent = '🔴 录音中...';
    btn.classList.add('recording');
  } catch {
    alert('无法访问麦克风，请授予权限');
  }
}

// 3D projection
function project(x: number, y: number, z: number): { sx: number; sy: number } {
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  let x1 = x * cosY - z * sinY;
  let z1 = x * sinY + z * cosY;
  let y1 = y * cosX - z1 * sinX;
  let z2 = y * sinX + z1 * cosX;
  const fov = 500;
  const scale = fov / (fov + z2 + 200);
  return { sx: x1 * scale + W / 2, sy: -y1 * scale + H / 2 };
}

function getColor(i: number, total: number, height: number): string {
  const t = i / total;
  const h = (t * 200 + height * 30 + rotY * 50) % 360;
  const s = 70 + height * 30;
  const l = 30 + height * 40;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function drawBars() {
  const bins = smoothFreq.length;
  const count = 48;
  const step = Math.floor(bins / count);
  const radius = 120;
  const maxHeight = 180;
  interface Bar { angle: number; height: number; x: number; y: number; z: number; depth: number }
  const bars: Bar[] = [];
  for (let i = 0; i < count; i++) {
    const freqIdx = i * step;
    const val = smoothFreq[freqIdx] / 255;
    const angle = (i / count) * Math.PI * 2;
    const h = val * maxHeight;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const p = project(x, h / 2, z);
    bars.push({ angle, height: h, x, y: h / 2, z, depth: Math.cos(angle + rotY) * radius });
  }
  bars.sort((a, b) => a.depth - b.depth);
  for (const bar of bars) {
    const baseP = project(bar.x, 0, bar.z);
    const topP = project(bar.x, bar.height, bar.z);
    const barW = 12;
    const color = getColor(bars.indexOf(bar), bars.length, bar.height / maxHeight);
    ctx.fillStyle = color;
    ctx.beginPath();
    const x1 = baseP.sx - barW / 2, y1 = topP.sy, x2 = baseP.sx + barW / 2, y2 = baseP.sy;
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y2); ctx.lineTo(x1, y2); ctx.fill();
    ctx.fillStyle = `hsl(${(bars.indexOf(bar) / bars.length * 200 + rotY * 50) % 360}, 80%, ${50 + bar.height / maxHeight * 30}%)`;
    ctx.fillRect(x1, y1 - 3, barW, 3);
    ctx.shadowBlur = bar.height / maxHeight * 20; ctx.shadowColor = color;
    ctx.fillRect(baseP.sx - 1, y1, 2, bar.height); ctx.shadowBlur = 0;
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const p = project(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    if (i === 0) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy);
  }
  ctx.closePath(); ctx.stroke();
}

function drawWave() {
  const bins = smoothFreq.length;
  const gridSize = 24; const spacing = 12; const maxHeight = 120;
  const points: { x: number; y: number; z: number }[] = [];
  for (let gz = 0; gz < gridSize; gz++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const nx = (gx - gridSize/2) * spacing;
      const nz = (gz - gridSize/2) * spacing;
      const dist = Math.sqrt(nx*nx + nz*nz);
      const freqIdx = Math.min(bins-1, Math.floor((dist/(gridSize*spacing/2))*bins));
      const val = smoothFreq[freqIdx]/255;
      const angle = Math.atan2(nz, nx);
      const ny = val * maxHeight * Math.sin(angle*3 + rotY*2) * Math.cos(dist*0.02);
      points.push({x: nx, y: ny, z: nz});
    }
  }
  ctx.strokeStyle = 'rgba(88,166,255,0.3)'; ctx.lineWidth = 1;
  for (let gz = 0; gz < gridSize-1; gz++) {
    for (let gx = 0; gx < gridSize-1; gx++) {
      const i = gz*gridSize + gx;
      const p0 = project(points[i].x, points[i].y, points[i].z);
      const p1 = project(points[i+1].x, points[i+1].y, points[i+1].z);
      const p2 = project(points[i+gridSize].x, points[i+gridSize].y, points[i+gridSize].z);
      const val = smoothFreq[Math.min(bins-1, i% bins)]/255;
      ctx.strokeStyle = `hsla(${(val*200 + rotY*50)%360}, 70%, 50%, ${0.2+val*0.5})`;
      ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p2.sx, p2.sy); ctx.stroke();
    }
  }
}

function drawMountain() {
  const bins = smoothFreq.length;
  const rings = 20; const maxHeight = 160; const maxRadius = 180;
  for (let r = 0; r < rings; r++) {
    const radius = ((r+1)/rings)*maxRadius;
    const segments = 48;
    const points: { sx: number; sy: number; depth: number }[] = [];
    for (let s = 0; s <= segments; s++) {
      const angle = (s/segments)*Math.PI*2;
      const freqIdx = Math.min(bins-1, Math.floor((r/rings + s/segments)*bins*0.5));
      const val = smoothFreq[freqIdx]/255;
      const h = val*maxHeight*(1 - r/rings*0.5);
      const x = Math.cos(angle)*radius;
      const z = Math.sin(angle)*radius;
      const p = project(x, h, z);
      const depth = Math.cos(angle+rotY)*radius + Math.sin(angle+rotX)*radius*0.3;
      points.push({ sx: p.sx, sy: p.sy, depth });
    }
    const avgFreq = smoothFreq[Math.min(bins-1, Math.floor(r/rings*bins))]/255;
    ctx.strokeStyle = `hsla(${(avgFreq*120 + 200 + rotY*30)%360}, 60%, ${30+avgFreq*40}%, ${0.3+(1-r/rings)*0.4})`;
    ctx.lineWidth = 1.5; ctx.beginPath();
    for (let s=0; s<points.length; s++) { if(s===0) ctx.moveTo(points[s].sx, points[s].sy); else ctx.lineTo(points[s].sx, points[s].sy); }
    ctx.stroke();
    if (r%2===0) {
      ctx.fillStyle = `hsla(${(avgFreq*120 + 200 + rotY*30)%360}, 50%, ${20+avgFreq*30}%, 0.1)`;
      ctx.beginPath(); for (let s=0; s<points.length; s++) { if(s===0) ctx.moveTo(points[s].sx, points[s].sy); else ctx.lineTo(points[s].sx, points[s].sy); } ctx.fill();
    }
    if (r < rings-1) {
      for (let s=0; s<segments; s+=3) {
        const angle = (s/segments)*Math.PI*2;
        const nextR = ((r+2)/rings)*maxRadius;
        const freqIdx2 = Math.min(bins-1, Math.floor(((r+1)/rings + s/segments)*bins*0.5));
        const val2 = smoothFreq[freqIdx2]/255;
        const h2 = val2*maxHeight*(1-(r+1)/rings*0.5);
        const p1 = project(Math.cos(angle)*radius, smoothFreq[Math.min(bins-1, Math.floor((r/rings + s/segments)*bins*0.5))]/255*maxHeight*(1-r/rings*0.5), Math.sin(angle)*radius);
        const p2 = project(Math.cos(angle)*nextR, h2, Math.sin(angle)*nextR);
        ctx.strokeStyle = 'rgba(100,150,255,0.15)';
        ctx.beginPath(); ctx.moveTo(p1.sx, p1.sy); ctx.lineTo(p2.sx, p2.sy); ctx.stroke();
      }
    }
  }
}

function render() {
  ctx.fillStyle = 'rgba(10,10,26,0.9)';
  ctx.fillRect(0, 0, W, H);

  if (analyser) {
    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);
    for (let i = 0; i < freqData.length; i++) {
      smoothFreq[i] += (freqData[i] - smoothFreq[i]) * 0.15;
    }
  } else {
    const t = Date.now() * 0.002;
    for (let i = 0; i < smoothFreq.length; i++) {
      const val = (Math.sin(t + i*0.1)*0.5 + 0.5)*80 + Math.sin(t*1.5 + i*0.3)*30;
      smoothFreq[i] += (Math.max(0, val) - smoothFreq[i])*0.1;
    }
  }

  if (autoRotate) { rotY += 0.008; }
  else {
    rotY += dragRotY*0.3; rotX += dragRotX*0.3;
    dragRotY *= 0.9; dragRotX *= 0.9;
  }

  switch (mode) {
    case 'bars': drawBars(); break;
    case 'wave': drawWave(); break;
    case 'mountain': drawMountain(); break;
  }

  const avgLevel = smoothFreq.reduce((a,b)=>a+b,0)/smoothFreq.length/255;
  const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 200);
  grad.addColorStop(0, `hsla(${(rotY*50)%360}, 70%, 50%, ${avgLevel*0.2})`);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

  requestAnimationFrame(render);
}

// UI tabs
function showTab(tab: 'visual' | 'record' | 'settings') {
  (document.getElementById('visualTab') as HTMLElement).style.display = tab==='visual'?'block':'none';
  (document.getElementById('recordTab') as HTMLElement).style.display = tab==='record'?'block':'none';
  (document.getElementById('settingsTab') as HTMLElement).style.display = tab==='settings'?'block':'none';
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', (b as HTMLElement).dataset.tab===tab));
  renderUIBindings(tab);
}

function renderUIBindings(tab: 'visual' | 'record' | 'settings') {
  // Visual tab: recalculate mode buttons active
  if (tab === 'visual') {
    document.querySelectorAll('[data-m]').forEach(btn=>{
      btn.classList.toggle('active', (btn as HTMLElement).dataset.m===mode);
    });
  }
}

function updateModeButtons() {
  document.querySelectorAll('[data-m]').forEach(btn=>{
    btn.classList.toggle('active', (btn as HTMLElement).dataset.m===mode);
  });
}

// Initial UI render
function initUI() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div id="ui" style="position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:10;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;background:var(--bg-secondary);padding:8px 12px;border-radius:8px;backdrop-filter:blur(8px);border:1px solid var(--border-secondary);">
      <h1 style="color:var(--text-primary);font-size:1rem;margin:0 8px 0 0">🎙️ 声音雕塑</h1>
      <button class="tab-btn btn active" data-tab="visual">👁️ 可视化</button>
      <button class="tab-btn btn" data-tab="record">🎙️ 录制</button>
      <button class="tab-btn btn" data-tab="settings">⚙️ 设置</button>
    </div>
    <div id="visualTab" style="position:fixed;top:70px;left:16px;right:16px;bottom:16px;display:block">
      <div style="position:absolute;bottom:16px;left:16px;z-index:10;display:flex;gap:8px">
        <button class="btn" data-m="bars">📊 环形柱</button>
        <button class="btn" data-m="wave">🌊 波浪面</button>
        <button class="btn" data-m="mountain">⛰️ 山峰</button>
      </div>
    </div>
    <div id="recordTab" style="position:fixed;top:70px;left:16px;right:16px;bottom:16px;display:none;background:var(--bg-secondary);border-radius:12px;padding:24px;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
      <button class="btn" id="recordBtn" style="font-size:1.2rem;padding:12px 32px">🎙️ 录制30s</button>
      <button class="btn" id="exportBtn" style="font-size:1rem;padding:10px 24px">💾 导出WAV</button>
      <p style="color:var(--text-secondary);font-size:.85rem">录制麦克风输入并导出为WAV（30秒）</p>
    </div>
    <div id="settingsTab" style="position:fixed;top:70px;left:16px;right:16px;bottom:16px;display:none;background:var(--bg-secondary);border-radius:12px;padding:24px;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:12px;overflow-y:auto">
      <h2 style="color:var(--text-primary);margin:12px 0">预设管理</h2>
      <div class="preset-controls" style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:center;margin:12px 0">
        <select id="presetSelect" style="border:1px solid var(--border-secondary);border-radius:4px;padding:6px 10px;font-size:.85rem;background:var(--bg-tertiary);color:var(--text-primary)"><option value="">加载预设</option></select>
        <input id="presetName" placeholder="预设名称" style="border:1px solid var(--border-secondary);border-radius:4px;padding:6px 10px;font-size:.85rem;background:var(--bg-tertiary);color:var(--text-primary)"/>
        <button class="btn" id="savePresetBtn" style="font-size:.85rem;padding:6px 12px">💾 保存预设</button>
      </div>
      <p style="color:var(--text-secondary);font-size:.85rem;max-width:600px">保存当前模式、视角与自动旋转状态</p>
    </div>
  `;
  // Bind tab clicks
  document.querySelectorAll('.tab-btn').forEach(el=>{
    el.addEventListener('click', ()=>{
      showTab((el as HTMLElement).dataset.tab as any);
    });
  });
  // visual mode buttons
  document.querySelectorAll('[data-m]').forEach(el=>{
    el.addEventListener('click', ()=>{
      mode = (el as HTMLElement).dataset.m as Mode;
      updateModeButtons();
    });
  });
  // Record controls
  document.getElementById('recordBtn')!.addEventListener('click', async () => {
    if (!isRecording) await startRecording();
    else await stopRecording();
  });
  document.getElementById('exportBtn')!.addEventListener('click', async () => { await exportWav(); });
  // Settings preset
  document.getElementById('savePresetBtn')!.addEventListener('click', async () => {
    const name = (document.getElementById('presetName') as HTMLInputElement).value.trim();
    if (!name) { alert('请输入预设名称'); return; }
    await savePreset(name);
  });
  document.getElementById('presetSelect')!.addEventListener('change', async (e) => {
    const name = (e.target as HTMLSelectElement).value;
    if (name) await loadPreset(name);
  });
}

// Start
(async () => { await refreshPresetList(); })();
initUI();
render();
