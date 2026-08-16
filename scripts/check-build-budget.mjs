/* global console, process */
import { gzipSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST_DIR = 'dist';
const ASSETS_DIR = join(DIST_DIR, 'assets');
const BUDGETS = Object.freeze({
  '.js': 100 * 1024,
  '.css': 15 * 1024,
});
const STARTUP_JS_BUDGET = 35 * 1024;

function gzipBytes(path) {
  return gzipSync(readFileSync(path), { level: 9 }).byteLength;
}

function startupJavaScriptFiles() {
  const html = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');
  const references = new Set();
  const matcher = /(?:src|href)=["']([^"']+\.js(?:\?[^"']*)?)["']/gu;
  for (const match of html.matchAll(matcher)) {
    const reference = match[1]?.split('?')[0];
    if (!reference) continue;
    const relative = reference.replace(/^\.?\//u, '').replace(/^\//u, '');
    const path = join(DIST_DIR, relative);
    if (existsSync(path)) references.add(path);
  }
  return [...references];
}

const totals = new Map(Object.keys(BUDGETS).map((extension) => [extension, 0]));
const files = readdirSync(ASSETS_DIR).sort();

for (const file of files) {
  const extension = extname(file);
  if (!totals.has(extension)) continue;
  totals.set(extension, totals.get(extension) + gzipBytes(join(ASSETS_DIR, file)));
}

let failed = false;
for (const [extension, budget] of Object.entries(BUDGETS)) {
  const bytes = totals.get(extension) ?? 0;
  const kib = bytes / 1024;
  const budgetKib = budget / 1024;
  const label = extension === '.js' ? 'JavaScript total' : extension === '.css' ? 'CSS' : extension;
  console.log(`${label} gzip: ${kib.toFixed(2)} KiB / ${budgetKib.toFixed(0)} KiB budget`);
  if (bytes > budget) {
    failed = true;
    console.error(`${label} exceeds the ABSENCE mobile build budget by ${(kib - budgetKib).toFixed(2)} KiB.`);
  }
}

const startupFiles = startupJavaScriptFiles();
const startupBytes = startupFiles.reduce((sum, path) => sum + gzipBytes(path), 0);
const startupKib = startupBytes / 1024;
const startupBudgetKib = STARTUP_JS_BUDGET / 1024;
console.log(`JavaScript startup gzip: ${startupKib.toFixed(2)} KiB / ${startupBudgetKib.toFixed(0)} KiB budget`);
if (startupFiles.length === 0) {
  failed = true;
  console.error('No startup JavaScript asset was discovered from dist/index.html.');
} else if (startupBytes > STARTUP_JS_BUDGET) {
  failed = true;
  console.error(`JavaScript startup exceeds the ABSENCE mobile budget by ${(startupKib - startupBudgetKib).toFixed(2)} KiB.`);
}

if (failed) process.exitCode = 1;
