import { advanceWorldEffects, type EffectAdvanceResult } from './effects';
import type { GameState } from './model';
import { advancePerishables, type PerishableChange } from './perishables';
import { advancePhysiology, BASE_RATES_PER_MINUTE, type PhysiologyAdvanceResult } from './physiology';
import { advanceItemResources, type ItemResourceChange } from './resources';

export { BASE_RATES_PER_MINUTE } from './physiology';
export type { PhysiologyAdvanceResult } from './physiology';

const DAY_SECONDS = 24 * 60 * 60;

export interface TimeAdvanceResult extends PhysiologyAdvanceResult {
  itemResourceChanges: ItemResourceChange[];
  perishableChanges: PerishableChange[];
  effects: EffectAdvanceResult;
}

export function advanceTime(state: GameState, seconds: number): TimeAdvanceResult {
  const elapsedSeconds = Math.max(0, Number(seconds) || 0);
  const effects = advanceWorldEffects(state, elapsedSeconds);
  const physiology = advancePhysiology(state, elapsedSeconds);
  const itemResourceChanges = advanceItemResources(state, elapsedSeconds);
  const perishableChanges = advancePerishables(state, elapsedSeconds);

  state.engine.elapsedSeconds += elapsedSeconds;
  state.clock.secondOfDay += elapsedSeconds;
  while (state.clock.secondOfDay >= DAY_SECONDS) {
    state.clock.secondOfDay -= DAY_SECONDS;
    state.clock.day += 1;
  }

  return { ...physiology, itemResourceChanges, perishableChanges, effects };
}

export function formatClock(state: GameState): string {
  const totalMinutes = Math.floor(state.clock.secondOfDay / 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

void BASE_RATES_PER_MINUTE;
