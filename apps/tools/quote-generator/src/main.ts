import '@app-hub/design-system/src/style.css';
import './style.css';

interface Quote { text: string; author: string; textEn: string; }

const quotes: Quote[] = [
  { text: '千里之行，始于足下', author: '老子', textEn: 'A journey of a thousand miles begins with a single step.' },
  { text: '知之为知之，不知为不知，是知也', author: '孔子', textEn: 'To know what you know and what you do not know, that is true knowledge.' },
  { text: '天行健，君子以自强不息', author: '周易', textEn: 'As heaven maintains vigor through movements, a gentleman should constantly strive for self-perfection.' },
  { text: '不积跬步，无以至千里', author: '荀子', textEn: 'Without accumulating small steps, one cannot travel a thousand miles.' },
  { text: '生于忧患，死于安乐', author: '孟子', textEn: 'Life springs from sorrow and calamity; death from ease and pleasure.' },
  { text: '己所不欲，勿施于人', author: '孔子', textEn: 'Do not do to others what you would not want done to yourself.' },
  { text: '路漫漫其修远兮，吾将上下而求索', author: '屈原', textEn: 'Long and arduous is the road ahead, I shall seek high and low.' },
  { text: '学而不思则罔，思而不学则殆', author: '孔子', textEn: 'Learning without thought is labor lost; thought without learning is perilous.' },
  { text: '海内存知己，天涯若比邻', author: '王勃', textEn: 'A bosom friend afar brings distance near.' },
  { text: '纸上得来终觉浅，绝知此事要躬行', author: '陆游', textEn: 'Knowledge from books is shallow; true understanding comes from practice.' },
  { text: '宝剑锋从磨砺出，梅花香自苦寒来', author: '古谚', textEn: 'A sharp sword comes from grinding; the fragrance of plum blossoms comes from bitter cold.' },
  { text: '塞翁失马，焉知非福', author: '淮南子', textEn: 'When the old man lost his horse, who knew it was not a blessing?' },
  { text: '天下兴亡，匹夫有责', author: '顾炎武', textEn: 'The rise and fall of the nation is the responsibility of every citizen.' },
  { text: '博观而约取，厚积而薄发', author: '苏轼', textEn: 'Read extensively and select carefully; accumulate deeply and express sparingly.' },
  { text: '人生自古谁无死，留取丹心照汗青', author: '文天祥', textEn: 'Since time immemorial, no one has escaped death; let loyalty shine in history.' },
];

let current: Quote = quotes[Math.floor(Math.random() * quotes.length)];
let favorites: Quote[] = JSON.parse(localStorage.getItem('qg_fav') || '[]');

function saveFavs() { localStorage.setItem('qg_fav', JSON.stringify(favorites)); }

function shareAsCard(q: Quote) {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 500;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 800, 500);
  g.addColorStop(0, '#1a1a2e'); g.addColorStop(1, '#16213e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 500);
  ctx.fillStyle = '#e6edf3'; ctx.font = 'italic 28px serif'; ctx.textAlign = 'center';
  const lines = wrapText(ctx, `"${q.text}"`, 700);
  lines.forEach((l, i) => ctx.fillText(l, 400, 160 + i * 40));
  ctx.fillStyle = '#8b949e'; ctx.font = '18px sans-serif';
  ctx.fillText(`— ${q.author}`, 400, 160 + lines.length * 40 + 30);
  if (q.textEn) {
    ctx.fillStyle = '#58a6ff'; ctx.font = 'italic 16px sans-serif';
    const enLines = wrapText(ctx, q.textEn, 700);
    enLines.forEach((l, i) => ctx.fillText(l, 400, 160 + lines.length * 40 + 70 + i * 24));
  }
  canvas.toBlob(b => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = `quote-${Date.now()}.png`; a.click();
    URL.revokeObjectURL(url);
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(''); const lines: string[] = []; let line = '';
  for (const ch of words) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = ch; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1>💡 名言金句</h1>
    <div class="quote-card">
      <div class="quote-text">"${current.text}"</div>
      <div class="quote-text" style="color:#58a6ff;font-size:.95rem">${current.textEn}</div>
      <div class="quote-author">— ${current.author}</div>
    </div>
    <div class="actions">
      <button class="btn primary" id="next">🎲 换一条</button>
      <button class="btn" id="fav">⭐ ${favorites.some(q=>q.text===current.text)?'已收藏':'收藏'}</button>
      <button class="btn" id="share">📸 分享卡片</button>
    </div>
    ${favorites.length?`
    <div class="fav-list"><h2>⭐ 收藏 (${favorites.length})</h2>
      ${favorites.map((q,i)=>`<div class="fav-item"><span>"${q.text}" — ${q.author}</span><button class="remove" data-i="${i}">×</button></div>`).join('')}
    </div>`:''}
  `;

  document.getElementById('next')!.addEventListener('click', () => {
    let next: Quote;
    do { next = quotes[Math.floor(Math.random() * quotes.length)]; } while (next.text === current.text && quotes.length > 1);
    current = next; render();
  });

  document.getElementById('fav')!.addEventListener('click', () => {
    const idx = favorites.findIndex(q => q.text === current.text);
    if (idx >= 0) favorites.splice(idx, 1); else favorites.push(current);
    saveFavs(); render();
  });

  document.getElementById('share')!.addEventListener('click', () => shareAsCard(current));

  document.querySelectorAll('.remove').forEach(el => {
    el.addEventListener('click', e => {
      favorites.splice(+(e.target as HTMLElement).dataset.i!, 1);
      saveFavs(); render();
    });
  });
}

render();
