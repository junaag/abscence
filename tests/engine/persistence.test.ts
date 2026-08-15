import { describe, expect, it } from 'vitest';
import { loadState, saveState } from '../../src/engine/persistence';
import { createInitialState } from '../../src/engine/state';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: (_key: string) => value,
    setItem: (_key: string, next: string) => { value = next; },
    read: () => value,
  };
}

describe('versioned persistence', () => {
  it('round-trips a valid state', () => {
    const storage = memoryStorage();
    const state = createInitialState();
    saveState(state, storage);
    const saved = storage.read();
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved ?? '{}').gameVersion).toBe('0.2.0-dev');
    expect(loadState(storage)).toEqual(state);
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
