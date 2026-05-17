import './style.css';
import { openDB, type IDBPDatabase } from 'idb';
import { AudioRecorder } from '@app-hub/utils/audio-recorder';

interface Channel {
  name: string; icon: string; type: 'noise' | 'nature';
  noiseType?: 'white' | 'pink' | 'brown';
  active: boolean; volume: number;
  source?: AudioBufferSourceNode | OscillatorNode;
  gain?: GainNode;
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

const channels: Channel[] = [
  { name: '白噪音', icon: '⬜', type: 'noise', noiseType: 'white', active: false, volume: 50 },
  { name: '粉噪音', icon: '🩷', type: 'noise', noiseType: 'pink', active: false, volume: 50 },
  { name: '棕噪音', icon: '🟫', type: 'noise', noiseType: 'brown', active: false, volume: 50 },
  { name: '雨声', icon: '🌧️', type: 'nature', active: false, volume: 60 },
  { name: '海浪', icon: '🌊', type: 'nature', active: false, volume: 60 },
  { name: '篝火', icon: '🔥', type: 'nature', active: false, volume: 50 },
  { name: '风声', icon: '💨', type: 'nature', active: false, volume: 40 },
  { name: '雷声', icon: '⚡', type: 'nature', active: false, volume: 30 },
];

let masterVol = 80;
let recorder: AudioRecorder | null = null;
let recordingBlob: Blob | null = null;
let isRecording = false;

// Preset DB
const DB_NAME = 'noise-generator-presets';
const STORE_NAME = 'presets';
let presetDb: IDBPDatabase | null = null;
async function initDb() {
  presetDb = await openDB(DB_NAME, 1, {
    upgrade(db) { if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME); }
  });
}
interface Preset { name: string; masterVol: number; channelVolumes: number[]; }
async function savePreset(name: string) {
  if (!presetDb) await initDb();
  const preset: Preset = { name, masterVol, channelVolumes: channels.map(ch => ch.volume) };
  await presetDb!.put(STORE_NAME, preset, name);
  alert(`预设 "${name}" 已保存`);
  await refreshPresetList();
}
async function loadPreset(name: string) {
  if (!presetDb) await initDb();
  const preset = (await presetDb!.get(STORE_NAME, name)) as Preset | undefined;
  if (!preset) return;
  masterVol = preset.masterVol;
  preset.channelVolumes.forEach((vol, i) => { if (channels[i]) channels[i].volume = vol; });
  // Update gains for active channels
  channels.forEach((ch, i) => { if (ch.active && ch.gain) ch.gain.gain.value = channels[i].volume / 100; });
  if (masterGain) masterGain.gain.value = masterVol / 100;
  render();
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
  // Start all active channels and mix to MediaStream destination
  const c = getCtx();
  const dest = c.createMediaStreamDestination();
  const mixedGain = c.createGain();
  mixedGain.gain.value = 1;
  mixedGain.connect(dest);
  // Connect all active channels to mixedGain
  channels.forEach(ch => {
    if (ch.active && ch.gain) {
      ch.gain.connect(dest);
    }
  });
  recorder = new AudioRecorder(c);
  await recorder.start();
  isRecording = true;
  const btn = document.getElementById('recordBtn') as HTMLButtonElement;
  if (btn) btn.textContent = '⏹ 停止';
  setTimeout(async () => {
    if (isRecording) await stopRecording();
  }, 30000);
}
async function stopRecording(): Promise<void> {
  if (!recorder) return;
  recordingBlob = await recorder.stop();
  isRecording = false;
  const btn = document.getElementById('recordBtn') as HTMLButtonElement;
  if (btn) btn.textContent = '🎙️ 录制30s';
}
async function exportWav() {
  if (!recordingBlob) { alert('请先录制音频'); return; }
  const url = URL.createObjectURL(recordingBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `noise-${Date.now()}.wav`;
  a.click();
  URL.revokeObjectURL(url);
}

// Smooth volume
function setMasterVolumeSmooth(val: number) {
  if (masterGain) {
    const now = ctx!.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(val, now + 0.1);
  }
}

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = masterVol / 100;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function createNoiseBuffer(c: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBuffer {
  const sr = c.sampleRate;
  const len = sr * 2;
  const buf = c.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * w) / 1.02;
      last = data[i];
      data[i] *= 3.5;
    }
  }
  return buf;
}

function startChannel(ch: Channel) {
  const c = getCtx();
  if (c.state === 'suspended') c.resume();
  const gain = c.createGain();
  gain.gain.value = ch.volume / 100;
  gain.connect(masterGain!);

  if (ch.type === 'noise') {
    const source = c.createBufferSource();
    source.buffer = createNoiseBuffer(c, ch.noiseType!);
    source.loop = true;
    source.connect(gain);
    source.start();
    ch.source = source;
    ch.gain = gain;
  } else {
    const source = c.createBufferSource();
    const buf = createNoiseBuffer(c, 'brown');
    source.buffer = buf;
    source.loop = true;
    const filter = c.createBiquadFilter();
    if (ch.name === '雨声') { filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.5; }
    else if (ch.name === '海浪') { filter.type = 'lowpass'; filter.frequency.value = 400; }
    else if (ch.name === '篝火') { filter.type = 'bandpass'; filter.frequency.value = 600; filter.Q.value = 2; }
    else if (ch.name === '风声') { filter.type = 'lowpass'; filter.frequency.value = 300; }
    else if (ch.name === '雷声') { filter.type = 'lowpass'; filter.frequency.value = 100; }
    source.connect(filter);
    filter.connect(gain);
    source.start();
    ch.source = source;
    ch.gain = gain;
  }
}

function stopChannel(ch: Channel) {
  if (ch.source) { try { (ch.source as any).stop(); } catch {} ch.source = undefined; }
  ch.gain = undefined;
}

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1>🎧 白噪音发生器</h1>
    <div class="controls">
      <button class="btn" id="recordBtn">🎙️ 录制30s</button>
      <button class="btn" id="exportBtn">💾 导出WAV</button>
      <span class="preset-controls">
        <select id="presetSelect"><option value="">加载预设</option></select>
        <input id="presetName" placeholder="预设名称"/>
        <button class="btn" id="savePresetBtn">保存预设</button>
      </span>
    </div>
    <div class="mixer">
      ${channels.map((ch, i) => `
        <div class="channel ${ch.active ? 'active' : ''}">
          <div class="channel-icon">${ch.icon}</div>
          <div class="channel-name">${ch.name}</div>
          <input type="range" class="volume-h" min="0" max="100" value="${ch.volume}" data-vol="${i}" ${!ch.active?'disabled':''}/>
          <button class="toggle ${ch.active ? 'on' : ''}" data-toggle="${i}">${ch.active ? '🔊 ON' : '🔇 OFF'}</button>
        </div>
      `).join('')}
    </div>
    <div class="master">
      <label>🔊 主音量</label>
      <input type="range" class="volume-h" min="0" max="100" value="${masterVol}" id="masterVol" style="width:200px"/>
      <span>${masterVol}%</span>
    </div>
  `;

  document.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const i = +(el as HTMLElement).dataset.toggle!;
      const ch = channels[i];
      if (ch.active) { stopChannel(ch); ch.active = false; }
      else { startChannel(ch); ch.active = true; }
      render();
    });
  });

  document.querySelectorAll('[data-vol]').forEach(el => {
    el.addEventListener('input', e => {
      const i = +(e.target as HTMLElement).dataset.vol!;
      channels[i].volume = +(e.target as HTMLInputElement).value;
      if (channels[i].gain) channels[i].gain!.gain.value = channels[i].volume / 100;
    });
  });

  document.getElementById('masterVol')!.addEventListener('input', e => {
    masterVol = +(e.target as HTMLInputElement).value;
    setMasterVolumeSmooth(masterVol / 100);
    render();
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
}

(async () => { await refreshPresetList(); })();
render();
