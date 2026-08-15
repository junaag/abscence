import { LEGACY_PREVIEW_SAVE_KEYS, loadLegacyPreviewMigration, loadState, saveState, SAVE_KEY, type GameState } from '../engine';
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

function loadGameState(storage: Storage): GameState {
  if (storage.getItem(SAVE_KEY)) return loadState(storage);

  const hasHistoricalCandidate = LEGACY_PREVIEW_SAVE_KEYS.some((key) => storage.getItem(key) !== null);
  if (!hasHistoricalCandidate) return loadState(storage);

  const migration = loadLegacyPreviewMigration(storage);
  if (!migration) return loadState(storage);

  saveState(migration.state, storage);
  return migration.state;
}

export function createBrowserPersistence(storage: Storage): GamePersistence {
  return {
    load: () => loadGameState(storage),
    save: (state) => saveState(state, storage),
    loadPreferences: () => loadUiPreferences(storage),
    savePreferences: (preferences) => saveUiPreferences(preferences, storage),
    loadMapState: () => loadMapUiState(storage),
    saveMapState: (state) => saveMapUiState(state, storage),
  };
}
