import type { GameState } from './model';
import { assertValidState, validateState } from './invariants';
import { createInitialState } from './state';

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
    return validateState(parsed).length === 0 ? parsed : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state: GameState, storage: WriteStorage): void {
  assertValidState(state);
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}
