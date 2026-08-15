import type { GameState } from './model';
import { createInitialState } from './state';

export const SAVE_KEY = 'absence-v020-dev';

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<GameState>;
  return state.schemaVersion === 1 && state.gameVersion === '0.2.0-dev' && Boolean(state.player) && Boolean(state.locations) && Boolean(state.connections) && Boolean(state.containers) && Boolean(state.items);
}

export function loadState(storage: Pick<Storage, 'getItem'> = localStorage): GameState {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return createInitialState();
  try {
    const parsed: unknown = JSON.parse(raw);
    return isGameState(parsed) ? parsed : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state: GameState, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}
