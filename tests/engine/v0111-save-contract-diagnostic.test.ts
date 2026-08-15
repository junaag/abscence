import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'vitest';

function partNumber(name: string): number {
  return Number(name.match(/(\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

function snippet(source: string, needle: string, radius = 360): string {
  const index = source.indexOf(needle);
  if (index < 0) return '';
  return source.slice(Math.max(0, index - radius), Math.min(source.length, index + needle.length + radius)).replace(/\s+/g, ' ');
}

describe('temporary v0.1.11 engine-state diagnostic', () => {
  it('exposes the exact historical freshState contract once', () => {
    const directory = 'v0111/engine-b64';
    const encoded = readdirSync(directory)
      .filter((name) => name.endsWith('.txt'))
      .sort((a, b) => partNumber(a) - partNumber(b))
      .map((name) => readFileSync(`${directory}/${name}`, 'utf8').trim())
      .join('');
    const source = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
    const context: Record<string, unknown> = {};
    runInNewContext(source, context, { timeout: 1000 });
    const engine = context.AbsenceEngine as { VERSION?: unknown; freshState?: () => unknown; ensureState?: (value: unknown) => unknown } | undefined;
    if (!engine?.freshState) throw new Error('V0111_ENGINE_EXPORT_MISSING=' + snippet(source, 'AbsenceEngine'));
    const freshState = engine.freshState();
    throw new Error('V0111_ENGINE_CONTRACT=' + JSON.stringify({
      version: engine.VERSION,
      apiKeys: Object.keys(engine).sort(),
      freshState,
      ensureStateSnippet: snippet(source, 'function ensureState'),
    }));
  });
});
