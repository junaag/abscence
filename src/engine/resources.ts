import { getItemDefinition } from '../content/items';
import type { GameState } from './model';

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export interface ItemResourceChange {
  itemId: string;
  resource: 'batteryPercent';
  from: number;
  to: number;
  delta: number;
}

export function advanceItemResources(state: GameState, seconds: number): ItemResourceChange[] {
  const elapsedSeconds = Math.max(0, Number(seconds) || 0);
  const elapsedMinutes = elapsedSeconds / 60;
  const changes: ItemResourceChange[] = [];
  if (elapsedSeconds === 0) return changes;

  for (const item of Object.values(state.items)) {
    const definition = getItemDefinition(item.definitionId);
    const battery = definition?.battery;
    if (!battery || !item.enabled) continue;
    const drainRate = Math.max(0, battery.passiveDrainPctPerMinuteWhenEnabled ?? 0);
    if (drainRate <= 0) continue;

    const before = clampPercent(item.batteryPercent ?? battery.initialChargePct);
    const after = round(clampPercent(before - drainRate * elapsedMinutes), 6);
    item.batteryPercent = after;
    if (after <= 0) item.enabled = false;
    if (after !== before) changes.push({ itemId: item.id, resource: 'batteryPercent', from: before, to: after, delta: round(after - before, 6) });
  }

  return changes;
}
