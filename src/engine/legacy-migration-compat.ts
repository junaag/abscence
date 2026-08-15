import { assertValidState } from './invariants';
import type { GameState, ItemLocation } from './model';
import {
  LEGACY_PREVIEW_SAVE_KEYS,
  migrateLegacyPreviewState as migrateLegacyPreviewStateBase,
  type LegacyMigrationResult,
} from './legacy-migration';

export { LEGACY_PREVIEW_SAVE_KEYS } from './legacy-migration';
export type { LegacyMigrationResult } from './legacy-migration';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numeric(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function legacyInventoryIds(legacy: UnknownRecord): Set<string> {
  const player = record(legacy.player);
  const candidates = [legacy.inventory, legacy.inventoryIds, player?.inventoryIds, player?.inventory];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return new Set(candidate.flatMap((entry) => {
      if (typeof entry === 'string') return [entry];
      const id = text(record(entry)?.id);
      return id ? [id] : [];
    }));
  }
  return new Set<string>();
}

function normalizedDefinition(definitionId: string): string {
  return definitionId.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function definitionMatches(targetDefinitionId: string, legacyDefinitionId: string): boolean {
  const target = normalizedDefinition(targetDefinitionId);
  const legacy = normalizedDefinition(legacyDefinitionId);
  if (target === legacy) return true;
  if (target === 'waterbottle' && legacy.startsWith('waterbottle')) return true;
  if (target === 'smartphone' && legacy === 'smartphone') return true;
  if (target === 'apple' && legacy === 'apple') return true;
  if (target === 'towel' && legacy === 'towel') return true;
  if (target === 'walloutlet' && legacy === 'walloutlet') return true;
  return false;
}

function legacyItemForTarget(legacyItems: UnknownRecord, targetId: string, targetDefinitionId: string): { id: string; item: UnknownRecord } | null {
  const exact = record(legacyItems[targetId]);
  if (exact) return { id: targetId, item: exact };

  for (const [legacyId, raw] of Object.entries(legacyItems)) {
    const item = record(raw);
    if (!item) continue;
    const definitionId = text(item.definitionId);
    if (definitionId && definitionMatches(targetDefinitionId, definitionId)) return { id: legacyId, item };
  }
  return null;
}

function mergedItemState(item: UnknownRecord): UnknownRecord {
  return { ...item, ...(record(item.state) ?? {}) };
}

function migratedLocation(
  sourceId: string,
  item: UnknownRecord,
  inventory: Set<string>,
  target: GameState,
): ItemLocation | null {
  const state = mergedItemState(item);
  if (inventory.has(sourceId) || item.carried === true || item.inInventory === true || state.carried === true || state.inInventory === true) {
    return { kind: 'inventory' };
  }
  const locationId = text(item.locationId) ?? text(state.locationId) ?? text(item.location) ?? text(state.location);
  if (locationId === 'inventory' || locationId === 'player' || locationId === 'carried') return { kind: 'inventory' };
  if (locationId === 'consumed' || item.consumed === true || state.consumed === true) return { kind: 'consumed' };
  if (locationId && target.locations[locationId]) return { kind: 'location', id: locationId };
  return null;
}

function applyLegacyItemCompatibility(target: GameState, legacy: UnknownRecord): void {
  const legacyItems = record(legacy.items);
  if (!legacyItems) return;
  const inventory = legacyInventoryIds(legacy);

  for (const targetItem of Object.values(target.items)) {
    const source = legacyItemForTarget(legacyItems, targetItem.id, targetItem.definitionId);
    if (!source) continue;
    const state = mergedItemState(source.item);

    const location = migratedLocation(source.id, source.item, inventory, target);
    if (location) targetItem.location = location;

    const capacity = numeric(state.capacityMl ?? state.capacity ?? state.maxMl);
    const liquid = numeric(state.liquidMl ?? state.amountMl ?? state.waterMl ?? state.currentMl ?? state.volumeMl);
    if (targetItem.capacityMl !== undefined) {
      if (capacity !== null && capacity > 0) targetItem.capacityMl = capacity;
      if (liquid !== null) targetItem.liquidMl = clamp(liquid, 0, targetItem.capacityMl);
    }

    const battery = numeric(state.batteryPercent ?? state.batteryPct ?? state.chargePercent ?? state.chargePct ?? state.battery);
    if (targetItem.batteryPercent !== undefined && battery !== null) targetItem.batteryPercent = clamp(battery, 0, 100);

    const freshness = numeric(state.freshnessPercent ?? state.freshnessPct ?? state.freshness);
    if (targetItem.freshnessPercent !== undefined && freshness !== null) targetItem.freshnessPercent = clamp(freshness, 0, 100);

    if (typeof state.examined === 'boolean') targetItem.examined = state.examined;
    if (typeof source.item.examined === 'boolean') targetItem.examined = source.item.examined;
    if (typeof state.enabled === 'boolean') targetItem.enabled = state.enabled;
    const condition = text(state.condition ?? state.status);
    if (condition) targetItem.condition = condition;
  }

  target.player.inventoryIds = Object.values(target.items)
    .filter((item) => item.location.kind === 'inventory')
    .map((item) => item.id);
}

export function migrateLegacyPreviewState(value: unknown): GameState | null {
  const legacy = record(value);
  if (!legacy) return null;
  const migrated = migrateLegacyPreviewStateBase(value);
  if (!migrated) return null;
  applyLegacyItemCompatibility(migrated, legacy);
  assertValidState(migrated);
  return migrated;
}

export interface LegacyReadStorage {
  getItem(key: string): string | null;
}

export function loadLegacyPreviewMigration(storage: LegacyReadStorage): LegacyMigrationResult | null {
  for (const sourceKey of LEGACY_PREVIEW_SAVE_KEYS) {
    const raw = storage.getItem(sourceKey);
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const state = migrateLegacyPreviewState(parsed);
      if (state) return { state, sourceKey };
    } catch {
      // Ignore malformed historical data and continue to the next known key.
    }
  }
  return null;
}
