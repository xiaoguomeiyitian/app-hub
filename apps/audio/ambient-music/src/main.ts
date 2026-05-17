import { openDB, type IDBPDatabase } from 'idb';
import { AudioRecorder } from '@app-hub/utils/audio-recorder';
import '@app-hub/utils/theme/variables.css';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W: number, H: number;

function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize();
addEventListener('resize', resize);

type Style = 'forest' | 'ocean' | 'space';
let style: Style = 'forest';
let playing = false;
let volume = 0.4;
let density = 5;
let tune = 50; // 0=dark, 100=bright

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let nodesToStop: (OscillatorNode | AudioBufferSourceNode)[] = [];
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let recorder: AudioRecorder | null = null;
let recordingBlob: Blob | null = null;
let isRecording = false;

// Preset DB
const DB_NAME = 'ambient-music-presets';
const STORE_NAME = 'presets';
let presetDb: IDBPDatabase | null = null;
async function initDb() {
  presetDb = await openDB(DB_NAME, 1, {
    upgrade(db) { if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME); }
  });
}
async function savePreset(name: string) {
  if (!presetDb) await initDb();
  const preset = { name: name, style, volume, density, tune } as { name: string; style: Style; volume: number; density: number; tune: number };
  await presetDb!.put(STORE_NAME, preset, name);
  alert(`预设 "${name}" 已保存`);
  await refreshPresetList();
}
interface Preset { name: string; style: Style; volume: number; density: number; tune: number; }

async function loadPreset(name: string) {
  if (!presetDb) await initDb();
  const preset = (await presetDb!.get(STORE_NAME, name)) as Preset | undefined;
  if (!preset) return;
  style = preset.style;
  volume = preset.volume;
  density = preset.density;
  tune = preset.tune;
  // Update UI
  (document.getElementById('vol') as HTMLInputElement).value = String(volume * 100);
  (document.getElementById('density') as HTMLInputElement).value = String(density);
  (document.getElementById('tune') as HTMLInputElement).value = String(tune);
  document.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.s === style));
  if (masterGain) masterGain.gain.value = volume;
  if (playing) { stopMusic(); startMusic(); }
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

// Recording
async function startRecording() {
  recorder = new AudioRecorder(getCtx());
  await recorder.start();
  isRecording = true;
  (document.getElementById('recordBtn') as HTMLButtonElement).textContent = '⏹ 停止';
  // Auto stop after 30s
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
  if (!recordingBlob) {
    // If not recorded, try to record immediately for a short time
    alert('请先录制音频');
    return;
  }
  const url = URL.createObjectURL(recordingBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ambient-music-${Date.now()}.wav`;
  a.click();
  URL.revokeObjectURL(url);
}

// Smooth transitions for params
function setVolumeSmooth(val: number) {
  if (masterGain) {
    const now = audioCtx!.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(val, now + 0.1);
  }
}

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = volume;
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);
  }
  return audioCtx;
}

// Scales for different styles
const SCALES: Record<Style, number[]> = {
  forest: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25], // C major
  ocean:  [146.83, 164.81, 185.00, 196.00, 220.00, 246.94, 277.18, 293.66], // D minor low
  space:  [130.81, 155.56, 174.61, 196.00, 233.08, 261.63, 311.13, 349.23], // C minor
};

const BG_COLORS: Record<Style, [string, string]> = {
  forest: ['#0a1a05', '#1a3a10'],
  ocean:  ['#000a20', '#001535'],
  space:  ['#050510', '#0a0a2a'],
};

function createPad(style: Style) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();

  const baseFreq = style === 'forest' ? 130 + Math.random() * 60 :
                   style === 'ocean' ? 60 + Math.random() * 40 :
                   55 + Math.random() * 30;

  osc.type = style === 'forest' ? 'sine' : style === 'ocean' ? 'sine' : 'triangle';
  osc.frequency.value = baseFreq;

  // LFO for wobble
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.1 + Math.random() * 0.3;
  lfoGain.gain.value = baseFreq * 0.02;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  lfo.start();
  nodesToStop.push(lfo);

  filter.type = 'lowpass';
  filter.frequency.value = style === 'ocean' ? 300 : style === 'space' ? 800 : 600;
  filter.Q.value = 1;

  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.06, c.currentTime + 3);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain!);
  osc.start();
  nodesToStop.push(osc);

  // Slow fade out and recreate
  gain.gain.linearRampToValueAtTime(0, c.currentTime + 20);
  setTimeout(() => { try { osc.stop(); lfo.stop(); } catch {} }, 22000);
}

function createNote(style: Style) {
  const c = getCtx();
  const scale = SCALES[style];
  const tuneIdx = Math.floor(tune / 100 * (scale.length - 1));
  const freq = scale[tuneIdx + Math.floor(Math.random() * Math.min(4, scale.length - tuneIdx))] ?? scale[0];

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = style === 'forest' ? 'sine' : style === 'ocean' ? 'triangle' : 'sine';
  osc.frequency.value = freq * (style === 'space' ? 0.5 : 1);

  // Reverb-like with delay
  const delay = c.createDelay();
  delay.delayTime.value = 0.3 + Math.random() * 0.4;
  const feedback = c.createGain();
  feedback.gain.value = 0.3;

  const now = c.currentTime;
  const dur = style === 'ocean' ? 4 + Math.random() * 4 : 2 + Math.random() * 3;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.04, now + 0.5);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(gain);
  gain.connect(masterGain!);
  gain.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(masterGain!);

  osc.start(now);
  osc.stop(now + dur + 0.5);
  nodesToStop.push(osc);
}

function createTexture(style: Style) {
  const c = getCtx();

  if (style === 'ocean' || style === 'forest') {
    // Filtered noise
    const bufSize = c.sampleRate * 2;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const source = c.createBufferSource();
    source.buffer = buf;
    source.loop = true;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = style === 'ocean' ? 200 + Math.random() * 200 : 800 + Math.random() * 400;
    filter.Q.value = style === 'ocean' ? 0.5 : 2;

    // LFO on filter
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.05 + Math.random() * 0.1;
    lfoGain.gain.value = filter.frequency.value * 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gain = c.createGain();
    gain.gain.value = 0.02 + Math.random() * 0.02;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain!);
    source.start();
    nodesToStop.push(source, lfo);
  }

  if (style === 'space') {
    // Shimmering high harmonics
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200 + Math.random() * 2000;

    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.3 + Math.random() * 0.5;
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);

    const gain = c.createGain();
    gain.gain.value = 0;
    lfoGain.connect(gain.gain);
    lfo.start();

    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start();
    nodesToStop.push(osc, lfo);
  }
}

function createChirp() {
  if (style !== 'forest') return;
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  const startFreq = 2000 + Math.random() * 2000;
  const endFreq = startFreq + (Math.random() - 0.5) * 1000;

  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, c.currentTime);
  osc.frequency.linearRampToValueAtTime(endFreq, c.currentTime + 0.1);

  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.03, c.currentTime + 0.01);
  gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start();
  osc.stop(c.currentTime + 0.2);
}

function startMusic() {
  const c = getCtx();
  if (c.state === 'suspended') c.resume();

  // Create initial layers
  for (let i = 0; i < 3; i++) createPad(style);
  for (let i = 0; i < 2; i++) createTexture(style);

  // Scheduler
  schedulerTimer = setInterval(() => {
    if (!playing) return;
    // Random notes
    if (Math.random() < density / 10) createNote(style);
    // Chirps for forest
    if (style === 'forest' && Math.random() < density / 20) createChirp();
    // Refresh pads
    if (Math.random() < 0.1) createPad(style);
  }, 1000);
}

function stopMusic() {
  for (const n of nodesToStop) { try { n.stop(); } catch {} }
  nodesToStop = [];
  if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
}

// Visualization
function draw() {
  const [bg1, bg2] = BG_COLORS[style];
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, bg1);
  grad.addColorStop(1, bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  if (analyser && playing) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    // Draw waveform bars
    const barCount = data.length;
    const barW = W / barCount;

    for (let i = 0; i < barCount; i++) {
      const v = data[i] / 255;
      const barH = v * H * 0.6;

      const colors: Record<Style, [string, string]> = {
        forest: ['#2d8a4e', '#4ade80'],
        ocean: ['#1e40af', '#60a5fa'],
        space: ['#6d28d9', '#a78bfa'],
      };
      const [c1, c2] = colors[style];
      const t = i / barCount;
      ctx.fillStyle = t < 0.5 ? c1 : c2;
      ctx.globalAlpha = 0.3 + v * 0.5;

      // Bottom bars
      ctx.fillRect(i * barW, H - barH, barW - 1, barH);
      // Top mirror
      ctx.globalAlpha *= 0.3;
      ctx.fillRect(i * barW, 0, barW - 1, barH * 0.5);
    }
    ctx.globalAlpha = 1;

    // Center wave
    const waveData = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(waveData);
    ctx.beginPath();
    ctx.strokeStyle = style === 'forest' ? 'rgba(74,222,128,0.3)' : style === 'ocean' ? 'rgba(96,165,250,0.3)' : 'rgba(167,139,250,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < waveData.length; i++) {
      const x = (i / waveData.length) * W;
      const y = H / 2 + ((waveData[i] - 128) / 128) * H * 0.3;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    // Idle animation
    const t = Date.now() * 0.001;
    ctx.fillStyle = style === 'forest' ? 'rgba(74,222,128,0.1)' : style === 'ocean' ? 'rgba(96,165,250,0.1)' : 'rgba(167,139,250,0.1)';
    for (let i = 0; i < 5; i++) {
      const x = W / 2 + Math.sin(t + i) * 100;
      const y = H / 2 + Math.cos(t * 0.7 + i) * 50;
      ctx.beginPath();
      ctx.arc(x, y, 50 + Math.sin(t + i * 2) * 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('点击播放开始', W / 2, H / 2);
  }

  requestAnimationFrame(draw);
}

draw();

// UI
(async () => { await refreshPresetList(); })();

document.getElementById('playBtn')!.addEventListener('click', () => {
  playing = !playing;
  const btn = document.getElementById('playBtn')!;
  if (playing) { btn.textContent = '⏸ 暂停'; startMusic(); }
  else { btn.textContent = '▶️ 播放'; stopMusic(); }
});

document.getElementById('recordBtn')!.addEventListener('click', async () => {
  if (!isRecording) await startRecording();
  else await stopRecording();
});

document.getElementById('exportBtn')!.addEventListener('click', async () => { await exportWav(); });

document.getElementById('savePresetBtn')!.addEventListener('click', async () => {
  const name = (document.getElementById('presetName') as HTMLInputElement).value.trim();
  if (!name) { alert('请输入预设名称'); return; }
  await savePreset(name);
});

document.getElementById('presetSelect')!.addEventListener('change', async (e) => {
  const name = (e.target as HTMLSelectElement).value;
  if (name) await loadPreset(name);
});

document.querySelectorAll('[data-s]').forEach(el => {
  el.addEventListener('click', () => {
    style = (el as HTMLElement).dataset.s as Style;
    document.querySelectorAll('[data-s]').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    if (playing) { stopMusic(); startMusic(); }
  });
});

(document.getElementById('vol') as HTMLInputElement).addEventListener('input', e => {
  volume = +(e.target as HTMLInputElement).value / 100;
  setVolumeSmooth(volume);
});
(document.getElementById('density') as HTMLInputElement).addEventListener('input', e => { density = +(e.target as HTMLInputElement).value; });
(document.getElementById('tune') as HTMLInputElement).addEventListener('input', e => { tune = +(e.target as HTMLInputElement).value; });
