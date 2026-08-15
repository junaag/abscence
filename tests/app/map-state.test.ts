import { describe, expect, it } from 'vitest';
import { addExploredMapArea, addExploredMapCorridor, createDefaultMapUiState, loadMapUiState, MAP_STATE_KEY, normalizeMapUiState, saveMapUiState, updateMapViewport } from '../../src/app/map-state';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('map UI state', () => {
  it('starts around the historical Martigues home with an 85 m explored area', () => {
    expect(createDefaultMapUiState()).toEqual({
      center: { lat: 43.4053, lng: 5.0548 },
      zoom: 17,
      explored: [{ lat: 43.4053, lng: 5.0548, radiusM: 85 }],
      exploredCorridors: [],
    });
  });

  it('persists viewport areas and compact corridors independently from the game save', () => {
    const storage = new MemoryStorage();
    let state = updateMapViewport(createDefaultMapUiState(), 43.406, 5.056, 18);
    state = addExploredMapArea(state, { lat: 43.406, lng: 5.056, radiusM: 35 });
    state = addExploredMapCorridor(state, {
      radiusM: 9,
      points: [
        { lat: 43.4053, lng: 5.0548 },
        { lat: 43.4056, lng: 5.0551 },
        { lat: 43.406, lng: 5.056 },
      ],
    });
    saveMapUiState(state, storage);

    expect(loadMapUiState(storage)).toEqual(state);
    expect(storage.getItem(MAP_STATE_KEY)).not.toBeNull();
    expect(storage.getItem('absence-v020-dev')).toBeNull();
  });

  it('migrates the previous map state format without corridors', () => {
    const storage = new MemoryStorage();
    storage.setItem(MAP_STATE_KEY, JSON.stringify({
      center: { lat: 43.4054, lng: 5.0549 },
      zoom: 18,
      explored: [{ lat: 43.4053, lng: 5.0548, radiusM: 85 }],
    }));
    expect(loadMapUiState(storage).exploredCorridors).toEqual([]);
  });

  it('normalizes malformed values and never loses every explored area', () => {
    const normalized = normalizeMapUiState({ center: { lat: 200, lng: -400 }, zoom: 99, explored: [], exploredCorridors: [{ radiusM: 10, points: [{ lat: 1, lng: 1 }] }] });
    expect(normalized.center).toEqual({ lat: 85, lng: -180 });
    expect(normalized.zoom).toBe(20);
    expect(normalized.explored).toEqual([{ lat: 43.4053, lng: 5.0548, radiusM: 85 }]);
    expect(normalized.exploredCorridors).toEqual([]);
  });

  it('deduplicates identical explored circles and corridors', () => {
    let state = createDefaultMapUiState();
    state = addExploredMapArea(state, { lat: 43.4053, lng: 5.0548, radiusM: 85 });
    expect(state.explored).toHaveLength(1);
    const corridor = {
      radiusM: 8,
      points: [
        { lat: 43.4053, lng: 5.0548 },
        { lat: 43.4055, lng: 5.055 },
      ],
    };
    state = addExploredMapCorridor(state, corridor);
    state = addExploredMapCorridor(state, corridor);
    expect(state.exploredCorridors).toHaveLength(1);
  });

  it('caps corridor complexity and removes consecutive duplicate points', () => {
    const points = Array.from({ length: 80 }, (_, index) => ({ lat: 43.4053 + index / 100000, lng: 5.0548 }));
    points.splice(5, 0, { ...points[4]! });
    const state = addExploredMapCorridor(createDefaultMapUiState(), { radiusM: 500, points });
    expect(state.exploredCorridors[0]?.points).toHaveLength(64);
    expect(state.exploredCorridors[0]?.radiusM).toBe(100);
  });
});
