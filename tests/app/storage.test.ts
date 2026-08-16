import { describe, expect, it } from 'vitest';
import { createBrowserPersistence } from '../../src/app/storage';
import { SAVE_KEY } from '../../src/engine';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

function recognizableLegacyState(health = 73) {
  return {
    time: { h: 8, m: 5, s: 0 },
    gameDate: { year: 2026, month: 8, day: 9 },
    locationId: 'kitchen',
    stats: { health, hunger: 31, thirst: 42, fatigue: 27, stress: 35, pain: 4 },
    inventory: ['phone_01'],
    items: { phone_01: { id: 'phone_01', definitionId: 'smartphone', locationId: 'inventory', state: { batteryPct: 61 } } },
  };
}

describe('browser persistence for revised prologue', () => {
  it('ignores historical preview saves so the next playtest starts from the bed', () => {
    const storage = new MemoryStorage();
    storage.setItem('absence-preview-v0111', JSON.stringify(recognizableLegacyState()));
    storage.setItem('absence-v020-dev', JSON.stringify({ old: true }));

    const state = createBrowserPersistence(storage).load();
    expect(state.player.healthPv).toBe(100);
    expect(state.player.locationId).toBe('bedroom');
    expect(state.player.inventoryIds).toEqual([]);
    expect(state.items.phone_01?.location).toEqual({ kind: 'location', id: 'bedroom' });
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it('persists and reloads progress only through the new prologue key', () => {
    const storage = new MemoryStorage();
    const persistence = createBrowserPersistence(storage);
    const initial = persistence.load();
    initial.player.healthPv = 64;
    persistence.save(initial);

    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    expect(persistence.load().player.healthPv).toBe(64);
  });

  it('falls back to a fresh prologue when the new save is corrupt', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{broken');
    const state = createBrowserPersistence(storage).load();
    expect(state.player.locationId).toBe('bedroom');
    expect(state.player.inventoryIds).toEqual([]);
  });
});
