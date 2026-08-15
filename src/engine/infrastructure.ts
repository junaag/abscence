import type { GameState, InfrastructureTransitionState } from './model';

export const INFRASTRUCTURE_SEED = 1701;
const AUTO_PREFIX = 'auto_infrastructure:';

type Network = InfrastructureTransitionState['network'];
type Stage = 'on' | 'unstable';
interface TransitionProfile { nextStatus: 'unstable' | 'off'; minHours: number; maxHours: number; }

export const INFRASTRUCTURE_PROFILES: Readonly<Record<Network, Readonly<Record<Stage, TransitionProfile>>>> = Object.freeze({
  electricity: Object.freeze({
    on: Object.freeze({ nextStatus: 'unstable', minHours: 12, maxHours: 72 }),
    unstable: Object.freeze({ nextStatus: 'off', minHours: 8, maxHours: 48 }),
  }),
  water: Object.freeze({
    on: Object.freeze({ nextStatus: 'unstable', minHours: 24, maxHours: 120 }),
    unstable: Object.freeze({ nextStatus: 'off', minHours: 12, maxHours: 72 }),
  }),
  mobile: Object.freeze({
    on: Object.freeze({ nextStatus: 'unstable', minHours: 3, maxHours: 24 }),
    unstable: Object.freeze({ nextStatus: 'off', minHours: 6, maxHours: 36 }),
  }),
});

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function hashString32(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function deterministicUnit(seed: number, key: string): number {
  let value = (hashString32(`${seed}:${key}`) || 1) >>> 0;
  value ^= value << 13; value >>>= 0;
  value ^= value >>> 17; value >>>= 0;
  value ^= value << 5; value >>>= 0;
  return (value >>> 0) / 4294967296;
}

function mobileBarsFromPercent(signalPercent: number): number {
  const signal = clamp(signalPercent, 0, 100);
  if (signal <= 0) return 0;
  if (signal < 25) return 1;
  if (signal < 50) return 2;
  if (signal < 75) return 3;
  return 4;
}

export interface MobileNetworkState {
  available: boolean;
  signalPercent: number;
  signalBars: number;
  callsAvailable: boolean;
  smsAvailable: boolean;
  dataAvailable: boolean;
}

export function getMobileNetworkState(state: GameState): MobileNetworkState {
  const mobile = state.infrastructure.mobile;
  const signalPercent = clamp(mobile.signalPercent ?? mobile.signal * 25, 0, 100);
  const available = mobile.available && signalPercent > 0;
  return {
    available,
    signalPercent,
    signalBars: available ? mobileBarsFromPercent(signalPercent) : 0,
    callsAvailable: available && signalPercent >= 20,
    smsAvailable: available && signalPercent >= 10,
    dataAvailable: available && signalPercent >= 30,
  };
}

export function isElectricityAvailable(state: GameState): boolean {
  return state.infrastructure.electricity.available && state.infrastructure.electricity.voltagePercent > 0;
}

export function isWaterAvailable(state: GameState): boolean {
  return state.infrastructure.water.available && state.infrastructure.water.pressure > 0;
}

export function isMobileAvailable(state: GameState): boolean {
  return getMobileNetworkState(state).available;
}

function autoTransitionId(network: Network, stage: Stage, transitionIndex: number): string {
  return `${AUTO_PREFIX}${network}:${stage}:${transitionIndex}`;
}

function transitionDelaySeconds(seed: number, network: Network, stage: Stage, transitionIndex: number): number {
  const profile = INFRASTRUCTURE_PROFILES[network][stage];
  const unit = deterministicUnit(seed, `${network}:home:${stage}:${transitionIndex}`);
  return Math.round(profile.minHours * 3600 + unit * ((profile.maxHours - profile.minHours) * 3600));
}

function unstableTransition(seed: number, network: Network, atSeconds: number): InfrastructureTransitionState {
  const quality = deterministicUnit(seed, `${network}:home:quality:0`);
  if (network === 'electricity') {
    return {
      id: autoTransitionId(network, 'on', 0), network, atSeconds, processed: false, available: true,
      voltagePercent: round(65 + quality * 27, 4),
    };
  }
  if (network === 'water') {
    return {
      id: autoTransitionId(network, 'on', 0), network, atSeconds, processed: false, available: true,
      pressure: round((30 + quality * 45) / 100, 6),
    };
  }
  const signalPercent = round(15 + quality * 45, 4);
  return {
    id: autoTransitionId(network, 'on', 0), network, atSeconds, processed: false, available: true,
    signalPercent,
    signal: mobileBarsFromPercent(signalPercent),
  };
}

function offTransition(network: Network, atSeconds: number): InfrastructureTransitionState {
  if (network === 'electricity') return { id: autoTransitionId(network, 'unstable', 1), network, atSeconds, processed: false, available: false, voltagePercent: 0 };
  if (network === 'water') return { id: autoTransitionId(network, 'unstable', 1), network, atSeconds, processed: false, available: false, pressure: 0 };
  return { id: autoTransitionId(network, 'unstable', 1), network, atSeconds, processed: false, available: false, signalPercent: 0, signal: 0 };
}

export function ensureAutonomousInfrastructureTransitions(state: GameState): InfrastructureTransitionState[] {
  if (!Number.isFinite(state.engine.infrastructureSeed)) state.engine.infrastructureSeed = INFRASTRUCTURE_SEED;
  if (typeof state.engine.infrastructureSimulationEnabled !== 'boolean') state.engine.infrastructureSimulationEnabled = true;
  if (!state.infrastructure.transitions) state.infrastructure.transitions = [];
  if (!state.engine.infrastructureSimulationEnabled) return [];

  const existing = state.infrastructure.transitions.filter((transition) => transition.id.startsWith(AUTO_PREFIX));
  if (existing.length > 0) return existing;

  const seed = Math.floor(state.engine.infrastructureSeed ?? INFRASTRUCTURE_SEED);
  const generated: InfrastructureTransitionState[] = [];
  for (const network of ['electricity', 'water', 'mobile'] as const) {
    const firstAt = state.engine.elapsedSeconds + transitionDelaySeconds(seed, network, 'on', 0);
    const secondAt = firstAt + transitionDelaySeconds(seed, network, 'unstable', 1);
    generated.push(unstableTransition(seed, network, firstAt), offTransition(network, secondAt));
  }
  state.infrastructure.transitions.push(...generated);
  state.infrastructure.transitions.sort((a, b) => a.atSeconds - b.atSeconds || a.id.localeCompare(b.id));
  return generated;
}

export function setInfrastructureSeed(state: GameState, seed: number | string, reschedule = true): number {
  const parsed = Number(seed);
  state.engine.infrastructureSeed = Number.isFinite(parsed) ? Math.floor(parsed) : hashString32(String(seed));
  if (reschedule) {
    state.infrastructure.transitions = (state.infrastructure.transitions ?? []).filter((transition) => !transition.id.startsWith(AUTO_PREFIX));
    ensureAutonomousInfrastructureTransitions(state);
  }
  return state.engine.infrastructureSeed;
}

function cancelFutureAutonomousTransitions(state: GameState, network: Network): void {
  state.infrastructure.transitions = (state.infrastructure.transitions ?? []).filter(
    (transition) => transition.network !== network || !transition.id.startsWith(AUTO_PREFIX) || transition.processed,
  );
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
    if (transition.signalPercent !== undefined) state.infrastructure.mobile.signalPercent = clamp(transition.signalPercent, 0, 100);
    else if (!transition.available) state.infrastructure.mobile.signalPercent = 0;
    const percent = state.infrastructure.mobile.signalPercent ?? state.infrastructure.mobile.signal * 25;
    if (transition.signal !== undefined) state.infrastructure.mobile.signal = clamp(transition.signal, 0, 4);
    else state.infrastructure.mobile.signal = transition.available ? mobileBarsFromPercent(percent) : 0;
  }
  transition.processed = true;

  if (!transition.id.startsWith(AUTO_PREFIX) && !transition.available) cancelFutureAutonomousTransitions(state, transition.network);
}

export function applyDueInfrastructureTransitions(state: GameState): InfrastructureTransitionState[] {
  const due = (state.infrastructure.transitions ?? [])
    .filter((transition) => !transition.processed && transition.atSeconds <= state.engine.elapsedSeconds)
    .sort((a, b) => a.atSeconds - b.atSeconds || a.id.localeCompare(b.id));
  const applied: InfrastructureTransitionState[] = [];
  for (const transition of due) {
    if (!(state.infrastructure.transitions ?? []).includes(transition)) continue;
    applyTransition(state, transition);
    applied.push(transition);
  }
  return applied;
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
