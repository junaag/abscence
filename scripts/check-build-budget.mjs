/* global console, process */
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ASSETS_DIR = 'dist/assets';
const BUDGETS = Object.freeze({
  '.js': 100 * 1024,
  '.css': 15 * 1024,
});

function gzipBytes(path) {
  return gzipSync(readFileSync(path), { level: 9 }).byteLength;
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
  const label = extension === '.js' ? 'JavaScript' : extension === '.css' ? 'CSS' : extension;
  console.log(`${label} gzip: ${kib.toFixed(2)} KiB / ${budgetKib.toFixed(0)} KiB budget`);
  if (bytes > budget) {
    failed = true;
    console.error(`${label} exceeds the ABSENCE mobile build budget by ${(kib - budgetKib).toFixed(2)} KiB.`);
  }
}

if (failed) process.exitCode = 1;
