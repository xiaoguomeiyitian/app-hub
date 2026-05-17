import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

test('http-stack: registerHttpStack registers middleware without throwing', async () => {
  const { registerHttpStack } = await import('../http-stack.js');
  const app = express();
  // 不应抛出异常
  registerHttpStack(app);
  assert.ok(true, 'registerHttpStack should not throw');
});

test('http-stack: POST without CSRF token returns 403', async () => {
  const { registerHttpStack } = await import('../http-stack.js');
  const app = express();
  registerHttpStack(app);

  let statusCode = 0;

  await new Promise<void>((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      import('node:http').then(({ request }) => {
        const body = JSON.stringify({ project: 'test' });
        const req = request(`http://localhost:${port}/api/click`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        }, (res) => {
          statusCode = res.statusCode ?? 0;
          server.close();
          resolve();
        });
        req.write(body);
        req.end();
      });
    });
  });

  assert.equal(statusCode, 403, 'POST without CSRF token should return 403');
});

test('http-stack: POST with valid CSRF token succeeds', async () => {
  const { registerHttpStack } = await import('../http-stack.js');
  const app = express();
  registerHttpStack(app);

  // 先 GET 获取 CSRF token
  let csrfCookie = '';

  await new Promise<void>((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      import('node:http').then(({ request }) => {
        const req = request(`http://localhost:${port}/health`, { method: 'GET' }, (res) => {
          const cookies = res.headers['set-cookie'] || [];
          csrfCookie = cookies.find((c: string) => c.startsWith('csrf-token=')) || '';
          server.close();
          resolve();
        });
        req.end();
      });
    });
  });

  assert.ok(csrfCookie, 'CSRF cookie should be set after GET');

  // 提取 token
  const token = csrfCookie.split(';')[0].split('=')[1];
  assert.ok(token, 'CSRF token should not be empty');

  // 使用 token 发送 POST
  let statusCode = 0;
  await new Promise<void>((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      import('node:http').then(({ request }) => {
        const body = JSON.stringify({ project: 'test' });
        const req = request(`http://localhost:${port}/api/click`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'x-csrf-token': token,
            'Cookie': `csrf-token=${token}`,
          },
        }, (res) => {
          statusCode = res.statusCode ?? 0;
          server.close();
          resolve();
        });
        req.write(body);
        req.end();
      });
    });
  });

  // 200 或 400（参数校验）都算通过，只要不是 403
  assert.ok(statusCode !== 403, `POST with valid CSRF token should not return 403 (got ${statusCode})`);
});
