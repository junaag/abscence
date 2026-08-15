import type { GameState, NeedsState } from './model';
import { advancePerishables, type PerishableChange } from './perishables';
import { advanceItemResources, type ItemResourceChange } from './resources';
import { clampNeeds } from './state';

export const BASE_RATES_PER_MINUTE: Readonly<NeedsState> = Object.freeze({ hunger: 1 / 25, thirst: 1 / 15, fatigue: 1 / 20, stress: 0, pain: 0 });
const DAY_SECONDS = 24 * 60 * 60;
const NEED_KEYS: ReadonlyArray<keyof NeedsState> = ['hunger', 'thirst', 'fatigue', 'stress', 'pain'];

export interface PhysiologyAdvanceResult { elapsedSeconds: number; healthLostPv: number; naturalChanges: NeedsState; }
export interface TimeAdvanceResult extends PhysiologyAdvanceResult { itemResourceChanges: ItemResourceChange[]; perishableChanges: PerishableChange[]; }
function clamp(value: number, min = 0, max = 100): number { if (!Number.isFinite(value)) return min; return Math.min(max, Math.max(min, value)); }
function round(value: number, digits = 6): number { const factor = 10 ** digits; return Math.round((value + Number.EPSILON) * factor) / factor; }
function durationAtOrAbove(start: number, ratePerMinute: number, durationMinutes: number, threshold: number): number { if (durationMinutes <= 0) return 0; if (start >= threshold) return durationMinutes; if (ratePerMinute <= 0) return 0; const minutesToThreshold = (threshold - start) / ratePerMinute; return clamp(durationMinutes - minutesToThreshold, 0, durationMinutes); }
function healthDamageBudgetForNeed(start: number, rate: number, minutes: number, kind: 'thirst' | 'hunger'): number { const at90 = durationAtOrAbove(start, rate, minutes, 90); const at100 = durationAtOrAbove(start, rate, minutes, 100); const between90And100 = Math.max(0, at90 - at100); if (kind === 'thirst') return between90And100 / 30 + at100 / 10; return between90And100 / 120 + at100 / 60; }

export function advancePhysiology(state: GameState, seconds: number, rates: Readonly<NeedsState> = BASE_RATES_PER_MINUTE): PhysiologyAdvanceResult {
  const elapsedSeconds = Math.max(0, Number(seconds) || 0);
  const zeroChanges: NeedsState = { hunger: 0, thirst: 0, fatigue: 0, stress: 0, pain: 0 };
  if (elapsedSeconds === 0) return { elapsedSeconds: 0, healthLostPv: 0, naturalChanges: zeroChanges };
  const minutes = elapsedSeconds / 60;
  const before: NeedsState = { ...state.player.needs };
  let damageBudget = state.engine.damageBudgetPv;
  damageBudget += healthDamageBudgetForNeed(before.thirst, rates.thirst, minutes, 'thirst');
  damageBudget += healthDamageBudgetForNeed(before.hunger, rates.hunger, minutes, 'hunger');
  const healthLostPv = Math.floor(damageBudget + 1e-9);
  state.engine.damageBudgetPv = round(damageBudget - healthLostPv, 6);
  if (healthLostPv > 0) state.player.healthPv = clamp(state.player.healthPv - healthLostPv);
  const naturalChanges: NeedsState = { ...zeroChanges };
  for (const key of NEED_KEYS) { const next = clamp(before[key] + rates[key] * minutes); state.player.needs[key] = round(next, 6); naturalChanges[key] = round(state.player.needs[key] - before[key], 6); }
  clampNeeds(state);
  return { elapsedSeconds, healthLostPv, naturalChanges };
}

export function advanceTime(state: GameState, seconds: number): TimeAdvanceResult {
  const elapsedSeconds = Math.max(0, Number(seconds) || 0);
  const physiology = advancePhysiology(state, elapsedSeconds);
  const itemResourceChanges = advanceItemResources(state, elapsedSeconds);
  const perishableChanges = advancePerishables(state, elapsedSeconds);
  state.clock.secondOfDay += elapsedSeconds;
  while (state.clock.secondOfDay >= DAY_SECONDS) { state.clock.secondOfDay -= DAY_SECONDS; state.clock.day += 1; }
  return { ...physiology, itemResourceChanges, perishableChanges };
}

export function formatClock(state: GameState): string { const totalMinutes = Math.floor(state.clock.secondOfDay / 60); const hours = Math.floor(totalMinutes / 60) % 24; const minutes = totalMinutes % 60; return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`; }
