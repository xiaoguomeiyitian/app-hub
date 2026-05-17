import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLobbyFoundationSnapshot, buildLobbyOnboardingSnapshot } from '../lobby-snapshot.js';

const mockProjects = [
  { name: 'app-lobby', description: '大厅前端', hasRouter: false, hasSocket: false },
  { name: 'shared-backend', description: '共享后端', hasRouter: true, hasSocket: false },
  { name: 'todo-app', description: '待办事项', hasRouter: true, hasSocket: false },
];

test('lobby-snapshot: buildLobbyFoundationSnapshot returns correct structure', () => {
  const snapshot = buildLobbyFoundationSnapshot(mockProjects);
  assert.equal(snapshot.phase, 'v3.6');
  assert.equal(snapshot.focus, '大厅初始化只读快照');
  assert.ok(Array.isArray(snapshot.coreObjects));
  assert.ok(Array.isArray(snapshot.availableProjects));
  assert.equal(snapshot.coreObjects.length, 2);
});

test('lobby-snapshot: buildLobbyFoundationSnapshot marks availability correctly', () => {
  const snapshot = buildLobbyFoundationSnapshot(mockProjects);
  const lobby = snapshot.availableProjects.find(p => p.name === 'app-lobby');
  assert.ok(lobby);
  assert.equal(lobby.available, true);

  const backend = snapshot.availableProjects.find(p => p.name === 'shared-backend');
  assert.ok(backend);
  assert.equal(backend.available, true);
});

test('lobby-snapshot: buildLobbyOnboardingSnapshot returns correct structure', () => {
  const snapshot = buildLobbyOnboardingSnapshot(mockProjects);
  assert.equal(snapshot.phase, 'v3.6');
  assert.ok(Array.isArray(snapshot.steps));
  assert.ok(snapshot.steps.length > 0);
  assert.ok(Array.isArray(snapshot.availableProjects));
});

test('lobby-snapshot: buildLobbyOnboardingSnapshot steps have required fields', () => {
  const snapshot = buildLobbyOnboardingSnapshot(mockProjects);
  for (const step of snapshot.steps) {
    assert.ok(step.name, 'step should have a name');
    assert.ok(step.description, 'step should have a description');
    assert.equal(typeof step.available, 'boolean');
  }
});

test('lobby-snapshot: empty projects list does not throw', () => {
  const snapshot = buildLobbyFoundationSnapshot([]);
  assert.ok(snapshot);
  assert.equal(snapshot.availableProjects.length, 2);
  assert.ok(snapshot.availableProjects.every(p => !p.available));
});
