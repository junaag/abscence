import { describe, expect, it } from 'vitest';
import { addExploredMapArea, createDefaultMapUiState, loadMapUiState, MAP_STATE_KEY, normalizeMapUiState, saveMapUiState, updateMapViewport } from '../../src/app/map-state';

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
    });
  });

  it('persists viewport and explored areas independently from the game save', () => {
    const storage = new MemoryStorage();
    let state = updateMapViewport(createDefaultMapUiState(), 43.406, 5.056, 18);
    state = addExploredMapArea(state, { lat: 43.406, lng: 5.056, radiusM: 35 });
    saveMapUiState(state, storage);

    expect(loadMapUiState(storage)).toEqual(state);
    expect(storage.getItem(MAP_STATE_KEY)).not.toBeNull();
    expect(storage.getItem('absence-v020-dev')).toBeNull();
  });

  it('normalizes malformed values and never loses every explored area', () => {
    const normalized = normalizeMapUiState({ center: { lat: 200, lng: -400 }, zoom: 99, explored: [] });
    expect(normalized.center).toEqual({ lat: 85, lng: -180 });
    expect(normalized.zoom).toBe(20);
    expect(normalized.explored).toEqual([{ lat: 43.4053, lng: 5.0548, radiusM: 85 }]);
  });

  it('deduplicates identical explored circles', () => {
    const state = createDefaultMapUiState();
    const next = addExploredMapArea(state, { lat: 43.4053, lng: 5.0548, radiusM: 85 });
    expect(next.explored).toHaveLength(1);
  });
});
