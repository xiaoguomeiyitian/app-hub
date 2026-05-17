#!/usr/bin/env node

/**
 * app-hub 跨平台初始化脚本
 * 功能：清理 git 忽略目录 → 安装所有依赖 → 构建 → 启动
 * 用法：node scripts/init.js [--skip-clean] [--skip-build] [--only-core]
 */

import { spawnSync, execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, rmSync, mkdirSync, statSync } from 'fs';
import { join, basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------- ANSI 颜色 ----------
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

function npmInstall(dir, label) {
  log(`安装依赖: ${label}`);
  if (exec('npm install --ignore-scripts', dir, false)) {
    ok(`依赖安装完成: ${label}`);
    return true;
  } else {
    err(`依赖安装失败: ${label}`);
    return false;
  }
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
          projects.push({ dir: projDir, name: proj });
        }
      }
    } catch { /* skip */ }
  }
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

function removeDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    return true;
  }
  return false;
}

function findAndRemove(root, name) {
  // 递归查找并删除指定名称的目录（最多 4 层）
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch { continue; }

    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === name) {
          rmSync(full, { recursive: true, force: true });
        } else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          // 限制深度：计算相对于 root 的层级
          const rel = full.replace(root, '').split(/[\\/]/).filter(Boolean).length;
          if (rel < 4) {
            stack.push(full);
          }
        }
      }
    }
  }
}

function findAndDeleteFiles(root, pattern, maxDepth = 3) {
  const stack = [{ path: root, depth: 0 }];
  while (stack.length > 0) {
    const { path: current, depth } = stack.pop();
    if (depth > maxDepth) continue;
    let entries;
    try {
      entries = readdirSync(current).map(name => ({
        name,
        isDirectory: () => statSync(join(current, name)).isDirectory(),
      }));
    } catch { continue; }

    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          stack.push({ path: full, depth: depth + 1 });
        }
      } else if (pattern.test(entry.name)) {
        rmSync(full, { force: true });
      }
    }
  }
}

// ---------- 参数解析 ----------
const args = process.argv.slice(2);
let SKIP_CLEAN = false;
let SKIP_BUILD = false;
let ONLY_CORE = false;

for (const arg of args) {
  switch (arg) {
    case '--skip-clean': SKIP_CLEAN = true; break;
    case '--skip-build': SKIP_BUILD = true; break;
    case '--only-core':  ONLY_CORE = true; break;
    case '--help':
    case '-h':
      console.log('用法: node scripts/init.js [选项]');
      console.log('');
      console.log('选项:');
      console.log('  --skip-clean  跳过清理 git 忽略目录');
      console.log('  --skip-build  跳过构建步骤');
      console.log('  --only-core   仅初始化核心服务（hub-server + lobby-web + packages）');
      console.log('  --help, -h    显示帮助');
      process.exit(0);
      break;
    default:
      console.log(`未知参数: ${arg}`);
      console.log('使用 --help 查看帮助');
      process.exit(1);
  }
}

// ============================================================
// Step 1: 清理 git 忽略目录
// ============================================================
if (!SKIP_CLEAN) {
  log('Step 1: 清理 git 忽略目录...');

  const cleanTargets = ['static', 'data', 'reports'];
  for (const target of cleanTargets) {
    if (removeDir(join(ROOT, target))) {
      ok(`已清理: ${target}/`);
    }
  }

  // 清理所有子项目的 node_modules 和 dist
  log('清理子项目 node_modules 和 dist...');
  const cleanRoots = ['apps', 'packages', 'lobby-web', 'hub-server'];
  for (const cr of cleanRoots) {
    const rootDir = join(ROOT, cr);
    if (existsSync(rootDir)) {
      findAndRemove(rootDir, 'node_modules');
      findAndRemove(rootDir, 'dist');
    }
  }

  // 清理数据库和日志文件
  findAndDeleteFiles(ROOT, /\.db$/, 3);
  findAndDeleteFiles(ROOT, /\.log$/, 3);
  findAndDeleteFiles(ROOT, /-shm$/, 3);
  findAndDeleteFiles(ROOT, /-wal$/, 3);

  ok('清理完成');
} else {
  log('Step 1: 跳过清理（--skip-clean）');
}

// ============================================================
// Step 2: 安装核心依赖
// ============================================================
log('Step 2: 安装核心依赖...');

// 根目录
if (existsSync(join(ROOT, 'package.json'))) {
  npmInstall(ROOT, '根目录');
}

// hub-server
if (existsSync(join(ROOT, 'hub-server', 'package.json'))) {
  npmInstall(join(ROOT, 'hub-server'), 'hub-server');
}

// lobby-web
if (existsSync(join(ROOT, 'lobby-web', 'package.json'))) {
  npmInstall(join(ROOT, 'lobby-web'), 'lobby-web');
}

// packages
const packagesDir = join(ROOT, 'packages');
if (existsSync(packagesDir)) {
  for (const name of readdirSync(packagesDir)) {
    const pkgDir = join(packagesDir, name);
    if (existsSync(join(pkgDir, 'package.json'))) {
      npmInstall(pkgDir, name);
    }
  }
}

// ============================================================
// Step 3: 安装子项目依赖
// ============================================================
if (!ONLY_CORE) {
  log('Step 3: 安装子项目依赖...');
  const projects = getProjects();
  const total = projects.length;
  let current = 0;
  const failedList = [];

  for (const proj of projects) {
    current++;
    process.stdout.write(`  [${String(current).padStart(3)}/${String(total).padStart(3)}] ${proj.name}\n`);
    if (!exec('npm install --ignore-scripts', proj.dir, false)) {
      failedList.push(proj.name);
      err(`安装失败: ${proj.name}`);
    }
  }

  if (failedList.length > 0) {
    warn('以下项目依赖安装失败:');
    for (const f of failedList) console.log(`    ${f}`);
  } else {
    ok(`全部 ${total} 个子项目依赖安装完成`);
  }
} else {
  log('Step 3: 跳过子项目（--only-core）');
}

// ============================================================
// Step 4: 构建
// ============================================================
if (!SKIP_BUILD) {
  log('Step 4: 构建核心服务...');

  // 构建 hub-server
  if (existsSync(join(ROOT, 'hub-server'))) {
    log('构建 hub-server...');
    if (exec('npm run build', join(ROOT, 'hub-server'), false)) {
      ok('hub-server 构建完成');
    } else {
      err('hub-server 构建失败');
    }
  }

  // 构建 packages
  if (existsSync(packagesDir)) {
    for (const name of readdirSync(packagesDir)) {
      const pkgDir = join(packagesDir, name);
      const pkgJson = join(pkgDir, 'package.json');
      if (existsSync(pkgJson) && hasBuildScript(pkgJson)) {
        log(`构建 ${name}...`);
        if (exec('npm run build', pkgDir, true)) {
          ok(`${name} 构建完成`);
        } else {
          warn(`${name} 构建跳过（无构建脚本或构建失败）`);
        }
      }
    }
  }

  // 构建子项目
  if (!ONLY_CORE) {
    log('构建子项目...');
    const projects = getProjects();
    let buildTotal = 0;
    let buildPassed = 0;
    const buildFailed = [];

    for (const proj of projects) {
      buildTotal++;
      if (exec('npm run build', proj.dir, true)) {
        buildPassed++;
      } else {
        buildFailed.push(proj.name);
      }
    }

    ok(`子项目构建: ${buildPassed}/${buildTotal} 成功`);
    if (buildFailed.length > 0) {
      warn('构建失败项目:');
      for (const f of buildFailed) console.log(`    ${f}`);
    }
  }
} else {
  log('Step 4: 跳过构建（--skip-build）');
}

// ============================================================
// Step 5: 启动
// ============================================================
log('Step 5: 启动服务...');

// 确保数据目录存在
mkdirSync(join(ROOT, 'data'), { recursive: true });

log('启动 hub-server...');
log('访问地址: https://97.383636.xyz/code/20008/');
log('健康检查: https://97.383636.xyz/code/20008/health');
log('');
log('按 Ctrl+C 停止服务');
log('');

// 使用 spawn 替代 exec，保持 stdio 继承
const child = spawnSync('npm', ['start'], {
  cwd: join(ROOT, 'hub-server'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});
process.exit(child.status ?? 0);
