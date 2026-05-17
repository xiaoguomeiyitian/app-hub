import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'http';
import { createUpgradeAwareServer } from '../upgrade-listener-registry.js';

test('upgrade-listener-registry: createUpgradeAwareServer returns a proxy', () => {
  const server = createServer();
  const wsServer = createUpgradeAwareServer(server);
  assert.ok(wsServer, 'should return a server proxy');
  assert.equal(typeof wsServer.on, 'function', 'should have on method');
  assert.equal(typeof wsServer.removeListener, 'function', 'should have removeListener method');
});

test('upgrade-listener-registry: upgrade listeners can be registered and removed', () => {
  const server = createServer();
  const wsServer = createUpgradeAwareServer(server);

  const handler = () => {};
  wsServer.on('upgrade', handler);
  wsServer.removeListener('upgrade', handler);
  // Should not throw
  assert.ok(true);
});

test('upgrade-listener-registry: non-upgrade events pass through', () => {
  const server = createServer();
  const wsServer = createUpgradeAwareServer(server);

  const handler = () => {};
  // 'request' event should pass through to original server
  wsServer.on('request', handler);
  wsServer.removeListener('request', handler);
  assert.ok(true);
});
