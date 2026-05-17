import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppLobbyStandalone } from '../index';

const closeServer = (server: { close: (cb?: () => void) => void }) =>
  new Promise<void>((resolve) => server.close(() => resolve()));

test('app-lobby creates a standalone http server', async () => {
  const { httpServer } = createAppLobbyStandalone();
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const address = httpServer.address();
  assert.ok(address);
  await closeServer(httpServer);
});
