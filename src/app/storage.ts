import { loadState, saveState, type GameState } from '../engine';
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

export function createBrowserPersistence(storage: Storage): GamePersistence {
  let storageFailure = false;
  const reportFailure = (): void => { storageFailure = true; };
  const guardedStorage = createGuardedBrowserStorage(storage, reportFailure);
  const persist = (operation: () => void): boolean => persistSafely(operation);

  return {
    load: () => loadState(guardedStorage),
    save: (state) => persist(() => saveState(state, guardedStorage)),
    loadPreferences: () => loadUiPreferences(guardedStorage),
    savePreferences: (preferences) => persist(() => saveUiPreferences(preferences, guardedStorage)),
    loadMapState: () => loadMapUiState(guardedStorage),
    saveMapState: (state) => persist(() => saveMapUiState(state, guardedStorage)),
    hasStorageFailure: () => storageFailure,
  };
}
