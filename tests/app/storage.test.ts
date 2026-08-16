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
    inventory: ['phone_01', 'water_bottle_01'],
    items: {
      phone_01: { id: 'phone_01', definitionId: 'smartphone', locationId: 'inventory', state: { batteryPct: 61 } },
      water_bottle_01: { id: 'water_bottle_01', definitionId: 'water_bottle_500', locationId: 'inventory', state: { liquidMl: 125, capacityMl: 500 } },
    },
    world: { powerAvailable: true, waterNetworkAvailable: true, effects: [] },
  };
}

describe('browser persistence migration', () => {
  it('atomically persists a valid v0.1.11 candidate into the v0.2 key on first load', () => {
    const storage = new MemoryStorage();
    storage.setItem('absence-preview-v0111', JSON.stringify(recognizableLegacyState()));

    const state = createBrowserPersistence(storage).load();
    expect(state.player.healthPv).toBe(73);
    expect(state.player.locationId).toBe('kitchen');
    expect(state.items.water_01?.liquidMl).toBe(125);

    const persisted = JSON.parse(storage.getItem(SAVE_KEY) ?? 'null') as { gameVersion?: string; player?: { healthPv?: number } } | null;
    expect(persisted?.gameVersion).toBe('0.2.0-dev');
    expect(persisted?.player?.healthPv).toBe(73);
    expect(storage.getItem('absence-preview-v0111')).not.toBeNull();
  });

  it('does not promote corrupt historical data into the v0.2 save key', () => {
    const storage = new MemoryStorage();
    storage.setItem('absence-preview-v0111', '{broken');
    const state = createBrowserPersistence(storage).load();
    expect(state.player.healthPv).toBe(100);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it('never replaces an existing v0.2 save with a historical candidate', () => {
    const storage = new MemoryStorage();
    const persistence = createBrowserPersistence(storage);
    const initial = persistence.load();
    initial.player.healthPv = 64;
    persistence.save(initial);
    storage.setItem('absence-preview-v0111', JSON.stringify(recognizableLegacyState(22)));

    expect(persistence.load().player.healthPv).toBe(64);
  });
});
