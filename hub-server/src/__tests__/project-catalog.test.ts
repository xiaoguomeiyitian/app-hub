import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCategories, getMergedProjects, resetStaticDiscoveryCache, toProjectEntry } from '../project-catalog.js';

test('project-catalog uses project meta when building entries', () => {
  const entry = toProjectEntry('todo-app');
  assert.equal(entry.label_en, 'Todo App');
  assert.equal(entry.category, 'tool-dev');
});


test('project-catalog builds categories from merged projects', () => {
  resetStaticDiscoveryCache();
  const projects = [
    toProjectEntry('todo-app'),
    toProjectEntry('guestbook'),
    toProjectEntry('url-shortener'),
  ];
  const categories = buildCategories(projects);
  assert.ok(categories['tool-dev']);
  assert.ok(categories['social']);
});


test('project-catalog merges loaded projects without duplicates', () => {
  resetStaticDiscoveryCache();
  const merged = getMergedProjects([
    { name: 'todo-app', description: 'x', hasRouter: true, hasSocket: false },
    { name: 'guestbook', description: 'y', hasRouter: true, hasSocket: true },
  ]);
  const names = merged.map((p) => p.name);
  assert.ok(names.includes('todo-app'));
  assert.ok(names.includes('guestbook'));
  assert.equal(new Set(names).size, names.length);
});

test('project-catalog keeps lobby hidden projects filtered out', () => {
  resetStaticDiscoveryCache();
  const merged = getMergedProjects([
    { name: 'auth', description: 'auth', hasRouter: true, hasSocket: false },
    { name: 'admin', description: 'admin', hasRouter: true, hasSocket: false },
    { name: 'platform-console', description: 'platform-console', hasRouter: true, hasSocket: false },
    { name: 'snake-mp', description: 'snake-mp', hasRouter: true, hasSocket: true },
  ]);
  const names = merged.map((p) => p.name);
  assert.ok(!names.includes('auth'));
  assert.ok(!names.includes('admin'));
  assert.ok(!names.includes('platform-console'));
  assert.ok(!names.includes('snake-mp'));
});

