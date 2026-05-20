#!/usr/bin/env node

/**
 * 构建所有应用项目（跳过无 build 脚本的）
 * 用法：node scripts/build-all-apps.js
 */

import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync, cpSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const APPS_ROOT = join(ROOT, 'apps');
const STATIC_ROOT = join(ROOT, 'static');

const isWin = process.platform === 'win32';
const NOOP = (s) => s;
const c = {
  cyan:   isWin ? NOOP : (s) => `\x1b[1;36m${s}\x1b[0m`,
  green:  isWin ? NOOP : (s) => `\x1b[1;32m${s}\x1b[0m`,
  red:    isWin ? NOOP : (s) => `\x1b[1;31m${s}\x1b[0m`,
  yellow: isWin ? NOOP : (s) => `\x1b[1;33m${s}\x1b[0m`,
};
const ok   = (s) => console.log(c.green('✓'), s);
const err  = (s) => console.log(c.red('✗'), s);
const warn = (s) => console.log(c.yellow('⚠'), s);
const log  = (s) => console.log(c.cyan('==>'), s);

function exec(cmd, cwd, silent = true) {
  const result = spawnSync(cmd, {
    cwd,
    shell: true,
    stdio: silent ? 'pipe' : 'inherit',
    env: { ...process.env },
    timeout: 120000,
  });
  return result.status === 0;
}

function hasBuildScript(pkgJsonPath) {
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    return !!(pkg.scripts && pkg.scripts.build);
  } catch { return false; }
}

// 扫描所有应用
const projects = [];
const categories = readdirSync(APPS_ROOT, { withFileTypes: true });
for (const cat of categories) {
  if (!cat.isDirectory()) continue;
  const catDir = join(APPS_ROOT, cat.name);
  try {
    const apps = readdirSync(catDir, { withFileTypes: true });
    for (const app of apps) {
      if (!app.isDirectory()) continue;
      const projDir = join(catDir, app.name);
      const pkgJson = join(projDir, 'package.json');
      if (existsSync(pkgJson)) {
        projects.push({ dir: projDir, name: app.name, category: cat.name, pkgJson });
      }
    }
  } catch { /* skip */ }
}

projects.sort((a, b) => a.name.localeCompare(b.name));

console.log('========================================');
console.log(`  构建所有应用 (${projects.length} 个)`);
console.log('========================================\n');

let built = 0, skipped = 0, failed = 0;
const failedList = [];

for (let i = 0; i < projects.length; i++) {
  const proj = projects[i];
  const idx = `[${String(i + 1).padStart(3)}/${String(projects.length).padStart(3)}]`;

  if (!hasBuildScript(proj.pkgJson)) {
    skipped++;
    continue;
  }

  process.stdout.write(`${idx} ${proj.name.padEnd(30)}`);

  // 安装依赖（如果 node_modules 不存在）
  if (!existsSync(join(proj.dir, 'node_modules'))) {
    if (!exec('npm install --ignore-scripts', proj.dir)) {
      err(`${proj.name}: 依赖安装失败`);
      failed++;
      failedList.push(proj.name);
      continue;
    }
  }

  // 构建：先尝试 npm run build，失败则尝试直接 vite build（跳过 tsc）
  let buildOk = exec('npm run build', proj.dir);
  if (!buildOk) {
    // 尝试只用 vite build（跳过 TypeScript 类型检查）
    buildOk = exec('npx vite build', proj.dir);
    if (buildOk) {
      warn(`${proj.name}: 使用 vite build 跳过 tsc 成功`);
    }
  }
  if (buildOk) {
    const distDir = join(proj.dir, 'dist');
    if (existsSync(distDir)) {
      const targetDir = join(STATIC_ROOT, proj.name);
      try {
        if (existsSync(targetDir)) rmSync(targetDir, { recursive: true, force: true });
        mkdirSync(targetDir, { recursive: true });
        // 复制 dist/ 目录下的内容到 static/<app>/，而非 dist 目录本身
        const entries = readdirSync(distDir, { withFileTypes: true });
        for (const entry of entries) {
          cpSync(join(distDir, entry.name), join(targetDir, entry.name), { recursive: true });
        }
        built++;
        ok(`构建成功 → static/${proj.name}/`);
      } catch (e) {
        err(`${proj.name}: 复制失败 - ${e.message}`);
        failed++;
        failedList.push(proj.name);
      }
    } else {
      warn(`${proj.name}: 构建成功但 dist/ 不存在`);
      skipped++;
    }
  } else {
    err(`${proj.name}: 构建失败`);
    failed++;
    failedList.push(proj.name);
  }
}

console.log();
log(`完成：构建 ${built} 个，跳过 ${skipped} 个，失败 ${failed} 个`);
if (failedList.length > 0) {
  console.log('  失败列表:', failedList.join(', '));
}
