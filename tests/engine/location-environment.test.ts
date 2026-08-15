import { describe, expect, it } from 'vitest';
import { getLocationEnvironment, getLocationTemperatureC, getPlayerEnvironment, setLocationEnvironment } from '../../src/engine/location-environment';
import { loadState, saveState, SAVE_KEY } from '../../src/engine/persistence';
import { createInitialState } from '../../src/engine/state';
import { setWeatherState } from '../../src/engine/weather';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('historical location thermal environment', () => {
  it('uses indoor -2C and outdoor direct-weather defaults', () => {
    const state = createInitialState();
    setWeatherState(state, { temperatureC: 31, humidityPct: 68, windKph: 12 });
    expect(getLocationTemperatureC(state, 'bedroom')).toBe(29);
    expect(getLocationTemperatureC(state, 'kitchen')).toBe(29);
    expect(getLocationTemperatureC(state, 'garden')).toBe(31);
  });

  it('supports a custom indoor offset and a fixed local temperature', () => {
    const state = createInitialState();
    setWeatherState(state, { temperatureC: 34 });
    setLocationEnvironment(state, 'bedroom', { type: 'indoor', indoorTemperatureOffsetC: -5 });
    setLocationEnvironment(state, 'kitchen', { type: 'indoor', temperatureC: 22 });
    expect(getLocationTemperatureC(state, 'bedroom')).toBe(29);
    expect(getLocationTemperatureC(state, 'kitchen')).toBe(22);
  });

  it('uses global weather humidity, condition and wind for the player environment', () => {
    const state = createInitialState();
    state.player.locationId = 'garden';
    setWeatherState(state, { condition: 'rain', temperatureC: 19, humidityPct: 91, windKph: 27 });
    expect(getPlayerEnvironment(state)).toEqual({ locationId: 'garden', temperatureC: 19, humidityPct: 91, condition: 'rain', windKph: 27 });
  });

  it('persists explicit location environment configuration', () => {
    const storage = new MemoryStorage();
    const state = createInitialState();
    setLocationEnvironment(state, 'bedroom', { type: 'indoor', temperatureC: 22 });
    saveState(state, storage);
    const loaded = loadState(storage);
    expect(getLocationEnvironment(loaded, 'bedroom')).toEqual({ type: 'indoor', temperatureC: 22, indoorTemperatureOffsetC: -2 });
  });

  it('migrates an older v0.2 save without environment metadata', () => {
    const storage = new MemoryStorage();
    const state = createInitialState();
    for (const location of Object.values(state.locations) as Array<typeof state.locations[string] & { environment?: unknown }>) delete location.environment;
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    const loaded = loadState(storage);
    expect(getLocationEnvironment(loaded, 'bedroom')).toEqual({ type: 'indoor', indoorTemperatureOffsetC: -2 });
    expect(getLocationEnvironment(loaded, 'garden')).toEqual({ type: 'outdoor' });
  });
});
