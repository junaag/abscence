import { describe, expect, it } from 'vitest';
import { loadState, saveState } from '../../src/engine/persistence';
import { createInitialState } from '../../src/engine/state';
import { GAME_VERSION, SAVE_SCHEMA_VERSION } from '../../src/version';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (...args: string[]) => { value = args[1] ?? null; },
    read: () => value,
  };
}

describe('versioned persistence', () => {
  it('round-trips a valid state through an injected storage adapter', () => {
    const storage = memoryStorage();
    const state = createInitialState();
    saveState(state, storage);
    const saved = storage.read();
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved ?? '{}')).toMatchObject({ gameVersion: GAME_VERSION, schemaVersion: SAVE_SCHEMA_VERSION });
    expect(loadState(storage)).toEqual(state);
  });

  it('loads a compatible save schema even when the historical game version label differs', () => {
    const previous = createInitialState();
    previous.gameVersion = '0.2.0-dev-older-label';
    previous.player.healthPv = 77;
    const loaded = loadState(memoryStorage(JSON.stringify(previous)));
    expect(loaded.player.healthPv).toBe(77);
    expect(loaded.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.gameVersion).toBe(GAME_VERSION);
  });

  it('rejects an unsupported future save schema until an explicit migrator exists', () => {
    const unsupported = createInitialState() as ReturnType<typeof createInitialState> & { schemaVersion: number };
    unsupported.schemaVersion = SAVE_SCHEMA_VERSION + 1;
    unsupported.player.healthPv = 55;
    expect(loadState(memoryStorage(JSON.stringify(unsupported)))).toEqual(createInitialState());
  });

  it('writes the current version without mutating an in-memory compatible state', () => {
    const storage = memoryStorage();
    const state = createInitialState();
    state.gameVersion = 'compatible-old-label';
    saveState(state, storage);
    expect(state.gameVersion).toBe('compatible-old-label');
    expect(JSON.parse(storage.read() ?? '{}').gameVersion).toBe(GAME_VERSION);
  });

  it('rejects a structurally inconsistent save', () => {
    const corrupt = createInitialState();
    corrupt.player.inventoryIds.push('apple_01');
    const storage = memoryStorage(JSON.stringify(corrupt));
    const loaded = loadState(storage);
    expect(loaded).toEqual(createInitialState());
  });

  it('refuses to persist an inconsistent state', () => {
    const state = createInitialState();
    state.player.inventoryIds.push('apple_01');
    const storage = memoryStorage();
    expect(() => saveState(state, storage)).toThrow(/Invalid ABSENCE game state/);
  });
});
