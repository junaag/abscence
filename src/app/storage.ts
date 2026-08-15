import { loadState, saveState, type GameState } from '../engine';

export interface GamePersistence {
  load(): GameState;
  save(state: GameState): void;
}

export function createBrowserPersistence(storage: Storage): GamePersistence {
  return {
    load: () => loadState(storage),
    save: (state) => saveState(state, storage),
  };
}
