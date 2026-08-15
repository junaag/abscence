import type { GameState } from './model';
import { clampNeeds } from './state';

const HUNGER_SECONDS_PER_PERCENT = 25 * 60;
const THIRST_SECONDS_PER_PERCENT = 15 * 60;
const FATIGUE_SECONDS_PER_PERCENT = 20 * 60;
const DAY_SECONDS = 24 * 60 * 60;

export function advanceTime(state: GameState, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  state.clock.secondOfDay += seconds;
  while (state.clock.secondOfDay >= DAY_SECONDS) {
    state.clock.secondOfDay -= DAY_SECONDS;
    state.clock.day += 1;
  }
  state.player.needs.hunger += seconds / HUNGER_SECONDS_PER_PERCENT;
  state.player.needs.thirst += seconds / THIRST_SECONDS_PER_PERCENT;
  state.player.needs.fatigue += seconds / FATIGUE_SECONDS_PER_PERCENT;
  // Exact health-damage curve is migrated only after recovery from the historical engine.
  clampNeeds(state);
}

export function formatClock(state: GameState): string {
  const totalMinutes = Math.floor(state.clock.secondOfDay / 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
