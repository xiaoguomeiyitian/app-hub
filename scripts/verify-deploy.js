#!/usr/bin/env node

/**
 * 跨平台部署验证：检查项目 HTML/JS/CSS 是否可正常访问
 * 用法：node scripts/verify-deploy.js [base_url] [project_name]
 * 默认: https://97.383636.xyz/code/20008 app-lobby
 * 输出：reports/deploy/<project>.json
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const BASE = process.argv[2] || 'https://97.383636.xyz/code/20008';
const PROJECT = process.argv[3] || 'app-lobby';

async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const htmlUrl = `${BASE}/${PROJECT}/`;
  const htmlRes = await fetchWithTimeout(htmlUrl);

  const htmlCode = htmlRes ? htmlRes.status : 0;
  let htmlBody = '';
  if (htmlRes) {
    htmlBody = await htmlRes.text();
  }

  // 从 HTML 中提取 JS 和 CSS 路径
  const jsMatch = htmlBody.match(/(?:src|href)="([^"]+\.js)"/);
  const cssMatch = htmlBody.match(/href="([^"]+\.css)"/);

  const jsPath = jsMatch ? jsMatch[1] : null;
  const cssPath = cssMatch ? cssMatch[1] : null;

  let jsCode = 404;
  let cssCode = 404;

  if (jsPath) {
    const jsRes = await fetchWithTimeout(`${BASE}${jsPath}`);
    jsCode = jsRes ? jsRes.status : 0;
  }

  if (cssPath) {
    const cssRes = await fetchWithTimeout(`${BASE}${cssPath}`);
    cssCode = cssRes ? cssRes.status : 0;
  }

  const allOk = htmlCode === 200 && jsCode === 200 && cssCode === 200;
  const status = allOk ? 'ok' : 'error';
  const failReason = allOk
    ? ''
    : `html=${htmlCode} js=${jsCode} css=${cssCode} jsPath=${jsPath || 'missing'} cssPath=${cssPath || 'missing'}`;

  const output = {
    generatedAt: new Date().toISOString(),
    status,
    project: PROJECT,
    htmlHttp: htmlCode,
    jsHttp: jsCode,
    cssHttp: cssCode,
    jsPath: jsPath || '',
    cssPath: cssPath || '',
    failReason,
  };

  const deployDir = join(ROOT, 'reports', 'deploy');
  if (!existsSync(deployDir)) {
    mkdirSync(deployDir, { recursive: true });
  }

  writeFileSync(join(deployDir, `${PROJECT}.json`), JSON.stringify(output, null, 2));

  // 打印结果
  console.log(`=== 部署验证: ${PROJECT} ===`);
  console.log(`  HTML: ${htmlCode}`);
  console.log(`  JS:   ${jsCode} (${jsPath || 'missing'})`);
  console.log(`  CSS:  ${cssCode} (${cssPath || 'missing'})`);
  console.log(`  状态: ${status}`);
  if (failReason) {
    console.log(`  原因: ${failReason}`);
  }
}

main();
