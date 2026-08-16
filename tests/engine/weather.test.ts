import { describe, expect, it } from 'vitest';
import { loadState, SAVE_KEY } from '../../src/engine/persistence';
import { createInitialState } from '../../src/engine/state';
import { createWeatherState, getWeatherState, setWeatherState } from '../../src/engine/weather';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('weather parity with historical engine v0.1.8', () => {
  it('restores exact historical defaults', () => {
    expect(getWeatherState(createInitialState())).toEqual({
      condition: 'clear',
      temperatureC: 23,
      humidityPct: 55,
      windKph: 8,
      precipitationMmPerHour: 0,
    });
  });

  it('normalizes the historical weather bounds', () => {
    expect(createWeatherState({
      condition: 'storm',
      temperatureC: 80,
      humidityPct: 120,
      windKph: -5,
      precipitationMmPerHour: -1,
    })).toEqual({
      condition: 'storm',
      temperatureC: 55,
      humidityPct: 100,
      windKph: 0,
      precipitationMmPerHour: 0,
    });
  });

  it('falls back an unknown condition to clear', () => {
    expect(createWeatherState({ condition: 'hail' as never }).condition).toBe('clear');
  });

  it('updates weather while preserving untouched fields', () => {
    const state = createInitialState();
    setWeatherState(state, { condition: 'rain', temperatureC: 17, precipitationMmPerHour: 4.2 });
    expect(getWeatherState(state)).toEqual({
      condition: 'rain',
      temperatureC: 17,
      humidityPct: 55,
      windKph: 8,
      precipitationMmPerHour: 4.2,
    });
  });

  it('migrates an older v0.2-dev save without weather state', () => {
    const storage = new MemoryStorage();
    const legacy = createInitialState();
    delete (legacy.world as typeof legacy.world & { weather?: unknown }).weather;
    storage.setItem(SAVE_KEY, JSON.stringify(legacy));

    const loaded = loadState(storage);
    expect(getWeatherState(loaded)).toEqual({
      condition: 'clear',
      temperatureC: 23,
      humidityPct: 55,
      windKph: 8,
      precipitationMmPerHour: 0,
    });
  });
});
