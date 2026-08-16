import { describe, expect, it } from 'vitest';
import { getLocationTemperatureC, setLocationEnvironment } from '../../src/engine/location-environment';
import {
  advancePerishables,
  getItemStorageTemperatureC,
  perishableSpoilageMultiplier,
  temperatureSpoilageMultiplier,
} from '../../src/engine/perishables';
import { createInitialState } from '../../src/engine/state';
import { setWeatherState } from '../../src/engine/weather';

function putAppleInFridge() {
  const state = createInitialState();
  const apple = state.items.apple_01;
  const fridge = state.containers.kitchen_fridge;
  if (!apple || !fridge) throw new Error('missing perishable fixture');
  apple.location = { kind: 'container', id: fridge.id };
  fridge.contentIds.push(apple.id);
  return state;
}

describe('perishable storage', () => {
  it('reproduces the historical temperature multiplier curve', () => {
    expect(temperatureSpoilageMultiplier(4)).toBeCloseTo(0.25, 6);
    expect(temperatureSpoilageMultiplier(10)).toBeCloseTo(0.45, 6);
    expect(temperatureSpoilageMultiplier(20)).toBeCloseTo(1, 6);
    expect(temperatureSpoilageMultiplier(30)).toBeCloseTo(1.6, 6);
    expect(temperatureSpoilageMultiplier(40)).toBeCloseTo(2.4, 6);
    expect(temperatureSpoilageMultiplier(50)).toBeCloseTo(3, 6);
  });

  it('uses the historical refrigerator rule as min(thermal multiplier, refrigerated multiplier)', () => {
    expect(perishableSpoilageMultiplier(10, 0.25, true)).toBeCloseTo(0.25, 6);
    expect(perishableSpoilageMultiplier(10, 0.25, false)).toBeCloseTo(0.45, 6);
    expect(perishableSpoilageMultiplier(4, 0.25, true)).toBeCloseTo(0.25, 6);
  });

  it('uses the historical default indoor temperature of 21C for loose kitchen food', () => {
    const state = createInitialState();
    expect(state.items.apple_01?.freshnessPercent).toBe(94);
    expect(getLocationTemperatureC(state, 'kitchen')).toBe(21);
    const changes = advancePerishables(state, 3600);
    expect(state.items.apple_01?.freshnessPercent).toBeCloseTo(93.788, 6);
    expect(changes[0]?.storageTemperatureC).toBe(21);
    expect(changes[0]?.storageMultiplier).toBeCloseTo(1.06, 6);
  });

  it('uses outdoor weather directly for hot storage', () => {
    const state = createInitialState();
    const apple = state.items.apple_01;
    if (!apple) throw new Error('missing apple');
    apple.location = { kind: 'location', id: 'garden' };
    setWeatherState(state, { temperatureC: 35 });
    const changes = advancePerishables(state, 24 * 3600);
    expect(changes[0]?.storageTemperatureC).toBe(35);
    expect(changes[0]?.storageMultiplier).toBe(2);
    expect(apple.freshnessPercent).toBeCloseTo(84.4, 6);
  });

  it('uses the powered refrigerator target of 4C and historical 0.25 cap', () => {
    const state = putAppleInFridge();
    expect(getItemStorageTemperatureC(state, 'apple_01')).toBe(4);
    const changes = advancePerishables(state, 3600);
    expect(state.items.apple_01?.freshnessPercent).toBeCloseTo(93.95, 6);
    expect(changes[0]?.storageMultiplier).toBe(0.25);
  });

  it('matches the v0.1.8 24-hour refrigerated apple regression', () => {
    const state = putAppleInFridge();
    advancePerishables(state, 24 * 3600);
    expect(state.items.apple_01?.freshnessPercent).toBeCloseTo(92.8, 6);
  });

  it('falls back to real kitchen temperature when refrigerator voltage is below 70%', () => {
    const state = putAppleInFridge();
    setWeatherState(state, { temperatureC: 30 });
    state.infrastructure.electricity.voltagePercent = 69;
    expect(getItemStorageTemperatureC(state, 'apple_01')).toBe(28);
    const changes = advancePerishables(state, 3600);
    expect(changes[0]?.storageTemperatureC).toBe(28);
    expect(changes[0]?.storageMultiplier).toBeCloseTo(1.48, 6);
  });

  it('falls back to fixed room temperature when electricity is unavailable', () => {
    const state = putAppleInFridge();
    setLocationEnvironment(state, 'kitchen', { type: 'indoor', temperatureC: 32 });
    setWeatherState(state, { temperatureC: 38 });
    state.infrastructure.electricity.available = false;
    state.infrastructure.electricity.voltagePercent = 0;
    expect(getItemStorageTemperatureC(state, 'apple_01')).toBe(32);
  });

  it('does not degrade consumed food', () => {
    const state = createInitialState();
    const apple = state.items.apple_01;
    if (!apple) throw new Error('missing apple');
    apple.location = { kind: 'consumed' };
    advancePerishables(state, 24 * 3600);
    expect(apple.freshnessPercent).toBe(94);
  });
});
