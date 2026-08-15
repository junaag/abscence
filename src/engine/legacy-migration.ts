import { getItemDefinition } from '../content/items';
import { ensureAutonomousInfrastructureTransitions } from './infrastructure';
import { assertValidState } from './invariants';
import type { GameState, ItemLocation, PersistentEffect, PersistentEffectType } from './model';
import { ensurePhoneState } from './phone';
import { createInitialState } from './state';
import { ensureWeatherState, setWeatherState, type WeatherCondition } from './weather';
import { ensureWorldEventSimulationState } from './world-events';

export const LEGACY_PREVIEW_SAVE_KEYS = ['absence-preview-v0111', 'absence-preview-v019'] as const;

export interface LegacyMigrationResult {
  state: GameState;
  sourceKey: (typeof LEGACY_PREVIEW_SAVE_KEYS)[number];
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function numberValue(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function path(root: unknown, keys: readonly string[]): unknown {
  let current: unknown = root;
  for (const key of keys) {
    const object = record(current);
    if (!object || !(key in object)) return undefined;
    current = object[key];
  }
  return current;
}

function firstNumber(root: unknown, paths: readonly (readonly string[])[]): number | null {
  for (const candidate of paths) {
    const value = numberValue(path(root, candidate));
    if (value !== null) return value;
  }
  return null;
}

function firstString(root: unknown, paths: readonly (readonly string[])[]): string | null {
  for (const candidate of paths) {
    const value = stringValue(path(root, candidate));
    if (value !== null) return value;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function percent(value: number | null, fallback: number): number {
  return value === null ? fallback : clamp(value, 0, 100);
}

function looksLikeLegacyPreviewState(value: unknown): value is UnknownRecord {
  const root = record(value);
  if (!root) return false;
  const items = record(root.items);
  const stats = record(root.stats) ?? record(path(root, ['player', 'stats']));
  const locations = record(root.locations);
  const locationId = firstString(root, [['locationId'], ['player', 'locationId'], ['player', 'location']]);
  return Boolean(items && (stats || locationId) && (locations || items.phone_01));
}

function migrateNeeds(target: GameState, legacy: UnknownRecord): void {
  target.player.healthPv = percent(firstNumber(legacy, [
    ['stats', 'health'], ['stats', 'healthPv'], ['player', 'health'], ['player', 'healthPv'], ['player', 'stats', 'health'],
  ]), target.player.healthPv);
  target.player.needs.hunger = percent(firstNumber(legacy, [['stats', 'hunger'], ['player', 'needs', 'hunger'], ['player', 'stats', 'hunger']]), target.player.needs.hunger);
  target.player.needs.thirst = percent(firstNumber(legacy, [['stats', 'thirst'], ['player', 'needs', 'thirst'], ['player', 'stats', 'thirst']]), target.player.needs.thirst);
  target.player.needs.fatigue = percent(firstNumber(legacy, [['stats', 'fatigue'], ['player', 'needs', 'fatigue'], ['player', 'stats', 'fatigue']]), target.player.needs.fatigue);
  target.player.needs.stress = percent(firstNumber(legacy, [['stats', 'stress'], ['player', 'needs', 'stress'], ['player', 'stats', 'stress']]), target.player.needs.stress);
  target.player.needs.pain = percent(firstNumber(legacy, [['stats', 'pain'], ['player', 'needs', 'pain'], ['player', 'stats', 'pain']]), target.player.needs.pain);
  target.player.alive = target.player.healthPv > 0;
}

function migrateLocation(target: GameState, legacy: UnknownRecord): void {
  const legacyLocation = firstString(legacy, [['locationId'], ['player', 'locationId'], ['player', 'location']]);
  if (legacyLocation && target.locations[legacyLocation]) target.player.locationId = legacyLocation;
}

function migrateClock(target: GameState, legacy: UnknownRecord): void {
  const elapsed = firstNumber(legacy, [['engine', 'elapsedSeconds'], ['elapsedSeconds'], ['time', 'elapsedSeconds'], ['world', 'elapsedSeconds']]);
  if (elapsed !== null && elapsed >= 0) target.engine.elapsedSeconds = Math.floor(elapsed);

  const day = firstNumber(legacy, [['clock', 'day'], ['time', 'day'], ['day']]);
  const secondOfDay = firstNumber(legacy, [['clock', 'secondOfDay'], ['time', 'secondOfDay']]);
  if (day !== null && day >= 1) target.clock.day = Math.max(1, Math.floor(day));
  if (secondOfDay !== null) target.clock.secondOfDay = Math.floor(((secondOfDay % 86400) + 86400) % 86400);
  else {
    const hour = firstNumber(legacy, [['time', 'hour'], ['clock', 'hour'], ['hour']]);
    const minute = firstNumber(legacy, [['time', 'minute'], ['clock', 'minute'], ['minute']]);
    const second = firstNumber(legacy, [['time', 'second'], ['clock', 'second'], ['second']]);
    if (hour !== null || minute !== null || second !== null) {
      target.clock.secondOfDay = Math.floor(clamp(hour ?? 0, 0, 23) * 3600 + clamp(minute ?? 0, 0, 59) * 60 + clamp(second ?? 0, 0, 59));
    }
  }
}

function inventoryIds(legacy: UnknownRecord): Set<string> {
  const candidates = [path(legacy, ['inventory']), path(legacy, ['inventoryIds']), path(legacy, ['player', 'inventoryIds']), path(legacy, ['player', 'inventory'])];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return new Set(candidate.map((entry) => typeof entry === 'string' ? entry : stringValue(record(entry)?.id)).filter((entry): entry is string => Boolean(entry)));
  }
  return new Set<string>();
}

function legacyItemLocation(item: UnknownRecord, inventory: Set<string>, itemId: string, target: GameState): ItemLocation | null {
  if (inventory.has(itemId) || item.carried === true || item.inInventory === true) return { kind: 'inventory' };
  const rawLocation = stringValue(item.locationId) ?? stringValue(item.location);
  if (rawLocation === 'inventory' || rawLocation === 'player' || rawLocation === 'carried') return { kind: 'inventory' };
  if (rawLocation === 'consumed' || item.consumed === true) return { kind: 'consumed' };
  if (rawLocation && target.locations[rawLocation]) return { kind: 'location', id: rawLocation };
  return null;
}

function migrateItems(target: GameState, legacy: UnknownRecord): void {
  const legacyItems = record(legacy.items);
  if (!legacyItems) return;
  const inventory = inventoryIds(legacy);

  for (const [itemId, targetItem] of Object.entries(target.items)) {
    const legacyItem = record(legacyItems[itemId]);
    if (!legacyItem) {
      if (itemId === 'apple_01') targetItem.location = { kind: 'consumed' };
      continue;
    }
    const location = legacyItemLocation(legacyItem, inventory, itemId, target);
    if (location) targetItem.location = location;

    const liquidMl = numberValue(legacyItem.liquidMl ?? legacyItem.amountMl ?? legacyItem.waterMl);
    if (targetItem.capacityMl !== undefined && liquidMl !== null) targetItem.liquidMl = clamp(liquidMl, 0, targetItem.capacityMl);
    const capacityMl = numberValue(legacyItem.capacityMl);
    if (targetItem.capacityMl !== undefined && capacityMl !== null && capacityMl > 0) {
      targetItem.capacityMl = capacityMl;
      targetItem.liquidMl = clamp(targetItem.liquidMl ?? 0, 0, capacityMl);
    }
    const battery = numberValue(legacyItem.batteryPercent ?? legacyItem.batteryPct ?? legacyItem.chargePercent);
    if (getItemDefinition(targetItem.definitionId)?.battery && battery !== null) targetItem.batteryPercent = clamp(battery, 0, 100);
    const freshness = numberValue(legacyItem.freshnessPercent ?? legacyItem.freshnessPct ?? legacyItem.freshness);
    if (getItemDefinition(targetItem.definitionId)?.perishable && freshness !== null) targetItem.freshnessPercent = clamp(freshness, 0, 100);
    if (typeof legacyItem.examined === 'boolean') targetItem.examined = legacyItem.examined;
    if (typeof legacyItem.enabled === 'boolean') targetItem.enabled = legacyItem.enabled;
    const condition = stringValue(legacyItem.condition);
    if (condition) targetItem.condition = condition;
  }

  target.player.inventoryIds = Object.values(target.items).filter((item) => item.location.kind === 'inventory').map((item) => item.id);
}

const EFFECT_TYPES = new Set<PersistentEffectType>(['water_puddle', 'smoke', 'fire', 'persistent_noise']);

function migrateEffects(target: GameState, legacy: UnknownRecord): void {
  const effects = path(legacy, ['world', 'effects']);
  if (!Array.isArray(effects)) return;
  const migrated: PersistentEffect[] = [];
  for (const raw of effects) {
    const effect = record(raw);
    if (!effect) continue;
    const type = stringValue(effect.type) as PersistentEffectType | null;
    const locationId = stringValue(effect.locationId);
    const intensity = numberValue(effect.intensity);
    if (!type || !EFFECT_TYPES.has(type) || !locationId || !target.locations[locationId] || intensity === null) continue;
    const createdAtSeconds = Math.max(0, Math.floor(numberValue(effect.createdAtSeconds) ?? target.engine.elapsedSeconds));
    const updatedAtSeconds = Math.max(createdAtSeconds, Math.floor(numberValue(effect.updatedAtSeconds) ?? target.engine.elapsedSeconds));
    migrated.push({
      id: stringValue(effect.id) ?? `legacy_${type}_${migrated.length + 1}`,
      type,
      locationId,
      intensity: clamp(intensity, 0, 100),
      active: booleanValue(effect.active) ?? intensity > 0,
      spreading: booleanValue(effect.spreading) ?? false,
      createdAtSeconds,
      updatedAtSeconds,
      ...(stringValue(effect.source) ? { source: stringValue(effect.source)! } : {}),
    });
  }
  target.world.effects = migrated.map((effect) => effect.active ? effect : { ...effect, intensity: 0 });
  target.engine.nextEffectId = Math.max(1, target.world.effects.length + 1);
}

function migrateInfrastructure(target: GameState, legacy: UnknownRecord): void {
  const legacyInfrastructure = record(legacy.infrastructure);
  const world = record(legacy.world);

  const powerBoolean = booleanValue(world?.powerAvailable ?? world?.electricityAvailable);
  const waterBoolean = booleanValue(world?.waterNetworkAvailable ?? world?.waterAvailable);
  const mobileBoolean = booleanValue(world?.mobileNetworkAvailable ?? world?.mobileAvailable);

  if (powerBoolean !== null) {
    target.infrastructure.electricity.available = powerBoolean;
    target.infrastructure.electricity.voltagePercent = powerBoolean ? 100 : 0;
  }
  if (waterBoolean !== null) {
    target.infrastructure.water.available = waterBoolean;
    target.infrastructure.water.pressure = waterBoolean ? 1 : 0;
  }
  if (mobileBoolean !== null) {
    target.infrastructure.mobile.available = mobileBoolean;
    target.infrastructure.mobile.signal = mobileBoolean ? 4 : 0;
    target.infrastructure.mobile.signalPercent = mobileBoolean ? 100 : 0;
  }

  if (!legacyInfrastructure) return;
  const electricity = record(legacyInfrastructure.electricity);
  const water = record(legacyInfrastructure.water);
  const mobile = record(legacyInfrastructure.mobile);
  if (electricity) {
    const available = booleanValue(electricity.available);
    const level = numberValue(electricity.voltagePercent ?? electricity.levelPct ?? electricity.levelPercent);
    if (available !== null) target.infrastructure.electricity.available = available;
    if (level !== null) target.infrastructure.electricity.voltagePercent = clamp(level, 0, 100);
    if (target.infrastructure.electricity.voltagePercent <= 0) target.infrastructure.electricity.available = false;
  }
  if (water) {
    const available = booleanValue(water.available);
    const pressure = numberValue(water.pressure);
    const level = numberValue(water.levelPct ?? water.levelPercent);
    if (available !== null) target.infrastructure.water.available = available;
    if (pressure !== null) target.infrastructure.water.pressure = clamp(pressure, 0, 1);
    else if (level !== null) target.infrastructure.water.pressure = clamp(level / 100, 0, 1);
    if (target.infrastructure.water.pressure <= 0) target.infrastructure.water.available = false;
  }
  if (mobile) {
    const available = booleanValue(mobile.available);
    const signalPercent = numberValue(mobile.signalPercent ?? mobile.levelPct ?? mobile.levelPercent);
    const signalBars = numberValue(mobile.signal);
    if (available !== null) target.infrastructure.mobile.available = available;
    if (signalPercent !== null) {
      target.infrastructure.mobile.signalPercent = clamp(signalPercent, 0, 100);
      target.infrastructure.mobile.signal = clamp(Math.round(signalPercent / 25), 0, 4);
    } else if (signalBars !== null) {
      target.infrastructure.mobile.signal = clamp(signalBars, 0, 4);
      target.infrastructure.mobile.signalPercent = clamp(signalBars * 25, 0, 100);
    }
    if ((target.infrastructure.mobile.signalPercent ?? 0) <= 0) target.infrastructure.mobile.available = false;
  }
}

function migrateWorld(target: GameState, legacy: UnknownRecord): void {
  const world = record(legacy.world);
  if (!world) return;
  const windows = record(world.windowsOpen);
  if (windows) {
    for (const [locationId, open] of Object.entries(windows)) if (target.locations[locationId] && typeof open === 'boolean') target.world.windowsOpen[locationId] = open;
  }
  const leak = booleanValue(world.leakActive);
  if (leak !== null) target.world.leakActive = leak;

  const scheduled = Array.isArray(world.scheduledEvents) ? world.scheduledEvents : [];
  for (const targetEvent of target.world.scheduledEvents) {
    const legacyEvent = scheduled.map(record).find((event) => event && (event.id === targetEvent.id || event.type === targetEvent.type));
    if (legacyEvent && typeof legacyEvent.processed === 'boolean') targetEvent.processed = legacyEvent.processed;
    else if (target.engine.elapsedSeconds >= targetEvent.atSeconds) targetEvent.processed = true;
  }

  const weather = record(world.weather) ?? record(legacy.weather);
  if (weather) {
    setWeatherState(target, {
      condition: (stringValue(weather.condition) ?? 'clear') as WeatherCondition,
      temperatureC: numberValue(weather.temperatureC ?? weather.temperature) ?? 23,
      humidityPct: numberValue(weather.humidityPct ?? weather.humidityPercent ?? weather.humidity) ?? 55,
      windKph: numberValue(weather.windKph ?? weather.windSpeedKph ?? weather.wind) ?? 8,
      precipitationMmPerHour: numberValue(weather.precipitationMmPerHour ?? weather.precipitation ?? weather.rainMmPerHour) ?? 0,
    });
  }
}

function migrateMemory(target: GameState, legacy: UnknownRecord): void {
  const memory = record(legacy.memory);
  if (!memory) return;
  const shouted = booleanValue(memory.shoutedForWife);
  if (shouted !== null) target.memory.shoutedForWife = shouted;
  const visited = memory.visitedLocationIds ?? memory.visited;
  if (Array.isArray(visited)) {
    const ids = visited.map(stringValue).filter((id): id is string => Boolean(id && target.locations[id]));
    if (ids.length > 0) target.memory.visitedLocationIds = [...new Set(ids)];
  }
  if (!target.memory.visitedLocationIds.includes(target.player.locationId)) target.memory.visitedLocationIds.push(target.player.locationId);
}

export function migrateLegacyPreviewState(raw: unknown): GameState | null {
  if (!looksLikeLegacyPreviewState(raw)) return null;
  const legacy = raw as UnknownRecord;
  const state = createInitialState();
  migrateNeeds(state, legacy);
  migrateLocation(state, legacy);
  migrateClock(state, legacy);
  migrateItems(state, legacy);
  migrateInfrastructure(state, legacy);
  migrateEffects(state, legacy);
  migrateWorld(state, legacy);
  migrateMemory(state, legacy);
  ensureAutonomousInfrastructureTransitions(state);
  ensureWorldEventSimulationState(state);
  ensureWeatherState(state);
  ensurePhoneState(state);
  assertValidState(state);
  return state;
}

export function loadLegacyPreviewMigration(storage: { getItem(key: string): string | null }): LegacyMigrationResult | null {
  for (const sourceKey of LEGACY_PREVIEW_SAVE_KEYS) {
    const raw = storage.getItem(sourceKey);
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const state = migrateLegacyPreviewState(parsed);
      if (state) return { state, sourceKey };
    } catch {
      // Ignore corrupt historical data and try the next known legacy key.
    }
  }
  return null;
}
