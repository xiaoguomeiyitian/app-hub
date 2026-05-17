#!/usr/bin/env node

/**
 * 将各应用 dist/ 目录内容同步到 static/<appName>/ 下
 * 用法：node scripts/sync-static.js
 */

import { existsSync, readdirSync, mkdirSync, rmSync, cpSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const APPS_ROOT = join(ROOT, 'apps');
const STATIC_ROOT = join(ROOT, 'static');

const isWin = process.platform === 'win32';
const NOOP = (s) => s;
const c = {
  cyan:  isWin ? NOOP : (s) => `\x1b[1;36m${s}\x1b[0m`,
  green: isWin ? NOOP : (s) => `\x1b[1;32m${s}\x1b[0m`,
  red:   isWin ? NOOP : (s) => `\x1b[1;31m${s}\x1b[0m`,
  yellow:isWin ? NOOP : (s) => `\x1b[1;33m${s}\x1b[0m`,
};
const ok   = (s) => console.log(c.green('✓'), s);
const err  = (s) => console.log(c.red('✗'), s);
const warn = (s) => console.log(c.yellow('⚠'), s);
const log  = (s) => console.log(c.cyan('==>'), s);

// 确保 static 目录存在
if (!existsSync(STATIC_ROOT)) {
  mkdirSync(STATIC_ROOT, { recursive: true });
}

// 扫描所有应用
const categories = readdirSync(APPS_ROOT, { withFileTypes: true });
let copied = 0;
let skipped = 0;
let failed = 0;

for (const cat of categories) {
  if (!cat.isDirectory()) continue;
  const catDir = join(APPS_ROOT, cat.name);
  const apps = readdirSync(catDir, { withFileTypes: true });

  for (const app of apps) {
    if (!app.isDirectory()) continue;
    const appName = app.name;
    const distDir = join(catDir, appName, 'dist');
    const targetDir = join(STATIC_ROOT, appName);

    if (!existsSync(distDir)) {
      skipped++;
      continue;
    }

    try {
      // 删除旧目录，重新复制
      if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true, force: true });
      }
      cpSync(distDir, targetDir, { recursive: true });
      copied++;
      ok(`${appName}  (${cat.name})`);
    } catch (e) {
      failed++;
      err(`${appName}: ${e.message}`);
    }
  }
}

console.log();
log(`同步完成：复制 ${copied} 个，跳过 ${skipped} 个（无 dist），失败 ${failed} 个`);
