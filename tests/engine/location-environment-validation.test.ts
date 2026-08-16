import { describe, expect, it } from 'vitest';
import { validateLocationEnvironmentState } from '../../src/engine/location-environment-validation';
import { loadState, saveState, SAVE_KEY } from '../../src/engine/persistence';
import { createInitialState } from '../../src/engine/state';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

type MutableEnvironment = { type?: unknown; temperatureC?: unknown; indoorTemperatureOffsetC?: unknown };
type LocationWithEnvironment = (ReturnType<typeof createInitialState>)['locations'][string] & { environment?: MutableEnvironment };

function bedroomEnvironment(state: ReturnType<typeof createInitialState>): MutableEnvironment {
  const bedroom = state.locations.bedroom as LocationWithEnvironment | undefined;
  if (!bedroom?.environment) throw new Error('missing bedroom environment');
  return bedroom.environment;
}

describe('location thermal environment validation', () => {
  it('accepts the canonical initial environment metadata', () => {
    expect(validateLocationEnvironmentState(createInitialState())).toEqual([]);
  });

  it('rejects an invalid environment type before normalization can hide it', () => {
    const state = createInitialState();
    bedroomEnvironment(state).type = 'spaceship';
    expect(validateLocationEnvironmentState(state).map((error) => error.code)).toContain('LOCATION_ENVIRONMENT_TYPE_INVALID');
  });

  it('rejects non-finite fixed temperatures and indoor offsets', () => {
    const state = createInitialState();
    const environment = bedroomEnvironment(state);
    environment.temperatureC = Number.NaN;
    environment.indoorTemperatureOffsetC = Number.POSITIVE_INFINITY;
    const codes = validateLocationEnvironmentState(state).map((error) => error.code);
    expect(codes).toContain('LOCATION_ENVIRONMENT_TEMPERATURE_INVALID');
    expect(codes).toContain('LOCATION_ENVIRONMENT_OFFSET_INVALID');
  });

  it('rejects an indoor-only offset on an outdoor location', () => {
    const state = createInitialState();
    const garden = state.locations.garden as LocationWithEnvironment | undefined;
    if (!garden?.environment) throw new Error('missing garden environment');
    garden.environment.indoorTemperatureOffsetC = -2;
    expect(validateLocationEnvironmentState(state).map((error) => error.code)).toContain('LOCATION_ENVIRONMENT_OUTDOOR_OFFSET_INVALID');
  });

  it('refuses to save a corrupted environment state', () => {
    const state = createInitialState();
    bedroomEnvironment(state).type = 'invalid';
    expect(() => saveState(state, new MemoryStorage())).toThrow(/LOCATION_ENVIRONMENT_TYPE_INVALID/);
  });

  it('recovers safely when a persisted v0.2 save contains corrupted environment metadata', () => {
    const storage = new MemoryStorage();
    const corrupted = createInitialState();
    corrupted.player.healthPv = 51;
    bedroomEnvironment(corrupted).type = 'invalid';
    storage.setItem(SAVE_KEY, JSON.stringify(corrupted));

    const loaded = loadState(storage);
    expect(loaded.player.healthPv).toBe(100);
    expect(validateLocationEnvironmentState(loaded)).toEqual([]);
  });
});
