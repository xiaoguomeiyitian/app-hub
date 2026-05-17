#!/usr/bin/env node

/**
 * 跨平台端口占用检查
 * 用法：node scripts/check-port.js
 * 输出：reports/ports-latest.json
 */

import { createConnection } from 'net';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PORTS = [20000, 20001, 20002, 20003, 20004, 20005, 20006, 20007, 20008, 20009];

function checkPort(port, host = '127.0.0.1', timeout = 300) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host, timeout });
    socket.on('connect', () => {
      socket.destroy();
      resolve('open');
    });
    socket.on('error', () => {
      resolve('free');
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve('free');
    });
  });
}

async function main() {
  const results = [];
  for (const port of PORTS) {
    const state = await checkPort(port);
    results.push({ port, state });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    status: 'ok',
    ports: results,
  };

  const reportsDir = join(ROOT, 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const outFile = join(reportsDir, 'ports-latest.json');
  writeFileSync(outFile, JSON.stringify(output, null, 2));

  // 打印结果
  console.log(JSON.stringify(output, null, 2));
}

main();
