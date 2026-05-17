import './style.css';
import { openDB, type IDBPDatabase } from 'idb';
import { AudioRecorder } from '@app-hub/utils/audio-recorder';

interface OscConfig { type: OscillatorType; detune?: number; ratio?: number; }
interface TonePreset { name: string; configs: OscConfig[]; }

const TONE_PRESETS: TonePreset[] = [
  { name: '正弦波', configs: [{type:'sine'}] },
  { name: '方波', configs: [{type:'square'}] },
  { name: '锯齿波', configs: [{type:'sawtooth'}] },
  { name: '三角波', configs: [{type:'triangle'}] },
  { name: '正弦+方波', configs: [{type:'sine'}, {type:'square', ratio:0.5}] },
  { name: '正弦+三角波', configs: [{type:'sine'}, {type:'triangle', ratio:0.5}] },
  { name: '方波+锯齿波', configs: [{type:'square'}, {type:'sawtooth', ratio:0.5}] },
  { name: '双正弦(合唱)', configs: [{type:'sine'}, {type:'sine', detune:10, ratio:0.8}] },
];

const NOTES: Record<string, { freq: number; key: string; black: boolean; label: string }> = {
  'a':  { freq: 261.63, key: 'a',  black: false, label: 'C4' },
  'w':  { freq: 277.18, key: 'w',  black: true,  label: 'C#' },
  's':  { freq: 293.66, key: 's',  black: false, label: 'D4' },
  'e':  { freq: 311.13, key: 'e',  black: true,  label: 'D#' },
  'd':  { freq: 329.63, key: 'd',  black: false, label: 'E4' },
  'f':  { freq: 349.23, key: 'f',  black: false, label: 'F4' },
  't':  { freq: 369.99, key: 't',  black: true,  label: 'F#' },
  'g':  { freq: 392.00, key: 'g',  black: false, label: 'G4' },
  'y':  { freq: 415.30, key: 'y',  black: true,  label: 'G#' },
  'h':  { freq: 440.00, key: 'h',  black: false, label: 'A4' },
  'u':  { freq: 466.16, key: 'u',  black: true,  label: 'A#' },
  'j':  { freq: 493.88, key: 'j',  black: false, label: 'B4' },
  'k':  { freq: 523.25, key: 'k',  black: false, label: 'C5' },
  'o':  { freq: 554.37, key: 'o',  black: true,  label: 'C#' },
  'l':  { freq: 587.33, key: 'l',  black: false, label: 'D5' },
  'p':  { freq: 622.25, key: 'p',  black: true,  label: 'D#' },
  ';':  { freq: 659.25, key: ';',  black: false, label: 'E5' },
};

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterVolume = 80;
let currentToneIndex = 0;

let recorder: AudioRecorder | null = null;
let recordingBlob: Blob | null = null;
let isRecording = false;

interface ActiveNote { noteGain: GainNode; oscillators: OscillatorNode[] }
let activeNotes = new Map<string, ActiveNote>();

interface NoteEffect { x: number; y: number; vy: number; color: string; alpha: number; size: number; life: number }
const effects: NoteEffect[] = [];
let effectCanvas: HTMLCanvasElement;
let effectCtx: CanvasRenderingContext2D;

// Preset DB
const DB_NAME = 'virtual-piano-presets';
const STORE_NAME = 'presets';
let presetDb: IDBPDatabase | null = null;
async function initDb() {
  presetDb = await openDB(DB_NAME, 1, {
    upgrade(db) { if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME); }
  });
}
interface Preset { name: string; toneIndex: number; masterVolume: number; }
async function savePreset(name: string) {
  if (!presetDb) await initDb();
  const preset: Preset = { name, toneIndex: currentToneIndex, masterVolume };
  await presetDb!.put(STORE_NAME, preset, name);
  alert(`预设 "${name}" 已保存`);
  await refreshPresetList();
}
async function loadPreset(name: string) {
  if (!presetDb) await initDb();
  const preset = (await presetDb!.get(STORE_NAME, name)) as Preset | undefined;
  if (!preset) return;
  currentToneIndex = preset.toneIndex;
  masterVolume = preset.masterVolume;
  setMasterVolumeSmooth(masterVolume);
  renderApp(); // to update UI controls
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

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = masterVolume / 100;
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

function setMasterVolumeSmooth(val: number) {
  masterVolume = val;
  if (masterGain) {
    const now = audioCtx!.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(masterVolume / 100, now + 0.1);
  }
}

function createOscillators(noteGain: GainNode, freq: number, toneIdx: number): OscillatorNode[] {
  const ctx = getAudioCtx();
  const preset = TONE_PRESETS[toneIdx] || TONE_PRESETS[0];
  const configs = preset.configs;
  const totalWeight = configs.reduce((sum, c) => sum + (c.ratio ?? 1), 0);
  const baseAmp = 0.3 * (masterVolume/100) / totalWeight;
  const oscs: OscillatorNode[] = [];
  for (const cfg of configs) {
    const osc = ctx.createOscillator();
    osc.type = cfg.type;
    osc.frequency.value = freq;
    if (cfg.detune) osc.detune.value = cfg.detune;
    const gain = ctx.createGain();
    const weight = cfg.ratio ?? 1;
    gain.gain.value = baseAmp * weight;
    osc.connect(gain);
    gain.connect(noteGain);
    osc.start();
    oscs.push(osc);
  }
  return oscs;
}

function playNote(noteKey: string) {
  if (activeNotes.has(noteKey)) return;
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  const noteData = NOTES[noteKey];
  if (!noteData) return;

  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(0, ctx.currentTime);
  noteGain.gain.linearRampToValueAtTime(0.3 * (masterVolume/100) * 0.8, ctx.currentTime + 0.02);
  noteGain.connect(masterGain!);

  const oscs = createOscillators(noteGain, noteData.freq, currentToneIndex);
  activeNotes.set(noteKey, { noteGain, oscillators: oscs });

  // Visual effect
  const whiteKeys = Object.values(NOTES).filter(v=>!v.black);
  const keyIndex = whiteKeys.findIndex(v => v.key === noteKey);
  if (keyIndex >= 0) {
    const x = (keyIndex + 0.5) * (800 / whiteKeys.length);
    for (let i = 0; i < 8; i++) {
      effects.push({
        x: x + (Math.random() - 0.5) * 40,
        y: 180,
        vy: -(2 + Math.random() * 4),
        color: noteData.black ? '#e94560' : '#58a6ff',
        alpha: 1,
        size: 3 + Math.random() * 5,
        life: 0,
      });
    }
  }

  const keyEl = document.querySelector(`[data-note="${noteKey}"]`);
  if (keyEl) keyEl.classList.add('pressed');
}

function stopNote(noteKey: string) {
  const active = activeNotes.get(noteKey);
  if (!active) return;
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  active.noteGain.gain.cancelScheduledValues(now);
  active.noteGain.gain.setValueAtTime(active.noteGain.gain.value, now);
  active.noteGain.gain.linearRampToValueAtTime(0, now + 0.3);
  for (const osc of active.oscillators) {
    try { osc.stop(now + 0.3); } catch {}
  }
  setTimeout(() => { active.oscillators.forEach(o=>{try{o.stop()}catch{}}); activeNotes.delete(noteKey); }, 300);

  const keyEl = document.querySelector(`[data-note="${noteKey}"]`);
  if (keyEl) keyEl.classList.remove('pressed');
}

// Recording
async function startRecording() {
  recorder = new AudioRecorder(null as any);
  await recorder.start();
  isRecording = true;
  const btn = document.getElementById('recordBtn') as HTMLButtonElement;
  if (btn) btn.textContent = '⏹ 停止';
  setTimeout(async () => {
    if (isRecording) await stopRecording();
  }, 60000);
}
async function stopRecording(): Promise<void> {
  if (!recorder) return;
  recordingBlob = await recorder.stop();
  isRecording = false;
  const btn = document.getElementById('recordBtn') as HTMLButtonElement;
  if (btn) btn.textContent = '🎙️ 开始录音(限60s)';
}
async function exportWav() {
  if (!recordingBlob) { alert('请先录制音频'); return; }
  const url = URL.createObjectURL(recordingBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `piano-${Date.now()}.wav`;
  a.click();
  URL.revokeObjectURL(url);
}

// UI rendering
function renderApp() {
  const app = document.getElementById('app')!;
  const whiteKeys = Object.values(NOTES).filter(v=>!v.black);
  const blackKeys = Object.values(NOTES).filter(v=>v.black);
  const keyMap: Record<string, string> = {};
  Object.values(NOTES).forEach(n => { keyMap[n.key] = n.label; });

  let pianoHtml = '<div class="piano">';
  whiteKeys.forEach((n,i) => {
    pianoHtml += `<div class="white-key" data-note="${n.key}">${keyMap[n.key]}</div>`;
  });
  blackKeys.forEach(n => {
    const whiteIdx = whiteKeys.findIndex(w => w.freq > n.freq) - 1;
    if (whiteIdx < 0) return;
    const left = (whiteIdx + 1) * 48 - 15;
    pianoHtml += `<div class="black-key" style="left:${left}px" data-note="${n.key}"></div>`;
  });
  pianoHtml += '</div>';

  app.innerHTML = `
    <h1>🎹 虚拟钢琴</h1>
    <div class="sub">键盘按键演奏：A S D F G H J K L ; + W E T Y U O P</div>
    <div class="controls">
      <select id="toneSelect">
        ${TONE_PRESETS.map((t,i) => `<option value="${i}" ${i===currentToneIndex?'selected':''}>${t.name}</option>`).join('')}
      </select>
      <label>主音量</label>
      <input type="range" id="masterVol" min="0" max="100" value="${masterVolume}"/>
      <span id="volDisplay">${masterVolume}%</span>
      <button class="btn" id="recordBtn">🎙️ 开始录音(限60s)</button>
      <button class="btn" id="exportBtn">⏹️ 停止并导出WAV</button>
      <span class="preset-controls">
        <select id="presetSelect"><option value="">加载预设</option></select>
        <input id="presetName" placeholder="预设名称"/>
        <button class="btn" id="savePresetBtn">保存预设</button>
      </span>
    </div>
    ${pianoHtml}
    <canvas class="notes-canvas" id="fxCanvas" width="${Math.min(800, window.innerWidth-32)}" height="200"></canvas>
    <div class="key-hint">按住键盘按键持续发声，松开即停</div>
  `;

  // Bind controls
  document.getElementById('toneSelect')!.addEventListener('change', (e) => {
    currentToneIndex = +(e.target as HTMLSelectElement).value;
  });
  document.getElementById('masterVol')!.addEventListener('input', (e) => {
    const val = +(e.target as HTMLInputElement).value;
    setMasterVolumeSmooth(val);
    (document.getElementById('volDisplay') as HTMLElement).textContent = `${val}%`;
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

  // Piano keys
  document.querySelectorAll('[data-note]').forEach(el => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); playNote((el as HTMLElement).dataset.note!); });
    el.addEventListener('pointerup', () => stopNote((el as HTMLElement).dataset.note!));
    el.addEventListener('pointerleave', () => stopNote((el as HTMLElement).dataset.note!));
  });

  // Keyboard
  const pressedKeys = new Set<string>();
  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (NOTES[key] && !pressedKeys.has(key)) {
      pressedKeys.add(key);
      playNote(key);
    }
  });
  document.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    pressedKeys.delete(key);
    stopNote(key);
  });

  effectCanvas = document.getElementById('fxCanvas') as HTMLCanvasElement;
  effectCtx = effectCanvas.getContext('2d')!;
}

// Effects animation
function animateEffects() {
  if (!effectCtx) { requestAnimationFrame(animateEffects); return; }
  effectCtx.fillStyle = 'rgba(10,10,26,0.2)';
  effectCtx.fillRect(0, 0, effectCanvas.width, effectCanvas.height);
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.y += e.vy;
    e.vy *= 0.98;
    e.life++;
    e.alpha = Math.max(0, 1 - e.life / 60);
    effectCtx.beginPath();
    effectCtx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    effectCtx.fillStyle = e.color;
    effectCtx.globalAlpha = e.alpha;
    effectCtx.fill();
    effectCtx.globalAlpha = 1;
    if (e.alpha <= 0) effects.splice(i, 1);
  }
  requestAnimationFrame(animateEffects);
}

// Start
(async () => { await refreshPresetList(); })();
renderApp();
animateEffects();
