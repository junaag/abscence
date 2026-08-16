import { getPlayerEnvironment } from './location-environment';
import type { GameState, NeedsState } from './model';
import { clampNeeds } from './state';

export const BASE_RATES_PER_MINUTE: Readonly<NeedsState> = Object.freeze({
  hunger: 1 / 25,
  thirst: 1 / 15,
  fatigue: 1 / 20,
  stress: 0,
  pain: 0,
});

const NEED_KEYS: ReadonlyArray<keyof NeedsState> = ['hunger', 'thirst', 'fatigue', 'stress', 'pain'];

export interface EnvironmentPhysiologyModifiers {
  temperatureC: number;
  humidityPercent: number;
  thirstMultiplier: number;
  fatigueMultiplier: number;
}

export interface PhysiologyAdvanceResult {
  elapsedSeconds: number;
  healthLostPv: number;
  naturalChanges: NeedsState;
  effectiveRatesPerMinute: NeedsState;
  environment: EnvironmentPhysiologyModifiers;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function durationAtOrAbove(start: number, ratePerMinute: number, durationMinutes: number, threshold: number): number {
  if (durationMinutes <= 0) return 0;
  if (start >= threshold) return durationMinutes;
  if (ratePerMinute <= 0) return 0;
  const minutesToThreshold = (threshold - start) / ratePerMinute;
  return clamp(durationMinutes - minutesToThreshold, 0, durationMinutes);
}

function healthDamageBudgetForNeed(start: number, rate: number, minutes: number, kind: 'thirst' | 'hunger'): number {
  const at90 = durationAtOrAbove(start, rate, minutes, 90);
  const at100 = durationAtOrAbove(start, rate, minutes, 100);
  const between90And100 = Math.max(0, at90 - at100);
  if (kind === 'thirst') return between90And100 / 30 + at100 / 10;
  return between90And100 / 120 + at100 / 60;
}

/** Historical heat/humidity modifiers from engine v0.1.8. */
export function environmentPhysiologyModifiers(temperatureC: number, humidityPercent: number): EnvironmentPhysiologyModifiers {
  const temperature = Number.isFinite(temperatureC) ? temperatureC : 20;
  const humidity = clamp(humidityPercent, 0, 100);
  let thirstMultiplier = 1;
  let fatigueMultiplier = 1;

  if (temperature > 26) thirstMultiplier += Math.min(1, (temperature - 26) * 0.05);
  if (temperature >= 28 && humidity > 60) thirstMultiplier += Math.min(0.2, (humidity - 60) / 200);
  if (temperature > 30) fatigueMultiplier += Math.min(0.35, (temperature - 30) * 0.03);

  return {
    temperatureC: temperature,
    humidityPercent: humidity,
    thirstMultiplier: round(thirstMultiplier, 6),
    fatigueMultiplier: round(fatigueMultiplier, 6),
  };
}

export function effectivePhysiologyRates(state: GameState): { rates: NeedsState; environment: EnvironmentPhysiologyModifiers } {
  const playerEnvironment = getPlayerEnvironment(state);
  const environment = environmentPhysiologyModifiers(playerEnvironment.temperatureC, playerEnvironment.humidityPct);
  return {
    environment,
    rates: {
      hunger: BASE_RATES_PER_MINUTE.hunger,
      thirst: BASE_RATES_PER_MINUTE.thirst * environment.thirstMultiplier,
      fatigue: BASE_RATES_PER_MINUTE.fatigue * environment.fatigueMultiplier,
      stress: BASE_RATES_PER_MINUTE.stress,
      pain: BASE_RATES_PER_MINUTE.pain,
    },
  };
}

export function advancePhysiology(state: GameState, seconds: number): PhysiologyAdvanceResult {
  const elapsedSeconds = Math.max(0, Number(seconds) || 0);
  const { rates, environment } = effectivePhysiologyRates(state);
  const zeroChanges: NeedsState = { hunger: 0, thirst: 0, fatigue: 0, stress: 0, pain: 0 };
  if (elapsedSeconds === 0) {
    return { elapsedSeconds: 0, healthLostPv: 0, naturalChanges: zeroChanges, effectiveRatesPerMinute: rates, environment };
  }

  const minutes = elapsedSeconds / 60;
  const before: NeedsState = { ...state.player.needs };
  let damageBudget = state.engine.damageBudgetPv;
  damageBudget += healthDamageBudgetForNeed(before.thirst, rates.thirst, minutes, 'thirst');
  damageBudget += healthDamageBudgetForNeed(before.hunger, rates.hunger, minutes, 'hunger');

  const healthLostPv = Math.floor(damageBudget + 1e-9);
  state.engine.damageBudgetPv = round(damageBudget - healthLostPv, 6);
  if (healthLostPv > 0) state.player.healthPv = clamp(state.player.healthPv - healthLostPv);

  const naturalChanges: NeedsState = { ...zeroChanges };
  for (const key of NEED_KEYS) {
    const next = clamp(before[key] + rates[key] * minutes);
    state.player.needs[key] = round(next, 6);
    naturalChanges[key] = round(state.player.needs[key] - before[key], 6);
  }

  clampNeeds(state);
  return { elapsedSeconds, healthLostPv, naturalChanges, effectiveRatesPerMinute: rates, environment };
}
