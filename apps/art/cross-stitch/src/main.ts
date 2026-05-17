import './style.css';
import '@app-hub/utils/theme/variables.css';

let gridSize = 40;
let imgEl: HTMLImageElement | null = null;

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1>🧵 十字绣转换器</h1>
    <div class="controls">
      <input type="file" id="fileInput" accept="image/*"/>
      <label>格子数 <input type="range" id="gridSlider" min="10" max="80" value="${gridSize}"/> ${gridSize}×${gridSize}</label>
      <button class="btn" id="convertBtn">🔄 转换</button>
      <button class="btn" id="exportBtn">💾 导出 PNG</button>
    </div>
    <canvas id="cv" width="600" height="600"></canvas>
    <div class="palette-area" id="palette"></div>
  `;

  document.getElementById('fileInput')!.addEventListener('change', handleFile);
  document.getElementById('gridSlider')!.addEventListener('input', e => { gridSize = +(e.target as HTMLInputElement).value; render(); });
  document.getElementById('convertBtn')!.addEventListener('click', () => { if (imgEl) convert(imgEl); });
  document.getElementById('exportBtn')!.addEventListener('click', exportPNG);
}

function handleFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => { imgEl = img; convert(img); };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}

// DMC thread colors (simplified palette)
const DMC_COLORS: [string, string, string][] = [
  ['#FFFFFF','White','3865'],['#000000','Black','310'],['#FF0000','Red','666'],
  ['#CC0000','Dark Red','816'],['#FF6666','Light Red','3354'],['#006600','Dark Green','895'],
  ['#009900','Green','702'],['#66CC66','Light Green','772'],['#0000CC','Dark Blue','823'],
  ['#3333FF','Blue','796'],['#9999FF','Light Blue','3325'],['#FFCC00','Gold','972'],
  ['#FF9900','Orange','977'],['#CC9933','Dark Gold','832'],['#993300','Brown','938'],
  ['#663300','Dark Brown','975'],['#FF99CC','Pink','3688'],['#CC6699','Dark Pink','3687'],
  ['#999999','Gray','414'],['#666666','Dark Gray','3799'],['#CCCCCC','Light Gray','762'],
  ['#660099','Purple','550'],['#9966CC','Light Purple','3837'],['#006666','Teal','3808'],
  ['#339999','Light Teal','3810'],['#FFFF99','Light Yellow','3078'],['#CC6600','Copper','920'],
  ['#336633','Forest Green','890'],['#FFCCFF','Lavender','3607'],
];

function nearestColor(r: number, g: number, b: number): [string, string] {
  let best = '#FFFFFF', bestName = 'White', bestDist = Infinity;
  for (const [hex, name] of DMC_COLORS) {
    const cr = parseInt(hex.slice(1,3),16), cg = parseInt(hex.slice(3,5),16), cb = parseInt(hex.slice(5,7),16);
    const dist = (r-cr)**2 + (g-cg)**2 + (b-cb)**2;
    if (dist < bestDist) { bestDist = dist; best = hex; bestName = name; }
  }
  return [best, bestName];
}

function convert(img: HTMLImageElement) {
  const cv = document.getElementById('cv') as HTMLCanvasElement;
  const ctx = cv.getContext('2d')!;
  const cell = 600 / gridSize;

  // Sample image
  const tmp = document.createElement('canvas');
  tmp.width = gridSize; tmp.height = gridSize;
  const tctx = tmp.getContext('2d')!;
  tctx.drawImage(img, 0, 0, gridSize, gridSize);
  const data = tctx.getImageData(0, 0, gridSize, gridSize);

  const colorCount = new Map<string, { hex: string; name: string; count: number }>();

  ctx.fillStyle = '#f5f0e8';
  ctx.fillRect(0, 0, 600, 600);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const i = (y * gridSize + x) * 4;
      const r = data.data[i], g = data.data[i+1], b = data.data[i+2];
      const [hex, name] = nearestColor(r, g, b);

      ctx.fillStyle = hex;
      ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);

      // Grid lines
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x * cell, y * cell, cell, cell);

      // Center marks every 5 cells
      if ((x + 1) % 5 === 0 && (y + 1) % 5 === 0) {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x * cell + cell/2 - 2, y * cell + cell/2);
        ctx.lineTo(x * cell + cell/2 + 2, y * cell + cell/2);
        ctx.moveTo(x * cell + cell/2, y * cell + cell/2 - 2);
        ctx.lineTo(x * cell + cell/2, y * cell + cell/2 + 2);
        ctx.stroke();
      }

      // Color code label
      if (cell >= 12) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = `${Math.max(6, cell * 0.3)}px sans-serif`;
        ctx.textAlign = 'center';
        const code = DMC_COLORS.find(c => c[0] === hex)?.[2] ?? '?';
        ctx.fillText(code, x * cell + cell/2, y * cell + cell/2 + 2);
      }

      const key = hex;
      if (!colorCount.has(key)) colorCount.set(key, { hex, name, count: 0 });
      colorCount.get(key)!.count++;
    }
  }

  // Update palette
  const pal = document.getElementById('palette')!;
  const sorted = [...colorCount.values()].sort((a, b) => b.count - a.count);
  pal.innerHTML = `<div style="width:100%;text-align:center;font-size:.9rem;font-weight:700;margin-bottom:4px">调色板 (${sorted.length} 色)</div>` +
    sorted.map(c => {
      const code = DMC_COLORS.find(d => d[0] === c.hex)?.[2] ?? '?';
      return `<div class="pal-item"><div class="pal-swatch" style="background:${c.hex}"></div>${c.name} (DMC ${code}) ×${c.count}</div>`;
    }).join('');
}

function exportPNG() {
  const cv = document.getElementById('cv') as HTMLCanvasElement;
  cv.toBlob(b => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = 'cross-stitch.png'; a.click();
    URL.revokeObjectURL(url);
  });
}

render();
