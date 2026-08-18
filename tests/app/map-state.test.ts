import { describe, expect, it } from 'vitest';
import {
  addExploredMapArea,
  addExploredMapCorridor,
  createDefaultMapUiState,
  loadMapUiState,
  MAP_STATE_KEY,
  normalizeMapUiState,
  saveMapUiState,
  updateMapViewport,
} from '../../src/app/map-state';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('Zone Alpha map UI state', () => {
  it('starts on Maison 1 with a tight 18 m explored area', () => {
    expect(createDefaultMapUiState()).toEqual({
      center: { x: 72, y: 344 },
      zoom: 1.35,
      explored: [{ x: 72, y: 344, radiusM: 18 }],
      exploredCorridors: [],
    });
  });

  it('persists local viewport, areas and corridors independently from the game save', () => {
    const storage = new MemoryStorage();
    let state = updateMapViewport(createDefaultMapUiState(), 142, 336, 1.6);
    state = addExploredMapArea(state, { x: 142, y: 336, radiusM: 16 });
    state = addExploredMapCorridor(state, {
      radiusM: 7,
      points: [
        { x: 72, y: 344 },
        { x: 98, y: 338 },
        { x: 142, y: 336 },
      ],
    });
    saveMapUiState(state, storage);

    expect(loadMapUiState(storage)).toEqual(state);
    expect(storage.getItem(MAP_STATE_KEY)).not.toBeNull();
    expect(storage.getItem('absence-v030-zone-alpha-r1')).toBeNull();
  });

  it('loads a valid local map state without corridors', () => {
    const storage = new MemoryStorage();
    storage.setItem(MAP_STATE_KEY, JSON.stringify({
      center: { x: 150, y: 300 },
      zoom: 1.5,
      explored: [{ x: 72, y: 344, radiusM: 18 }],
    }));
    expect(loadMapUiState(storage).exploredCorridors).toEqual([]);
  });

  it('normalizes malformed values and never loses every explored area', () => {
    const normalized = normalizeMapUiState({ center: { x: 9999, y: -9999 }, zoom: 99, explored: [], exploredCorridors: [{ radiusM: 10, points: [{ x: 1, y: 1 }] }] });
    expect(normalized.center).toEqual({ x: 620, y: -100 });
    expect(normalized.zoom).toBe(2.8);
    expect(normalized.explored).toEqual([{ x: 72, y: 344, radiusM: 18 }]);
    expect(normalized.exploredCorridors).toEqual([]);
  });

  it('deduplicates identical explored circles and corridors', () => {
    let state = createDefaultMapUiState();
    state = addExploredMapArea(state, { x: 72, y: 344, radiusM: 18 });
    expect(state.explored).toHaveLength(1);
    const corridor = {
      radiusM: 7,
      points: [
        { x: 72, y: 344 },
        { x: 100, y: 344 },
      ],
    };
    state = addExploredMapCorridor(state, corridor);
    state = addExploredMapCorridor(state, corridor);
    expect(state.exploredCorridors).toHaveLength(1);
  });

  it('caps corridor complexity and removes consecutive duplicate points', () => {
    const points = Array.from({ length: 80 }, (_, index) => ({ x: 72 + index, y: 344 }));
    points.splice(5, 0, { ...points[4]! });
    const state = addExploredMapCorridor(createDefaultMapUiState(), { radiusM: 500, points });
    expect(state.exploredCorridors[0]?.points).toHaveLength(64);
    expect(state.exploredCorridors[0]?.radiusM).toBe(100);
  });
});
