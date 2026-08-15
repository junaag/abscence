import { getContainerDefinition } from '../content/containers';
import { getItemDefinition } from '../content/items';
import type { GameState, ItemState, LocationId } from './model';

export interface PerishableChange {
  itemId: string;
  fromFreshnessPercent: number;
  toFreshnessPercent: number;
  storageTemperatureC: number;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Historical v0.1.8 temperature curve used to scale food degradation. */
export function temperatureSpoilageMultiplier(temperatureC: number): number {
  const temperature = Number(temperatureC);
  if (!Number.isFinite(temperature)) return 1;
  if (temperature <= 4) return 0.25;
  if (temperature <= 10) return 0.25 + ((temperature - 4) / 6) * 0.2;
  if (temperature <= 20) return 0.45 + ((temperature - 10) / 10) * 0.55;
  if (temperature <= 30) return 1 + ((temperature - 20) / 10) * 0.6;
  if (temperature <= 40) return 1.6 + ((temperature - 30) / 10) * 0.8;
  return Math.min(3, 2.4 + (temperature - 40) * 0.06);
}

function ambientTemperature(state: GameState, locationId: LocationId): number {
  return state.locations[locationId]?.ambientTemperatureC ?? 20;
}

function containerTemperature(state: GameState, containerId: string): number | undefined {
  const container = state.containers[containerId];
  if (!container) return undefined;
  const ambient = ambientTemperature(state, container.locationId);
  const controller = getContainerDefinition(container.definitionId)?.environmentController;
  if (!controller) return ambient;
  const electricity = state.infrastructure.electricity;
  if (!electricity.available || electricity.voltagePercent < controller.minimumVoltagePercent) return ambient;
  return controller.targetTemperatureC;
}

export function getItemStorageTemperatureC(state: GameState, itemOrId: ItemState | string): number | undefined {
  const item = typeof itemOrId === 'string' ? state.items[itemOrId] : itemOrId;
  if (!item || item.location.kind === 'consumed') return undefined;
  if (item.location.kind === 'location') return ambientTemperature(state, item.location.id);
  if (item.location.kind === 'inventory') return ambientTemperature(state, state.player.locationId);
  return containerTemperature(state, item.location.id);
}

export function advancePerishables(state: GameState, seconds: number): PerishableChange[] {
  const elapsedHours = Math.max(0, Number(seconds) || 0) / 3600;
  if (elapsedHours === 0) return [];

  const changes: PerishableChange[] = [];
  for (const item of Object.values(state.items)) {
    if (item.location.kind === 'consumed') continue;
    const perishable = getItemDefinition(item.definitionId)?.perishable;
    if (!perishable) continue;
    const temperature = getItemStorageTemperatureC(state, item);
    if (temperature === undefined) continue;

    const before = clamp(item.freshnessPercent ?? perishable.initialFreshnessPercent);
    const loss = perishable.degradationPercentPerHourAmbient * temperatureSpoilageMultiplier(temperature) * elapsedHours;
    const after = round(clamp(before - loss), 6);
    item.freshnessPercent = after;
    if (after !== before) {
      changes.push({ itemId: item.id, fromFreshnessPercent: before, toFreshnessPercent: after, storageTemperatureC: temperature });
    }
  }
  return changes;
}
