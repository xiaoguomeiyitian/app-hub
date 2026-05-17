import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverProjects, getLoadedProjects } from '../router.js';

test('router: discoverProjects returns array of project names', async () => {
  const projects = await discoverProjects();
  assert.ok(Array.isArray(projects), 'should return an array');
  // Expect at least some projects exist (since routes directory has many)
  assert.ok(projects.length > 0, 'should discover at least one project');
  // Ensure common project exists
  assert.ok(projects.includes('todo-app') || projects.includes('guestbook'), 'should include known projects');
});

test('router: getLoadedProjects returns current loaded list', () => {
  const list = getLoadedProjects();
  assert.ok(Array.isArray(list), 'should return an array');
});
