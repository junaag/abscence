import type { GameState } from './model';
import { getCarryCapacity, getCarryLoad } from './selectors';
import { clampNeeds } from './state';

export type EncumbranceTier = 'light' | 'moderate' | 'heavy' | 'severe';

export interface EncumbranceProfile {
  load: number;
  capacity: number;
  ratio: number;
  tier: EncumbranceTier;
  label: string;
  movementTimeMultiplier: number;
  physicalActionTimeMultiplier: number;
  exertionFatiguePerMinute: number;
  exertionThirstPerMinute: number;
}

function profileForRatio(ratio: number): Omit<EncumbranceProfile, 'load' | 'capacity' | 'ratio'> {
  if (ratio <= 0.35) {
    return {
      tier: 'light',
      label: 'Charge légère',
      movementTimeMultiplier: 1,
      physicalActionTimeMultiplier: 1,
      exertionFatiguePerMinute: 0.03,
      exertionThirstPerMinute: 0.005,
    };
  }
  if (ratio <= 0.65) {
    return {
      tier: 'moderate',
      label: 'Charge modérée',
      movementTimeMultiplier: 1.08,
      physicalActionTimeMultiplier: 1.05,
      exertionFatiguePerMinute: 0.09,
      exertionThirstPerMinute: 0.02,
    };
  }
  if (ratio <= 0.85) {
    return {
      tier: 'heavy',
      label: 'Charge lourde',
      movementTimeMultiplier: 1.2,
      physicalActionTimeMultiplier: 1.12,
      exertionFatiguePerMinute: 0.2,
      exertionThirstPerMinute: 0.05,
    };
  }
  return {
    tier: 'severe',
    label: 'Charge très lourde',
    movementTimeMultiplier: 1.45,
    physicalActionTimeMultiplier: 1.25,
    exertionFatiguePerMinute: 0.4,
    exertionThirstPerMinute: 0.1,
  };
}

export function getEncumbranceProfile(state: GameState): EncumbranceProfile {
  const load = getCarryLoad(state);
  const capacity = getCarryCapacity(state);
  const ratio = capacity > 0 ? Math.min(1, Math.max(0, load / capacity)) : 1;
  return { load, capacity, ratio, ...profileForRatio(ratio) };
}

export function scalePhysicalDuration(state: GameState, baseSeconds: number, kind: 'movement' | 'action'): number {
  const profile = getEncumbranceProfile(state);
  const multiplier = kind === 'movement' ? profile.movementTimeMultiplier : profile.physicalActionTimeMultiplier;
  return Math.max(1, Math.round(Math.max(0, baseSeconds) * multiplier));
}

export function applyPhysicalExertion(state: GameState, elapsedSeconds: number, intensity = 1): { fatigueAdded: number; thirstAdded: number } {
  const profile = getEncumbranceProfile(state);
  const minutes = Math.max(0, elapsedSeconds) / 60;
  const normalizedIntensity = Math.max(0, intensity);
  const fatigueAdded = profile.exertionFatiguePerMinute * minutes * normalizedIntensity;
  const thirstAdded = profile.exertionThirstPerMinute * minutes * normalizedIntensity;
  state.player.needs.fatigue += fatigueAdded;
  state.player.needs.thirst += thirstAdded;
  clampNeeds(state);
  return { fatigueAdded, thirstAdded };
}
