/* global console, process */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = 'src';
const SOURCE_EXTENSIONS = new Set(['.ts', '.css', '.html']);
const FORBIDDEN = Object.freeze([
  { pattern: /\beval\s*\(/u, reason: 'runtime eval is forbidden' },
  { pattern: /DecompressionStream/u, reason: 'runtime decompression loaders are forbidden' },
  { pattern: /engine-b64/u, reason: 'historical base64 engine chunks must never be loaded by v0.2 runtime code' },
  { pattern: /\.gz\.b64/u, reason: 'compressed/base64 runtime patches are forbidden' },
]);

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory).sort()) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...sourceFiles(path));
    else if (SOURCE_EXTENSIONS.has(extname(path))) files.push(path);
  }
  return files;
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

let failed = false;
for (const path of sourceFiles(ROOT)) {
  const source = readFileSync(path, 'utf8');
  for (const rule of FORBIDDEN) {
    const match = rule.pattern.exec(source);
    if (!match) continue;
    failed = true;
    console.error(`${relative('.', path)}:${lineNumber(source, match.index)}: ${rule.reason}`);
  }
}

if (failed) {
  console.error('ABSENCE source-integrity check failed. Keep v0.2 source readable, static and build-time bundled.');
  process.exitCode = 1;
} else {
  console.log('ABSENCE source-integrity check passed.');
}
