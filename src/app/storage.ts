import { LEGACY_PREVIEW_SAVE_KEYS, loadLegacyPreviewMigration, loadState, saveState, SAVE_KEY, type GameState } from '../engine';
import { loadMapUiState, saveMapUiState, type MapUiState } from './map-state';
import { loadUiPreferences, saveUiPreferences, type UiPreferences } from './preferences';

export interface GamePersistence {
  load(): GameState;
  save(state: GameState): boolean;
  loadPreferences(): UiPreferences;
  savePreferences(preferences: UiPreferences): boolean;
  loadMapState(): MapUiState;
  saveMapState(state: MapUiState): boolean;
  hasStorageFailure(): boolean;
}

class BrowserStorageWriteError extends Error {
  constructor(readonly originalError: unknown) {
    super('Browser storage write failed.');
    this.name = 'BrowserStorageWriteError';
  }
}

interface GuardedBrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function createGuardedBrowserStorage(storage: Storage, reportFailure: (error: unknown) => void): GuardedBrowserStorage {
  return {
    getItem(key: string): string | null {
      try {
        return storage.getItem(key);
      } catch (error: unknown) {
        reportFailure(error);
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        storage.setItem(key, value);
      } catch (error: unknown) {
        reportFailure(error);
        throw new BrowserStorageWriteError(error);
      }
    },
  };
}

function persistSafely(operation: () => void): boolean {
  try {
    operation();
    return true;
  } catch (error: unknown) {
    if (!(error instanceof BrowserStorageWriteError)) throw error;
    console.error('ABSENCE could not persist data in browser storage.', error.originalError);
    return false;
  }
}

function loadGameState(storage: GuardedBrowserStorage, persist: (operation: () => void) => boolean): GameState {
  if (storage.getItem(SAVE_KEY)) return loadState(storage);

  const hasHistoricalCandidate = LEGACY_PREVIEW_SAVE_KEYS.some((key) => storage.getItem(key) !== null);
  if (!hasHistoricalCandidate) return loadState(storage);

  const migration = loadLegacyPreviewMigration(storage);
  if (!migration) return loadState(storage);

  persist(() => saveState(migration.state, storage));
  return migration.state;
}

export function createBrowserPersistence(storage: Storage): GamePersistence {
  let storageFailure = false;
  const reportFailure = (): void => { storageFailure = true; };
  const guardedStorage = createGuardedBrowserStorage(storage, reportFailure);
  const persist = (operation: () => void): boolean => persistSafely(operation);

  return {
    load: () => loadGameState(guardedStorage, persist),
    save: (state) => persist(() => saveState(state, guardedStorage)),
    loadPreferences: () => loadUiPreferences(guardedStorage),
    savePreferences: (preferences) => persist(() => saveUiPreferences(preferences, guardedStorage)),
    loadMapState: () => loadMapUiState(guardedStorage),
    saveMapState: (state) => persist(() => saveMapUiState(state, guardedStorage)),
    hasStorageFailure: () => storageFailure,
  };
}
