import { ensureAutonomousInfrastructureTransitions } from './infrastructure';
import { assertValidState, validateState } from './invariants';
import type { GameState } from './model';
import { ensurePhoneState } from './phone';
import { assertValidPhoneState, validatePhoneState } from './phone-validation';
import { createInitialState } from './state';
import { ensureWeatherState } from './weather';
import { ensureWorldEventSimulationState } from './world-events';

export const SAVE_KEY = 'absence-v020-dev';

export interface ReadStorage {
  getItem(key: string): string | null;
}

export interface WriteStorage {
  setItem(key: string, value: string): void;
}

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<GameState>;
  return state.schemaVersion === 1 && state.gameVersion === '0.2.0-dev' && Boolean(state.player) && Boolean(state.locations) && Boolean(state.connections) && Boolean(state.containers) && Boolean(state.items);
}

export function loadState(storage: ReadStorage): GameState {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return createInitialState();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isGameState(parsed)) return createInitialState();
    ensureAutonomousInfrastructureTransitions(parsed);
    ensureWorldEventSimulationState(parsed);
    ensureWeatherState(parsed);
    ensurePhoneState(parsed);
    return validateState(parsed).length === 0 && validatePhoneState(parsed).length === 0 ? parsed : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state: GameState, storage: WriteStorage): void {
  assertValidState(state);
  assertValidPhoneState(state);
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}
