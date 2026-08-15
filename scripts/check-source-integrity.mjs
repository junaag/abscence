/* global console, process */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

const ROOT = 'src';
const SOURCE_EXTENSIONS = new Set(['.ts', '.css', '.html']);
const FORBIDDEN = Object.freeze([
  { pattern: /\beval\s*\(/u, reason: 'runtime eval is forbidden' },
  { pattern: /DecompressionStream/u, reason: 'runtime decompression loaders are forbidden' },
  { pattern: /engine-b64/u, reason: 'historical base64 engine chunks must never be loaded by v0.2 runtime code' },
  { pattern: /\.gz\.b64/u, reason: 'compressed/base64 runtime patches are forbidden' },
]);
const ENGINE_FORBIDDEN = Object.freeze([
  { pattern: /\bMath\.random\s*\(/u, reason: 'engine randomness must use a seeded deterministic generator' },
  { pattern: /\bDate\.now\s*\(/u, reason: 'engine time must use the simulated game clock' },
  { pattern: /\bnew\s+Date\s*\(/u, reason: 'engine time must use the simulated game clock' },
  { pattern: /\bcrypto\.randomUUID\s*\(/u, reason: 'engine identifiers must be deterministic or state-sequenced' },
  { pattern: /\bsetTimeout\s*\(/u, reason: 'engine scheduling must use simulated-time boundaries' },
  { pattern: /\bsetInterval\s*\(/u, reason: 'engine scheduling must use simulated-time boundaries' },
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

function checkRules(path, source, rules) {
  let failed = false;
  for (const rule of rules) {
    const match = rule.pattern.exec(source);
    if (!match) continue;
    failed = true;
    console.error(`${relative('.', path)}:${lineNumber(source, match.index)}: ${rule.reason}`);
  }
  return failed;
}

let failed = false;
for (const path of sourceFiles(ROOT)) {
  const source = readFileSync(path, 'utf8');
  if (checkRules(path, source, FORBIDDEN)) failed = true;
  const normalized = path.split(sep).join('/');
  if (normalized.startsWith('src/engine/') && checkRules(path, source, ENGINE_FORBIDDEN)) failed = true;
}

if (failed) {
  console.error('ABSENCE source-integrity check failed. Keep v0.2 source readable, deterministic, static and build-time bundled.');
  process.exitCode = 1;
} else {
  console.log('ABSENCE source-integrity check passed.');
}
