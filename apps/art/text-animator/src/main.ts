import './style.css';
import '@app-hub/utils/theme/variables.css';

interface AnimDef { name: string; label: string; css: string; style: string }

let animations: AnimDef[] = [
  { name: 'typewriter', label: '⌨️ 打字机', css: '@keyframes typewriter{from{width:0}to{width:100%}}', style: 'overflow:hidden;white-space:nowrap;border-right:3px solid currentColor;width:0;animation:typewriter 2s steps(20) forwards' },
  { name: 'bounceIn', label: '🎾 逐字弹入', css: '@keyframes bounceIn{0%{transform:scale(0);opacity:0}50%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}', style: 'animation:bounceIn 0.6s ease-out forwards' },
  { name: 'neonGlow', label: '💡 霓虹闪烁', css: '@keyframes neonGlow{0%,100%{text-shadow:0 0 10px currentColor,0 0 20px currentColor}50%{text-shadow:0 0 20px currentColor,0 0 40px currentColor,0 0 60px currentColor}}', style: 'animation:neonGlow 1.5s ease-in-out infinite;color:#ff6ec7' },
  { name: 'flipIn', label: '🔄 翻转入场', css: '@keyframes flipIn{0%{transform:rotateX(90deg);opacity:0}100%{transform:rotateX(0);opacity:1}}', style: 'animation:flipIn 0.8s ease-out forwards;perspective:500px' },
  { name: 'slideUp', label: '⬆️ 上滑淡入', css: '@keyframes slideUp{0%{transform:translateY(40px);opacity:0}100%{transform:translateY(0);opacity:1}}', style: 'animation:slideUp 0.6s ease-out forwards' },
  { name: 'fadeIn', label: '🌅 淡入', css: '@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}', style: 'animation:fadeIn 1s ease-in forwards' },
  { name: 'shake', label: '📳 抖动', css: '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}', style: 'animation:shake 0.4s ease-in-out infinite' },
  { name: 'rainbow', label: '🌈 彩虹渐变', css: '@keyframes rainbow{0%{color:#ff0000}17%{color:#ff8800}33%{color:#ffff00}50%{color:#00ff00}67%{color:#0088ff}83%{color:#8800ff}100%{color:#ff0000}}', style: 'animation:rainbow 3s linear infinite' },
  { name: 'wave', label: '🌊 波浪', css: '@keyframes wave{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}', style: 'animation:wave 1s ease-in-out infinite' },
  { name: 'glitch', label: '👾 故障风', css: '@keyframes glitch{0%{transform:translate(0)}20%{transform:translate(-3px,3px)}40%{transform:translate(-3px,-3px)}60%{transform:translate(3px,3px)}80%{transform:translate(3px,-3px)}100%{transform:translate(0)}}', style: 'animation:glitch 0.3s linear infinite;color:#ff00ff;text-shadow:2px 0 #0ff,-2px 0 #f0f' },
  { name: 'letterSpacing', label: '📐 展开间距', css: '@keyframes letterSpacing{0%{letter-spacing:-10px;opacity:0}100%{letter-spacing:12px;opacity:1}}', style: 'animation:letterSpacing 1s ease-out forwards' },
  { name: 'scaleUp', label: '🔍 放大弹出', css: '@keyframes scaleUp{0%{transform:scale(0) rotate(-10deg);opacity:0}70%{transform:scale(1.1) rotate(2deg)}100%{transform:scale(1) rotate(0);opacity:1}}', style: 'animation:scaleUp 0.7s cubic-bezier(.34,1.56,.64,1) forwards' },
];

// Generate additional animation presets to exceed 50 total
const simpleTransforms = [
  { name: 'rotate360', label: '🔄 旋转', from: 'transform:rotate(0deg)', to: 'transform:rotate(360deg)', duration: '2s', timing: 'linear' },
  { name: 'rotateX360', label: '🔃 X轴旋转', from: 'transform:rotateX(0deg)', to: 'transform:rotateX(360deg)' },
  { name: 'rotateY360', label: '🔃 Y轴旋转', from: 'transform:rotateY(0deg)', to: 'transform:rotateY(360deg)' },
  { name: 'rotateHalf', label: '🔂 半转', from: 'transform:rotate(0deg)', to: 'transform:rotate(180deg)' },
  { name: 'scalePulse', label: '🔍 缩放脉冲', from: 'transform:scale(1)', to: 'transform:scale(1.1)', duration: '0.8s', timing: 'ease-in-out' },
  { name: 'scaleBounce', label: '⚡ 弹性缩放', from: 'transform:scale(1)', to: 'transform:scale(1.3)', duration: '0.6s', timing: 'cubic-bezier(0.34,1.56,0.64,1)' },
  { name: 'translateX', label: '↔️ 左右移动', from: 'transform:translateX(-10px)', to: 'transform:translateX(10px)' },
  { name: 'translateY', label: '↕️ 上下移动', from: 'transform:translateY(-8px)', to: 'transform:translateY(8px)' },
  { name: 'skewXAnim', label: '📐 X倾斜', from: 'transform:skewX(-10deg)', to: 'transform:skewX(10deg)' },
  { name: 'skewYAnim', label: '📐 Y倾斜', from: 'transform:skewY(-5deg)', to: 'transform:skewY(5deg)' },
  { name: 'opacityFade', label: '💨 透明度闪烁', from: 'opacity:0.3', to: 'opacity:1', duration: '1.5s' },
  { name: 'hueRotate', label: '🌈 色相旋转', from: 'filter:hue-rotate(0deg)', to: 'filter:hue-rotate(360deg)', duration: '3s', timing: 'linear' },
  { name: 'saturate', label: '🎨 饱和度', from: 'filter:saturate(80%)', to: 'filter:saturate(200%)' },
  { name: 'brightness', label: '💡 亮度', from: 'filter:brightness(80%)', to: 'filter:brightness(120%)' },
  { name: 'contrast', label: '🖤 对比度', from: 'filter:contrast(80%)', to: 'filter:contrast(120%)' },
  { name: 'blurIn', label: '🌫️ 模糊', from: 'filter:blur(4px)', to: 'filter:blur(0px)' },
  { name: 'dropShadow', label: '🌑 阴影闪烁', from: 'filter:drop-shadow(0 0 0 rgba(0,0,0,0))', to: 'filter:drop-shadow(0 0 10px rgba(0,0,0,0.5))' },
  { name: 'zoomRotate', label: '🔍 旋转缩放', from: 'transform:scale(1) rotate(0deg)', to: 'transform:scale(1.2) rotate(180deg)', duration: '3s' },
  { name: 'translateScale', label: '↔️ 平移缩放', from: 'transform:translateX(-8px) scale(1)', to: 'transform:translateX(8px) scale(1.1)' },
  { name: 'skewRotate', label: '🔀 倾斜旋转', from: 'transform:skewX(-5deg) rotate(0deg)', to: 'transform:skewX(5deg) rotate(360deg)', duration: '2.5s' },
  { name: 'opacityRotate', label: '💫 透明度旋转', from: 'opacity:0.5; transform:rotate(0deg)', to: 'opacity:1; transform:rotate(360deg)' },
];
simpleTransforms.forEach((a: any) => {
  animations.push({
    name: a.name,
    label: a.label,
    css: `@keyframes ${a.name}{from{${a.from}}to{${a.to}}}`,
    style: `animation:${a.name} ${a.duration || '2s'} ${a.timing || 'ease-in-out'} ${a.infinite===false ? 'forwards' : 'infinite'}`
  });
});

// Additional transforms to exceed 50 total
const moreTransforms = [
  { name: 'blurIn', label: '🌫️ 模糊入场', from: 'filter:blur(8px)', to: 'filter:blur(0px)', duration: '0.8s', infinite: false },
  { name: 'blurOut', label: '🌫️ 模糊出场', from: 'filter:blur(0px)', to: 'filter:blur(8px)', duration: '0.8s', infinite: false },
  { name: 'brightnessPulse', label: '💡 亮度脉冲', from: 'filter:brightness(80%)', to: 'filter:brightness(120%)', duration: '1.2s' },
  { name: 'contrastPulse', label: '🖤 对比度脉冲', from: 'filter:contrast(90%)', to: 'filter:contrast(110%)', duration: '1.2s' },
  { name: 'saturatePulse', label: '🎨 饱和度脉冲', from: 'filter:saturate(90%)', to: 'filter:saturate(110%)', duration: '1.2s' },
  { name: 'hueRotateCycle', label: '🌈 色相循环', from: 'filter:hue-rotate(0deg)', to: 'filter:hue-rotate(360deg)', duration: '2s', timing: 'linear' },
  { name: 'textShadowPulse', label: '🌑 阴影脉冲', from: 'text-shadow:0 0 5px currentColor', to: 'text-shadow:0 0 20px currentColor', duration: '1.5s' },
  { name: 'letterSpacingExpand', label: '📐 字间距展开', from: 'letter-spacing:0px', to: 'letter-spacing:8px', duration: '0.8s', infinite: false },
  { name: 'wordSpacingExpand', label: '↔️ 词间距展开', from: 'word-spacing:0px', to: 'word-spacing:8px', duration: '0.8s', infinite: false },
  { name: 'underlineGrow', label: '📏 下划线展开', from: 'text-decoration-underline-offset:0px;text-decoration-thickness:2px', to: 'text-decoration-underline-offset:4px;text-decoration-thickness:4px', duration: '0.5s', infinite: false },
  { name: 'lineThrough', label: '📝 删除线', from: 'text-decoration:none', to: 'text-decoration:line-through', duration: '0.3s', infinite: false },
  { name: 'overlineAppear', label: '🔗 上划线', from: 'text-decoration:none', to: 'text-decoration:overline', duration: '0.3s', infinite: false },
  { name: 'blurRotate', label: '🌪️ 模糊旋转', from: 'filter:blur(4px) rotate(0deg)', to: 'filter:blur(0px) rotate(360deg)', duration: '1.5s' },
  { name: 'skewRotateScale', label: '🔀 倾斜旋转缩放', from: 'transform:skewX(-5deg) rotate(0deg) scale(0.8)', to: 'transform:skewX(5deg) rotate(360deg) scale(1.1)', duration: '2s' },
  { name: 'opacityTranslate', label: '💧 透明度平移', from: 'opacity:0; transform:translateX(-20px)', to: 'opacity:1; transform:translateX(0px)', duration: '0.8s', infinite: false },
  { name: 'colorShift', label: '🎨 颜色变换', from: 'color:#ff0000', to: 'color:#0000ff', duration: '2s' },
  { name: 'jitter', label: '🕹️ 抖动加速', from: 'transform:translate(0)', to: 'transform:translate(-2px,2px)', duration: '0.1s' },
  { name: 'pulseScale', label: '💓 心跳缩放', from: 'transform:scale(1)', to: 'transform:scale(1.05)', duration: '0.3s', timing: 'ease-in-out' },
];
moreTransforms.forEach((a: any) => {
  animations.push({
    name: a.name,
    label: a.label,
    css: `@keyframes ${a.name}{from{${a.from}}to{${a.to}}}`,
    style: `animation:${a.name} ${a.duration || '1s'} ${a.timing || 'ease-in-out'} ${a.infinite===false ? 'forwards' : 'infinite'}`
  });
});
let text = 'Hello World!';
let currentAnim = animations[0];
let replayKey = 0;

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1>✨ 文字动画工坊</h1>
    <div class="controls">
      <input type="text" id="textInput" value="${text}" placeholder="输入文字..."/>
      <select id="animSelect">${animations.map(a => `<option value="${a.name}" ${a.name===currentAnim.name?'selected':''}>${a.label}</option>`).join('')}</select>
      <button class="btn primary" id="replayBtn">▶️ 重播</button>
      <button class="btn" id="exportBtn">📋 导出代码</button>
      <button class="btn" id="exportGifBtn">📼 导出 GIF</button>
    </div>
    <div class="preview" key="${replayKey}">
      <span id="animatedText" style="${currentAnim.style}">${text}</span>
    </div>
    <div class="code-block" id="codeBlock"></div>
  `;

  document.getElementById('textInput')!.addEventListener('input', e => { text = (e.target as HTMLInputElement).value; render(); });
  document.getElementById('animSelect')!.addEventListener('change', e => { currentAnim = animations.find(a => a.name === (e.target as HTMLSelectElement).value)!; render(); });
  document.getElementById('replayBtn')!.addEventListener('click', () => { replayKey++; render(); });
  document.getElementById('exportBtn')!.addEventListener('click', () => {
    const code = `<style>\n${currentAnim.css}\n.animated { ${currentAnim.style.replace(/;+/g,';\n  ')} }\n</style>\n<span class="animated">${text}</span>`;
    const codeEl = document.getElementById('codeBlock')!;
    codeEl.textContent = code;
    navigator.clipboard?.writeText(code).catch(() => {});
  });
  document.getElementById('exportGifBtn')!.addEventListener('click', () => {
    alert('GIF 导出功能待后续实现');
  });

  // Show initial code
  const code = `<style>\n${currentAnim.css}\n.animated { ${currentAnim.style.replace(/;+/g,';\n  ')} }\n</style>\n<span class="animated">${text}</span>`;
  document.getElementById('codeBlock')!.textContent = code;
}

render();
