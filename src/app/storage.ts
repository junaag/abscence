import { loadState, saveState, type GameState } from '../engine';
import { loadMapUiState, saveMapUiState, type MapUiState } from './map-state';
import { loadUiPreferences, saveUiPreferences, type UiPreferences } from './preferences';

export interface GamePersistence {
  load(): GameState;
  save(state: GameState): void;
  loadPreferences(): UiPreferences;
  savePreferences(preferences: UiPreferences): void;
  loadMapState(): MapUiState;
  saveMapState(state: MapUiState): void;
}

export function createBrowserPersistence(storage: Storage): GamePersistence {
  return {
    load: () => loadState(storage),
    save: (state) => saveState(state, storage),
    loadPreferences: () => loadUiPreferences(storage),
    savePreferences: (preferences) => saveUiPreferences(preferences, storage),
    loadMapState: () => loadMapUiState(storage),
    saveMapState: (state) => saveMapUiState(state, storage),
  };
}
