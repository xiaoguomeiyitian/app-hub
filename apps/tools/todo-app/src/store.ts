import type { Todo } from './types.ts';
import { createIdbStore } from '@app-hub/utils/idb';

const STORAGE_DB = 'todo-app-db';
const store = createIdbStore(STORAGE_DB, 'kv');
const MAX_ITEMS = 100;

export class TodoStore {
  private todos: Todo[] = [];

  async load(): Promise<void> {
    try {
      const raw = await store.get('todos');
      if (raw) this.todos = raw;
    } catch (e) {
      console.error('Load failed', e);
      this.todos = [];
    }
  }

  private async save(): Promise<void> {
    try {
      await store.set('todos', this.todos);
    } catch {}
  }

  async init(): Promise<void> {
    await this.load();
  }

  getAll(): Todo[] {
    return [...this.todos];
  }

  async add(text: string): Promise<Todo | null> {
    const trimmed = text.trim();
    if (!trimmed || this.todos.length >= MAX_ITEMS) return null;
    const todo: Todo = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
    };
    this.todos.unshift(todo);
    await this.save();
    return todo;
  }

  async toggle(id: string): Promise<boolean> {
    const todo = this.todos.find(t => t.id === id);
    if (!todo) return false;
    todo.completed = !todo.completed;
    await this.save();
    return true;
  }

  async remove(id: string): Promise<boolean> {
    const index = this.todos.findIndex(t => t.id === id);
    if (index === -1) return false;
    this.todos.splice(index, 1);
    await this.save();
    return true;
  }

  async edit(id: string, newText: string): Promise<boolean> {
    const trimmed = newText.trim();
    if (!trimmed) return false;
    const todo = this.todos.find(t => t.id === id);
    if (!todo) return false;
    todo.text = trimmed;
    await this.save();
    return true;
  }

  async clearCompleted(): Promise<number> {
    const count = this.todos.filter(t => t.completed).length;
    this.todos = this.todos.filter(t => !t.completed);
    await this.save();
    return count;
  }

  async clearAll(): Promise<number> {
    const count = this.todos.length;
    this.todos = [];
    await this.save();
    return count;
  }

  getStats(): { total: number; completed: number } {
    return {
      total: this.todos.length,
      completed: this.todos.filter(t => t.completed).length,
    };
  }
}