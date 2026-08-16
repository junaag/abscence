import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { it } from 'vitest';

function partNumber(name: string): number {
  return Number(name.match(/(\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

it('diagnoses historical v0.1.11 item shape', () => {
  const directory = 'v0111/engine-b64';
  const encoded = readdirSync(directory)
    .filter((name) => name.endsWith('.txt'))
    .sort((a, b) => partNumber(a) - partNumber(b))
    .map((name) => readFileSync(`${directory}/${name}`, 'utf8').trim())
    .join('');
  const source = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
  const moduleRef: { exports: any } = { exports: {} };
  runInNewContext(source, { module: moduleRef }, { timeout: 1000 });
  const state = moduleRef.exports.createInitialState();
  const items = Object.fromEntries(Object.entries(state.items ?? {}).map(([id, raw]) => {
    const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    return [id, { name: item.name, definitionId: item.definitionId, type: item.type, state: item.state }];
  }));
  throw new Error(`LEGACY_ITEMS=${JSON.stringify(items)}`);
});
