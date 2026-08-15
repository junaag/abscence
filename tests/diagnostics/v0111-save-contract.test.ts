/* eslint-disable no-console */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

function snippets(source: string, needle: string, radius = 180): string[] {
  const results: string[] = [];
  let cursor = 0;
  while (results.length < 12) {
    const index = source.indexOf(needle, cursor);
    if (index < 0) break;
    results.push(source.slice(Math.max(0, index - radius), Math.min(source.length, index + needle.length + radius)).replace(/\s+/g, ' '));
    cursor = index + needle.length;
  }
  return results;
}

describe('v0.1.11 compressed save contract diagnostic', () => {
  it('prints the exact historical storage contract for the controlled migrator', () => {
    const encoded = readFileSync('v0111/app-v0111.js.gz.b64', 'utf8').trim();
    const source = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
    const absenceStrings = [...source.matchAll(/["'`](absence[^"'`\\]{1,80})["'`]/gi)].map((match) => match[1]);
    const uniqueAbsenceStrings = [...new Set(absenceStrings)].sort();
    console.log('V0111_ABSENCE_STRINGS=' + JSON.stringify(uniqueAbsenceStrings));
    console.log('V0111_LOCALSTORAGE_SNIPPETS=' + JSON.stringify(snippets(source, 'localStorage')));
    console.log('V0111_SAVE_SNIPPETS=' + JSON.stringify(snippets(source, 'save')));
    expect(source.length).toBeGreaterThan(1000);
  });
});
