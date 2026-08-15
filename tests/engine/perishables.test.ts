import { describe, expect, it } from 'vitest';
import { advancePerishables, getItemStorageTemperatureC, temperatureSpoilageMultiplier } from '../../src/engine/perishables';
import { createInitialState } from '../../src/engine/state';

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

  it('starts the apple at the historical 94% freshness and loses 0.2 point per hour at 20C', () => {
    const state = createInitialState();
    expect(state.items.apple_01?.freshnessPercent).toBe(94);
    const changes = advancePerishables(state, 3600);
    expect(state.items.apple_01?.freshnessPercent).toBeCloseTo(93.8, 6);
    expect(changes[0]?.storageTemperatureC).toBe(20);
  });

  it('uses the powered refrigerator target of 4C at sufficient voltage', () => {
    const state = putAppleInFridge();
    expect(getItemStorageTemperatureC(state, 'apple_01')).toBe(4);
    advancePerishables(state, 3600);
    expect(state.items.apple_01?.freshnessPercent).toBeCloseTo(93.95, 6);
  });

  it('falls back to room temperature when refrigerator voltage is below 70%', () => {
    const state = putAppleInFridge();
    state.infrastructure.electricity.voltagePercent = 69;
    expect(getItemStorageTemperatureC(state, 'apple_01')).toBe(20);
    advancePerishables(state, 3600);
    expect(state.items.apple_01?.freshnessPercent).toBeCloseTo(93.8, 6);
  });

  it('falls back to room temperature when electricity is unavailable', () => {
    const state = putAppleInFridge();
    state.infrastructure.electricity.phase = 'off';
    state.infrastructure.electricity.voltagePercent = 0;
    expect(getItemStorageTemperatureC(state, 'apple_01')).toBe(20);
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
