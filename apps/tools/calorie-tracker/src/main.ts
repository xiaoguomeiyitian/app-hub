import '@app-hub/design-system/src/style.css';
import './style.css';
import { createIdbStore } from '@app-hub/utils/idb';
import { createChart } from '@app-hub/utils/charts';

const APP_NAME = 'Calorie Tracker';
const APP_VERSION = '1.3.0';
const APP_DESC = '卡路里追踪器，支持食物营养记录和统计';

interface FoodInfo { name: string; cal: number; protein: number; fat: number; carbs: number; }
interface MealLog { id: string; food: string; cal: number; protein: number; fat: number; carbs: number; meal: string; time: number; }

let theme: 'light' | 'dark' = (localStorage.getItem('calorie_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('calorie_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(): void {
  if (!confirm('确定要重置所有数据吗？此操作不可撤销。')) return;
  logs = [];
  localStorage.clear();
  localStorage.setItem('calorie_theme', theme);
  save(logs).then(() => render());
}

function exportData(): void {
  const data = { logs, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'calorie-data.json'; a.click();
}

function importData(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.logs && Array.isArray(data.logs)) {
        logs = data.logs;
        save(logs).then(() => render());
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

const FOODS: FoodInfo[] = [
  { name:'米饭(1碗)',cal:230,protein:4,fat:0.5,carbs:50 },{ name:'面条(1碗)',cal:280,protein:8,fat:2,carbs:55 },
  { name:'面包(1片)',cal:80,protein:3,fat:1,carbs:15 },{ name:'鸡蛋(1个)',cal:70,protein:6,fat:5,carbs:0.5 },
  { name:'牛奶(1杯)',cal:150,protein:8,fat:8,carbs:12 },{ name:'鸡胸肉(100g)',cal:165,protein:31,fat:3.6,carbs:0 },
  { name:'牛肉(100g)',cal:250,protein:26,fat:15,carbs:0 },{ name:'猪肉(100g)',cal:270,protein:25,fat:18,carbs:0 },
  { name:'鱼(100g)',cal:120,protein:22,fat:3,carbs:0 },{ name:'豆腐(100g)',cal:80,protein:8,fat:4,carbs:2 },
  { name:'苹果(1个)',cal:95,protein:0.5,fat:0.3,carbs:25 },{ name:'香蕉(1根)',cal:105,protein:1.3,fat:0.4,carbs:27 },
  { name:'橙子(1个)',cal:62,protein:1.2,fat:0.2,carbs:15 },{ name:'西兰花(100g)',cal:34,protein:2.8,fat:0.4,carbs:7 },
  { name:'番茄(1个)',cal:22,protein:1,fat:0.2,carbs:5 },{ name:'黄瓜(1根)',cal:15,protein:0.7,fat:0.1,carbs:3 },
  { name:'可乐(1罐)',cal:140,protein:0,fat:0,carbs:39 },{ name:'啤酒(1瓶)',cal:150,protein:1,fat:0,carbs:13 },
  { name:'咖啡(1杯)',cal:5,protein:0.3,fat:0,carbs:1 },{ name:'酸奶(1杯)',cal:150,protein:6,fat:4,carbs:20 },
  { name:'巧克力(1块)',cal:150,protein:2,fat:9,carbs:17 },{ name:'薯片(30g)',cal:160,protein:2,fat:10,carbs:15 },
  { name:'沙拉(1碗)',cal:50,protein:2,fat:1,carbs:8 },{ name:'寿司(6个)',cal:200,protein:9,fat:3,carbs:38 },
  { name:'汉堡(1个)',cal:550,protein:25,fat:30,carbs:45 },{ name:'披萨(1片)',cal:285,protein:12,fat:10,carbs:36 },
];

const STORAGE_DB = 'calorie-tracker-db';
const store = createIdbStore(STORAGE_DB, 'kv');

async function load(): Promise<MealLog[]> {
  try {
    const raw = await store.get('logs');
    return raw ?? [];
  } catch { return []; }
}

async function save(l: MealLog[]): Promise<void> {
  await store.set('logs', l);
}

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let logs: MealLog[] = [];
let selectedMeal = '早餐';

function render(): void {
  applyTheme();
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter(l => new Date(l.time).toISOString().slice(0, 10) === today);
  const totalCal = todayLogs.reduce((sum, l) => sum + l.cal, 0);
  const totalProtein = todayLogs.reduce((sum, l) => sum + l.protein, 0);
  
  const app = document.getElementById('app')!;
  app.innerHTML = `
  <div class="app">
    <header class="header">
      <span class="logo">🍎</span><span class="title">Calorie Tracker</span>
      <div class="header-right">
        <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
        <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
        <button class="btn-sm" id="export-btn">📤 导出</button>
        <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
        <button class="btn-sm" id="reset-btn">🔄 重置</button>
      </div>
    </header>
    <main class="main">
      <div class="summary">
        <div class="summary-item">今日卡路里: <strong>${totalCal}</strong> kcal</div>
        <div class="summary-item">蛋白质: <strong>${totalProtein.toFixed(1)}</strong> g</div>
      </div>
      <div class="controls">
        <select id="meal-select" class="select">
          <option value="早餐" ${selectedMeal === '早餐' ? 'selected' : ''}>早餐</option>
          <option value="午餐" ${selectedMeal === '午餐' ? 'selected' : ''}>午餐</option>
          <option value="晚餐" ${selectedMeal === '晚餐' ? 'selected' : ''}>晚餐</option>
          <option value="加餐" ${selectedMeal === '加餐' ? 'selected' : ''}>加餐</option>
        </select>
        <select id="food-select" class="select">
          ${FOODS.map(f => `<option value="${f.name}" data-cal="${f.cal}" data-protein="${f.protein}" data-fat="${f.fat}" data-carbs="${f.carbs}">${f.name} (${f.cal}卡)</option>`).join('')}
        </select>
        <button class="btn-sm" id="add-meal">+ 添加</button>
      </div>
      <div class="log-list">
        ${todayLogs.map(l => `
          <div class="log-item">
            <span class="log-meal">${l.meal}</span>
            <span class="log-food">${l.food}</span>
            <span class="log-cal">${l.cal}卡</span>
            <button class="del-log" data-id="${l.id}">×</button>
          </div>
        `).join('')}
        ${todayLogs.length === 0 ? '<p class="text-muted">今日暂无记录</p>' : ''}
      </div>
    </main>
  </div>`;
  bindEvents();
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
  document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
  document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll(); });
  document.getElementById('export-btn')?.addEventListener('click', () => { exportData(); });
  document.getElementById('import-input')?.addEventListener('change', (e) => { importData(e); });

  document.getElementById('meal-select')?.addEventListener('change', (e) => {
    selectedMeal = (e.target as HTMLSelectElement).value;
  });

  document.getElementById('add-meal')?.addEventListener('click', () => {
    const foodSelect = document.getElementById('food-select') as HTMLSelectElement;
    const option = foodSelect.selectedOptions[0];
    const food: FoodInfo = {
      name: option.value,
      cal: +option.dataset.cal!,
      protein: +option.dataset.protein!,
      fat: +option.dataset.fat!,
      carbs: +option.dataset.carbs!
    };
    logs.push({ id: uid(), food: food.name, cal: food.cal, protein: food.protein, fat: food.fat, carbs: food.carbs, meal: selectedMeal, time: Date.now() });
    save(logs).then(() => render());
  });

  document.querySelectorAll('.del-log').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      logs = logs.filter(l => l.id !== id);
      save(logs).then(() => render());
    });
  });
}

(async () => {
  logs = await load();
  render();
})();
