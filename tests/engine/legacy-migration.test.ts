import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { validateState } from '../../src/engine/invariants';
import { LEGACY_PREVIEW_SAVE_KEYS, loadLegacyPreviewMigration, migrateLegacyPreviewState } from '../../src/engine/legacy-migration';
import { loadState, SAVE_KEY } from '../../src/engine/persistence';
import { createInitialState } from '../../src/engine/state';
import type { GameState } from '../../src/engine/model';

interface HistoricalEngine {
  VERSION: string;
  createInitialState(): Record<string, unknown>;
  ensureState(state: unknown): unknown;
}

function partNumber(name: string): number {
  return Number(name.match(/(\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

function loadHistoricalEngine(): HistoricalEngine {
  const directory = 'v0111/engine-b64';
  const encoded = readdirSync(directory)
    .filter((name) => name.endsWith('.txt'))
    .sort((a, b) => partNumber(a) - partNumber(b))
    .map((name) => readFileSync(`${directory}/${name}`, 'utf8').trim())
    .join('');
  const source = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
  const moduleRef: { exports: unknown } = { exports: {} };
  runInNewContext(source, { module: moduleRef }, { timeout: 1000 });
  return moduleRef.exports as HistoricalEngine;
}

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected historical object');
  return value as Record<string, unknown>;
}

function historicalStats(state: Record<string, unknown>): Record<string, unknown> {
  if (state.stats && typeof state.stats === 'object') return object(state.stats);
  const player = object(state.player);
  return object(player.stats ?? player.needs);
}

function historicalInventory(state: Record<string, unknown>): unknown[] {
  if (Array.isArray(state.inventory)) return state.inventory;
  const player = object(state.player);
  if (Array.isArray(player.inventoryIds)) return player.inventoryIds;
  if (Array.isArray(player.inventory)) return player.inventory;
  throw new Error('Historical inventory not found');
}

function historicalWorld(state: Record<string, unknown>): Record<string, unknown> {
  return object(state.world);
}

function historicalItems(state: Record<string, unknown>): Record<string, unknown> {
  return object(state.items);
}

function normalizedName(item: Record<string, unknown>): string {
  return String(item.name ?? item.label ?? item.displayName ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function findHistoricalItem(state: Record<string, unknown>, predicate: (id: string, item: Record<string, unknown>) => boolean): [string, Record<string, unknown>] {
  const items = historicalItems(state);
  for (const [id, raw] of Object.entries(items)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    if (predicate(id, item)) return [id, item];
  }
  const summary = Object.entries(items).map(([id, raw]) => {
    const item = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    return { id, keys: Object.keys(item).sort(), name: item.name ?? item.label ?? item.displayName, type: item.type, kind: item.kind, definitionId: item.definitionId };
  });
  throw new Error(`Historical item not found: ${JSON.stringify(summary)}`);
}

function historicalApple(state: Record<string, unknown>): [string, Record<string, unknown>] {
  return findHistoricalItem(state, (_id, item) => {
    const name = normalizedName(item);
    return name.includes('pomme') || name.includes('apple') || item.type === 'food' || item.kind === 'food';
  });
}

function historicalBottle(state: Record<string, unknown>): [string, Record<string, unknown>] {
  return findHistoricalItem(state, (_id, item) => {
    const name = normalizedName(item);
    return name.includes('bouteille') || name.includes('bottle') || typeof item.capacityMl === 'number' || typeof item.liquidMl === 'number' || typeof item.waterMl === 'number';
  });
}

const historicalEngine = loadHistoricalEngine();

describe('controlled preview save migration', () => {
  it('uses the exact historical v0.1.11 engine as its fixture', () => {
    expect(historicalEngine.VERSION).toBe('0.1.11');
    expect(typeof historicalEngine.createInitialState).toBe('function');
    expect(LEGACY_PREVIEW_SAVE_KEYS).toEqual(['absence-preview-v0111', 'absence-preview-v019']);
  });

  it('migrates a genuine fresh v0.1.11 state into a valid v0.2 state', () => {
    const migrated = migrateLegacyPreviewState(historicalEngine.createInitialState());
    expect(migrated).not.toBeNull();
    expect(validateState(migrated!)).toEqual([]);
    expect(migrated).toMatchObject({
      gameVersion: '0.2.0-dev',
      player: {
        locationId: 'bedroom',
        healthPv: 100,
        needs: { hunger: 12, thirst: 10, fatigue: 18, stress: 22, pain: 0 },
      },
    });
    expect(migrated?.player.inventoryIds).toContain('phone_01');
  });

  it('preserves recognized gameplay progress without resurrecting a consumed apple', () => {
    const legacy = historicalEngine.createInitialState();
    const stats = historicalStats(legacy);
    stats.health = 83;
    stats.hunger = 41;
    stats.thirst = 67;
    stats.fatigue = 52;
    stats.stress = 39;
    stats.pain = 14;

    const items = historicalItems(legacy);
    const [appleId] = historicalApple(legacy);
    delete items[appleId];
    const [waterId, water] = historicalBottle(legacy);
    if ('liquidMl' in water) water.liquidMl = 125;
    else if ('amountMl' in water) water.amountMl = 125;
    else if ('waterMl' in water) water.waterMl = 125;
    else water.liquidMl = 125;
    const inventory = historicalInventory(legacy);
    if (!inventory.includes(waterId)) inventory.push(waterId);

    const world = historicalWorld(legacy);
    world.powerAvailable = false;
    world.waterNetworkAvailable = true;
    world.leakActive = true;
    world.weather = { condition: 'rain', temperatureC: 17, humidityPct: 78, windKph: 24, precipitationMmPerHour: 3.4 };
    world.effects = [{
      id: 'legacy_smoke', type: 'smoke', locationId: 'kitchen', intensity: 32, active: true,
      spreading: true, createdAtSeconds: 30, updatedAtSeconds: 60,
    }];
    legacy.memory = { shoutedForWife: true, visitedLocationIds: ['bedroom', 'kitchen'] };

    const migrated = migrateLegacyPreviewState(legacy)!;
    expect(validateState(migrated)).toEqual([]);
    expect(migrated.player.healthPv).toBe(83);
    expect(migrated.player.needs).toEqual({ hunger: 41, thirst: 67, fatigue: 52, stress: 39, pain: 14 });
    expect(migrated.items.apple_01?.location.kind).toBe('consumed');
    expect(migrated.items.water_01?.location.kind).toBe('inventory');
    expect(migrated.items.water_01?.liquidMl).toBe(125);
    expect(migrated.infrastructure.electricity.available).toBe(false);
    expect(migrated.infrastructure.water.available).toBe(true);
    expect(migrated.world.leakActive).toBe(true);
    expect(migrated.world.effects).toContainEqual(expect.objectContaining({ id: 'legacy_smoke', type: 'smoke', locationId: 'kitchen', intensity: 32, active: true }));
    expect((migrated.world as typeof migrated.world & { weather?: { condition?: string } }).weather?.condition).toBe('rain');
    expect(migrated.memory.shoutedForWife).toBe(true);
    expect(migrated.memory.visitedLocationIds).toEqual(expect.arrayContaining(['bedroom', 'kitchen']));
  });

  it('prefers absence-preview-v0111 over the v0.1.9 fallback', () => {
    const storage = new MemoryStorage();
    const primary = historicalEngine.createInitialState();
    historicalStats(primary).health = 71;
    const fallback = historicalEngine.createInitialState();
    historicalStats(fallback).health = 44;
    storage.setItem('absence-preview-v0111', JSON.stringify(primary));
    storage.setItem('absence-preview-v019', JSON.stringify(fallback));

    const migrated = loadLegacyPreviewMigration(storage);
    expect(migrated?.sourceKey).toBe('absence-preview-v0111');
    expect(migrated?.state.player.healthPv).toBe(71);
  });

  it('always prefers an existing valid v0.2 save over historical preview keys', () => {
    const storage = new MemoryStorage();
    const v020 = createInitialState();
    v020.player.healthPv = 62;
    storage.setItem(SAVE_KEY, JSON.stringify(v020));
    const legacy = historicalEngine.createInitialState();
    historicalStats(legacy).health = 22;
    storage.setItem('absence-preview-v0111', JSON.stringify(legacy));

    expect(loadState(storage).player.healthPv).toBe(62);
  });

  it('falls back safely when historical data is corrupt or unrelated', () => {
    const storage = new MemoryStorage();
    storage.setItem('absence-preview-v0111', '{broken');
    storage.setItem('absence-preview-v019', JSON.stringify({ hello: 'world' }));
    expect(loadLegacyPreviewMigration(storage)).toBeNull();
    expect(loadState(storage)).toEqual(createInitialState());
  });

  it('returns a normal v0.2 GameState type after migration', () => {
    const migrated: GameState | null = migrateLegacyPreviewState(historicalEngine.createInitialState());
    expect(migrated?.schemaVersion).toBe(1);
  });
});
