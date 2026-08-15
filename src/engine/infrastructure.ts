import type { GameState, InfrastructureTransitionState } from './model';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function isElectricityAvailable(state: GameState): boolean {
  return state.infrastructure.electricity.available && state.infrastructure.electricity.voltagePercent > 0;
}

export function isWaterAvailable(state: GameState): boolean {
  return state.infrastructure.water.available && state.infrastructure.water.pressure > 0;
}

export function isMobileAvailable(state: GameState): boolean {
  return state.infrastructure.mobile.available && state.infrastructure.mobile.signal > 0;
}

function applyTransition(state: GameState, transition: InfrastructureTransitionState): void {
  if (transition.network === 'electricity') {
    state.infrastructure.electricity.available = transition.available;
    if (transition.voltagePercent !== undefined) state.infrastructure.electricity.voltagePercent = clamp(transition.voltagePercent, 0, 100);
    else if (!transition.available) state.infrastructure.electricity.voltagePercent = 0;
    else if (state.infrastructure.electricity.voltagePercent <= 0) state.infrastructure.electricity.voltagePercent = 100;
  } else if (transition.network === 'water') {
    state.infrastructure.water.available = transition.available;
    if (transition.pressure !== undefined) state.infrastructure.water.pressure = clamp(transition.pressure, 0, 1);
    else if (!transition.available) state.infrastructure.water.pressure = 0;
    else if (state.infrastructure.water.pressure <= 0) state.infrastructure.water.pressure = 1;
  } else {
    state.infrastructure.mobile.available = transition.available;
    if (transition.signal !== undefined) state.infrastructure.mobile.signal = clamp(transition.signal, 0, 4);
    else if (!transition.available) state.infrastructure.mobile.signal = 0;
    else if (state.infrastructure.mobile.signal <= 0) state.infrastructure.mobile.signal = 3;
  }
  transition.processed = true;
}

export function applyDueInfrastructureTransitions(state: GameState): InfrastructureTransitionState[] {
  const due = (state.infrastructure.transitions ?? [])
    .filter((transition) => !transition.processed && transition.atSeconds <= state.engine.elapsedSeconds)
    .sort((a, b) => a.atSeconds - b.atSeconds || a.id.localeCompare(b.id));
  for (const transition of due) applyTransition(state, transition);
  return due;
}

export function secondsUntilNextInfrastructureTransition(state: GameState, maximumSeconds = Number.POSITIVE_INFINITY): number {
  const maximum = Number.isFinite(maximumSeconds) ? Math.max(0, maximumSeconds) : Number.POSITIVE_INFINITY;
  let result = maximum;
  for (const transition of state.infrastructure.transitions ?? []) {
    if (transition.processed) continue;
    const delta = transition.atSeconds - state.engine.elapsedSeconds;
    if (delta <= 0) return 0;
    result = Math.min(result, delta);
  }
  return result;
}
