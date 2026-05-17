#!/usr/bin/env node

/**
 * 跨平台健康检查
 * 用法：node scripts/health-check.js [base_url]
 * 默认: https://97.383636.xyz/code/20008
 * 输出：reports/health-latest.json
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const BASE = process.argv[2] || 'https://97.383636.xyz/code/20008';

async function main() {
  let health;
  try {
    const res = await fetch(`${BASE}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    health = await res.json();
  } catch (e) {
    health = { status: 'error', reason: `health endpoint unreachable: ${e.message}` };
  }

  const output = {
    generatedAt: new Date().toISOString(),
    status: 'ok',
    url: BASE,
    health,
  };

  const reportsDir = join(ROOT, 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  writeFileSync(join(reportsDir, 'health-latest.json'), JSON.stringify(output, null, 2));

  // 打印结果
  console.log('=== 健康检查 ===');
  console.log(`URL: ${BASE}/health`);
  console.log('');
  console.log(JSON.stringify(health, null, 2));
}

main();
