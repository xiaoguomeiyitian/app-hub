#!/usr/bin/env node

/**
 * app-hub 跨平台构建脚本
 * 功能：安装依赖 + 构建所有子项目（或抽样构建）
 * 用法：node scripts/build-all.js [sample N]
 *  默认：构建所有项目
 *  示例：node scripts/build-all.js sample 10  （抽样10个）
 */

import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'fs';
import { join, basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------- ANSI 颜色（Windows CMD 不支持，检测后禁用） ----------
const isWin = process.platform === 'win32';
const NOOP = (s) => s;
const c = {
  cyan:   isWin ? NOOP : (s) => `\x1b[1;36m${s}\x1b[0m`,
  yellow: isWin ? NOOP : (s) => `\x1b[1;33m${s}\x1b[0m`,
  red:    isWin ? NOOP : (s) => `\x1b[1;31m${s}\x1b[0m`,
  green:  isWin ? NOOP : (s) => `\x1b[1;32m${s}\x1b[0m`,
};
const warn = (s) => console.log(c.yellow('⚠'), s);
const err  = (s) => console.log(c.red('✗'), s);
const ok   = (s) => console.log(c.green('✓'), s);
const log  = (s) => console.log(c.cyan('==>'), s);

// ---------- 工具函数 ----------
function exec(cmd, cwd, silent = false) {
  const result = spawnSync(cmd, {
    cwd,
    shell: true,
    stdio: silent ? 'pipe' : 'inherit',
    env: { ...process.env },
  });
  return result.status === 0;
}

function hasBuildScript(pkgJsonPath) {
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    return !!(pkg.scripts && pkg.scripts.build);
  } catch {
    return false;
  }
}

function getProjects() {
  const appsDir = join(ROOT, 'apps');
  const projects = [];
  for (const category of readdirSync(appsDir)) {
    const catDir = join(appsDir, category);
    try {
      for (const proj of readdirSync(catDir)) {
        const projDir = join(catDir, proj);
        const pkgJson = join(projDir, 'package.json');
        if (existsSync(pkgJson)) {
          projects.push({ dir: projDir, name: proj, category });
        }
      }
    } catch { /* skip non-directories */ }
  }
  return projects;
}

// ---------- 参数解析 ----------
const args = process.argv.slice(2);
let sampleCount = null;
if (args[0] === 'sample' && args[1]) {
  sampleCount = parseInt(args[1], 10);
}

// ---------- 主流程 ----------
console.log('========================================');
console.log(`  app-hub 构建${sampleCount ? ` (抽样 ${sampleCount} 个)` : ' (全部)'}`);
console.log('========================================');
console.log();

// 1. 安装核心依赖
log('安装核心依赖...');
const coreDirs = ['hub-server', 'lobby-web'];
for (const name of readdirSync(join(ROOT, 'packages'))) {
  coreDirs.push(`packages/${name}`);
}

for (const dir of coreDirs) {
  const pkgJson = join(ROOT, dir, 'package.json');
  if (!existsSync(pkgJson)) continue;
  const label = basename(dir);
  process.stdout.write(`  安装 ${label}...`.padEnd(30));
  if (exec('npm install --ignore-scripts', join(ROOT, dir), true)) {
    ok('完成');
  } else {
    err(`失败: ${label}`);
  }
}

console.log();

// 2. 获取项目列表
let projects = getProjects();
if (sampleCount !== null && sampleCount < projects.length) {
  // Fisher-Yates 洗牌后取前 N 个
  for (let i = projects.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [projects[i], projects[j]] = [projects[j], projects[i]];
  }
  projects = projects.slice(0, sampleCount);
}

// 按名称排序
projects.sort((a, b) => a.name.localeCompare(b.name));

console.log(`开始构建 ${projects.length} 个子项目...`);
console.log();

let total = 0;
let passed = 0;
const failed = [];

for (const proj of projects) {
  total++;
  process.stdout.write(`[${String(total).padStart(3)}/${String(projects.length).padStart(3)}] ${proj.name.padEnd(30)}`);

  // 安装依赖
  if (!exec('npm install --ignore-scripts', proj.dir, true)) {
    err('依赖安装失败');
    failed.push(`${proj.name} (依赖安装失败)`);
    continue;
  }

  // 检查是否有构建脚本
  if (!hasBuildScript(join(proj.dir, 'package.json'))) {
    console.log('  (跳过，无构建脚本)');
    passed++;
    continue;
  }

  // 构建
  if (exec('npm run build', proj.dir, true)) {
    passed++;
    const distDir = join(proj.dir, 'dist');
    if (!existsSync(distDir)) {
      console.log('  ⚠ dist/ 目录不存在');
    } else {
      try {
        const files = readdirSync(distDir);
        if (files.length === 0) {
          console.log('  ⚠ dist/ 为空');
        } else {
          console.log('  ✓');
        }
      } catch {
        console.log('  ✓');
      }
    }
  } else {
    err('构建失败');
    failed.push(proj.name);
  }
}

// ---------- 汇总 ----------
console.log();
console.log('========================================');
console.log('  构建汇总');
console.log('========================================');
console.log(`  总计:   ${total}`);
console.log(`  成功:   ${passed}`);
console.log(`  失败:   ${failed.length}`);

if (failed.length > 0) {
  console.log();
  console.log('  失败项目:');
  for (const f of failed) {
    console.log(`    ${f}`);
  }
  process.exit(1);
}

console.log();
ok('全部构建完成！');
