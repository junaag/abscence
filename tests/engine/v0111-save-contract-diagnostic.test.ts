import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, it } from 'vitest';

function snippet(source: string, needle: string, radius = 260): string {
  const index = source.indexOf(needle);
  if (index < 0) return '';
  return source.slice(Math.max(0, index - radius), Math.min(source.length, index + needle.length + radius)).replace(/\s+/g, ' ');
}

describe('temporary v0.1.11 save contract diagnostic', () => {
  it('exposes historical save storage details', () => {
    const encoded = readFileSync('v0111/app-v0111.js.gz.b64', 'utf8').trim();
    const source = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
    const storageKeys = [...new Set([...source.matchAll(/["'`]([^"'`\\]{0,30}absence[^"'`\\]{0,50})["'`]/gi)].map((match) => match[1]))].sort();
    throw new Error('V0111_SAVE_CONTRACT=' + JSON.stringify({
      storageKeys,
      localStorage: snippet(source, 'localStorage'),
      previewKey: snippet(source, 'absence-preview-v019'),
      devKey: snippet(source, 'absence-v0111'),
    }));
  });
});
