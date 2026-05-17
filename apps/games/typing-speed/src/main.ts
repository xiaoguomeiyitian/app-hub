import './style.css';

const texts: Record<string, string[]> = {
  code: [
    'function fibonacci(n: number): number { if (n <= 1) return n; return fibonacci(n - 1) + fibonacci(n - 2); }',
    'const items = array.filter(item => item.active).map(item => item.name).sort();',
    'interface User { id: string; name: string; email: string; createdAt: Date; }',
  ],
  quote: [
    'The only way to do great work is to love what you do. If you have not found it yet, keep looking. Do not settle.',
    'In the middle of difficulty lies opportunity. Life is what happens when you are busy making other plans.',
    'The future belongs to those who believe in the beauty of their dreams. Success is not final, failure is not fatal.',
  ],
  chinese: [
    '千里之行始于足下不积跬步无以至千里不积小流无以成江海',
    '天行健君子以自强不息地势坤君子以厚德载物',
    '学而不思则罔思而不学则殆三人行必有我师焉',
  ],
  random: [
    'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.',
    'How vexingly quick daft zebras jump. The five boxing wizards jump quickly at dawn.',
    'Sphinx of black quartz judge my vow. How quickly daft jumping zebras vex.',
  ],
};

let theme = 'random';
let target = '';
let typed = '';
let startTime: number | null = null;
let finished = false;
let wpm = 0;
let accuracy = 100;
let errors = 0;
let lb: { wpm: number; acc: number; date: string; theme: string }[] = JSON.parse(localStorage.getItem('ts_lb') || '[]');

function pickText() {
  const pool = texts[theme] || texts.random;
  target = pool[Math.floor(Math.random() * pool.length)];
  typed = ''; startTime = null; finished = false; wpm = 0; accuracy = 100; errors = 0;
}

function render() {
  const elapsed = startTime ? (Date.now() - startTime) / 1000 / 60 : 0;
  const charsTyped = typed.length;
  if (startTime && charsTyped > 0 && !finished) {
    wpm = Math.round(charsTyped / 5 / Math.max(elapsed, 0.01));
    const correct = typed.split('').filter((c, i) => c === target[i]).length;
    accuracy = Math.round((correct / charsTyped) * 100);
    errors = charsTyped - correct;
  }

  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1>⌨️ 打字测速</h1>
    <div class="controls">
      <select id="themeSelect">
        ${Object.keys(texts).map(t => `<option value="${t}" ${t===theme?'selected':''}>${t === 'code' ? '代码' : t === 'quote' ? '名言' : t === 'chinese' ? '中文' : '随机'}</option>`).join('')}
      </select>
      <button class="btn primary" id="restart">🔄 换一段</button>
    </div>
    <div class="stats">
      <div class="stat-item"><div class="stat-value">${wpm}</div><div class="stat-label">WPM</div></div>
      <div class="stat-item"><div class="stat-value">${accuracy}%</div><div class="stat-label">准确率</div></div>
      <div class="stat-item"><div class="stat-value">${errors}</div><div class="stat-label">错误</div></div>
    </div>
    <div class="text-display">${target.split('').map((c, i) => {
      let cls = '';
      if (i < typed.length) cls = typed[i] === c ? 'correct' : 'incorrect';
      else if (i === typed.length) cls = 'current';
      return `<span class="char ${cls}">${c === ' ' ? '&nbsp;' : c}</span>`;
    }).join('')}</div>
    <div class="input-area">
      <input id="input" placeholder="点击开始输入..." ${finished ? 'disabled' : ''} autofocus/>
    </div>
    ${finished ? `
      <div style="text-align:center;margin-bottom:16px;font-size:1.1rem">
        🎉 完成！WPM: <b style="color:#3fb950">${wpm}</b> 准确率: <b style="color:#58a6ff">${accuracy}%</b>
      </div>` : ''}
    ${lb.length ? `<div class="leaderboard"><h2>🏆 排行榜</h2>
      ${lb.sort((a,b) => b.wpm - a.wpm).slice(0,5).map((r, i) => `
        <div class="lb-item"><span class="lb-rank">#${i+1}</span><span>${r.wpm} WPM · ${r.acc}% · ${r.theme}</span><span style="color:#8b949e;font-size:.75rem">${r.date}</span></div>
      `).join('')}
    </div>` : ''}
  `;

  const input = document.getElementById('input') as HTMLInputElement;
  input.focus();
  input.addEventListener('input', handleInput);
  document.getElementById('themeSelect')!.addEventListener('change', e => { theme = (e.target as HTMLSelectElement).value; pickText(); render(); });
  document.getElementById('restart')!.addEventListener('click', () => { pickText(); render(); });
}

function handleInput(e: Event) {
  if (finished) return;
  const val = (e.target as HTMLInputElement).value;
  if (!startTime && val.length > 0) startTime = Date.now();
  typed = val;

  if (typed.length >= target.length) {
    finished = true;
    const elapsed = (Date.now() - startTime!) / 1000 / 60;
    wpm = Math.round(typed.length / 5 / elapsed);
    const correct = typed.split('').filter((c, i) => c === target[i]).length;
    accuracy = Math.round((correct / typed.length) * 100);
    errors = typed.length - correct;
    lb.push({ wpm, acc: accuracy, date: new Date().toLocaleDateString(), theme });
    if (lb.length > 20) lb = lb.slice(-20);
    localStorage.setItem('ts_lb', JSON.stringify(lb));
  }

  render();
  // Restore focus and cursor
  const inp = document.getElementById('input') as HTMLInputElement;
  if (inp) { inp.value = typed; inp.focus(); }
}

pickText();
render();
