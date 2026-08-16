import { GAME_VERSION, SAVE_SCHEMA_VERSION } from '../version';
import { assertValidState } from './invariants';
import { assertValidLocationEnvironmentState } from './location-environment-validation';
import type { GameState } from './model';
import { assertValidPhoneState } from './phone-validation';
import { normalizePersistedGameState } from './save-normalization';
import { createInitialState } from './state';

export const SAVE_KEY = 'absence-v020-prologue-r2';

export interface ReadStorage {
  getItem(key: string): string | null;
}

export interface WriteStorage {
  setItem(key: string, value: string): void;
}

export function loadState(storage: ReadStorage): GameState {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return createInitialState();
  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizePersistedGameState(parsed) ?? createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state: GameState, storage: WriteStorage): void {
  assertValidState(state);
  assertValidLocationEnvironmentState(state);
  assertValidPhoneState(state);
  const persisted = structuredClone(state);
  persisted.schemaVersion = SAVE_SCHEMA_VERSION;
  persisted.gameVersion = GAME_VERSION;
  storage.setItem(SAVE_KEY, JSON.stringify(persisted));
}
