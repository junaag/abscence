import { loadState, saveState, type GameState } from '../engine';
import { loadUiPreferences, saveUiPreferences, type UiPreferences } from './preferences';

export interface GamePersistence {
  load(): GameState;
  save(state: GameState): void;
  loadPreferences(): UiPreferences;
  savePreferences(preferences: UiPreferences): void;
}

export function createBrowserPersistence(storage: Storage): GamePersistence {
  return {
    load: () => loadState(storage),
    save: (state) => saveState(state, storage),
    loadPreferences: () => loadUiPreferences(storage),
    savePreferences: (preferences) => saveUiPreferences(preferences, storage),
  };
}
