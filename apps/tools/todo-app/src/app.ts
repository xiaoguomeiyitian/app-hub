import type { Todo, FilterType } from './types.ts';
import { TodoStore } from './store.ts';

const APP_NAME = 'Todo App';
const APP_VERSION = '1.3.0';
const APP_DESC = '待办事项管理，支持子任务、优先级和截止日期';

let theme: 'light' | 'dark' = (localStorage.getItem('todo_theme') as 'light' | 'dark') || 'light';

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('todo_theme', theme);
  applyTheme();
}

function showAbout(): void {
  alert(`${APP_NAME} v${APP_VERSION}\n\n${APP_DESC}\n\n© 2026 应用大厅`);
}

function resetAll(store: TodoStore): void {
  if (!confirm('确定要重置所有待办事项吗？此操作不可撤销。')) return;
  localStorage.clear();
  localStorage.setItem('todo_theme', theme);
  store.clearAll();
}

// 导入/导出
function exportData(store: TodoStore): void {
  const todos = store.getAll();
  const data = { todos, exportDate: new Date().toISOString(), version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'todo-data.json'; a.click();
}

function importData(store: TodoStore, event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.todos && Array.isArray(data.todos)) {
        data.todos.forEach((todo: Todo) => store.add(todo.text));
      }
    } catch { alert('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

export class TodoApp {
  private store: TodoStore;
  private filter: FilterType = 'all';
  private root: HTMLElement;
  private inputEl!: HTMLInputElement;
  private listEl!: HTMLUListElement;
  private statusEl!: HTMLDivElement;
  private filterEl!: HTMLDivElement;
  private emptyEl!: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.store = new TodoStore();
    applyTheme();
    this.render();
    this.bindEvents();
  }

  async init(): Promise<void> {
    await this.store.init();
    this.updateView();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="todo-container">
        <div class="todo-header">
          <h1 class="todo-title">✅ 我的待办事项</h1>
          <div class="header-right">
            <button class="btn-icon" id="theme-toggle" title="切换主题">${theme === 'light' ? '🌙' : '☀️'}</button>
            <button class="btn-icon" id="about-btn" title="关于">ℹ️</button>
            <button class="btn-sm" id="export-btn">📤 导出</button>
            <label class="btn-sm">📥 导入<input type="file" accept=".json" id="import-input" hidden/></label>
            <button class="btn-sm" id="reset-btn">🔄 重置</button>
          </div>
        </div>

        <div class="input-bar">
          <input type="text" class="todo-input" placeholder="输入新任务..." maxlength="200" />
          <select id="priority-select" class="select">
            <option value="">无优先级</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
          <input type="date" id="due-date" class="date-input" />
          <button class="add-btn">添加</button>
        </div>

        <div class="empty-state" style="display:none;">
          <span class="empty-icon">📝</span>
          <p>暂无任务，添加一个吧！</p>
        </div>

        <ul class="todo-list"></ul>

        <div class="status-bar">
          <div class="status-text">已完成 0 / 0</div>
          <button class="clear-btn">清除已完成</button>
        </div>

        <div class="filter-bar">
          <button class="filter-btn active" data-filter="all">全部</button>
          <button class="filter-btn" data-filter="active">未完成</button>
          <button class="filter-btn" data-filter="completed">已完成</button>
        </div>
      </div>
    `;

    this.inputEl = this.root.querySelector('.todo-input') as HTMLInputElement;
    this.listEl = this.root.querySelector('.todo-list') as HTMLUListElement;
    this.statusEl = this.root.querySelector('.status-bar') as HTMLDivElement;
    this.filterEl = this.root.querySelector('.filter-bar') as HTMLDivElement;
    this.emptyEl = this.root.querySelector('.empty-state') as HTMLDivElement;
  }

  private bindEvents(): void {
    // 主题、关于、重置、导入导出
    document.getElementById('theme-toggle')?.addEventListener('click', () => { toggleTheme(); });
    document.getElementById('about-btn')?.addEventListener('click', () => { showAbout(); });
    document.getElementById('reset-btn')?.addEventListener('click', () => { resetAll.call(this, this.store); });
    document.getElementById('export-btn')?.addEventListener('click', () => { exportData.call(this, this.store); });
    document.getElementById('import-input')?.addEventListener('change', (e) => { importData.call(this, this.store, e); });

    // Add button
    this.root.querySelector('.add-btn')!.addEventListener('click', () => this.handleAdd());

    // Enter key
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAdd();
    });

    // Todo list delegated events
    this.listEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const li = target.closest('li') as HTMLLIElement;
      if (!li) return;
      const id = li.dataset.id!;

      if (target.classList.contains('delete-btn')) {
        this.store.remove(id).then(() => this.updateView());
      } else if (target.classList.contains('todo-checkbox')) {
        this.store.toggle(id).then(() => this.updateView());
      }
    });

    // Double-click to edit
    this.listEl.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      const span = target.closest('.todo-text');
      if (!span) return;
      const li = span.closest('li') as HTMLLIElement;
      if (!li) return;
      this.startEdit(li.dataset.id!, span as HTMLSpanElement);
    });

    // Clear completed
    this.root.querySelector('.clear-btn')!.addEventListener('click', async () => {
      await this.store.clearCompleted();
      this.updateView();
    });

    // Filter buttons
    this.filterEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.filter-btn') as HTMLButtonElement;
      if (!btn) return;
      this.filter = btn.dataset.filter as FilterType;
      this.filterEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.updateView();
    });
  }

  private async handleAdd(): Promise<void> {
    const text = this.inputEl.value;
    const todo = await this.store.add(text);
    if (todo) {
      this.inputEl.value = '';
      await this.init(); // refresh
      this.inputEl.focus();
    }
  }

  private startEdit(id: string, span: HTMLSpanElement): void {
    const currentText = span.textContent || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'edit-input';
    input.maxLength = 200;

    const finishEdit = async (): Promise<void> => {
      const newText = input.value.trim();
      if (newText && newText !== currentText) {
        await this.store.edit(id, newText);
      }
      this.updateView();
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finishEdit();
      if (e.key === 'Escape') this.updateView();
    });

    span.replaceWith(input);
    input.focus();
    input.select();
  }

  private getFilteredTodos(): Todo[] {
    const all = this.store.getAll();
    switch (this.filter) {
      case 'active': return all.filter(t => !t.completed);
      case 'completed': return all.filter(t => t.completed);
      default: return all;
    }
  }

  private updateView(): void {
    const todos = this.getFilteredTodos();
    const stats = this.store.getStats();

    this.listEl.innerHTML = todos.map(t => `
      <li data-id="${t.id}" class="${t.completed ? 'completed' : ''}">
        <input type="checkbox" class="todo-checkbox" ${t.completed ? 'checked' : ''} />
        <span class="todo-text">${t.text}</span>
        <button class="delete-btn">🗑️</button>
      </li>
    `).join('');

    this.statusEl.querySelector('.status-text')!.textContent = `已完成 ${stats.completed} / ${stats.total}`;
    this.emptyEl.style.display = todos.length ? 'none' : 'block';
  }
}