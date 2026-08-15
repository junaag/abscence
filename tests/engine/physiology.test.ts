import { describe, expect, it } from 'vitest';
import { environmentPhysiologyModifiers, effectivePhysiologyRates } from '../../src/engine/physiology';
import { createInitialState } from '../../src/engine/state';
import { advanceTime } from '../../src/engine/time';

describe('physiology parity with historical engine v0.1.8', () => {
  it('keeps historical base rates in neutral 20C / 50% humidity conditions', () => {
    const state = createInitialState();
    const rates = effectivePhysiologyRates(state).rates;
    expect(rates.hunger).toBeCloseTo(1 / 25, 8);
    expect(rates.thirst).toBeCloseTo(1 / 15, 8);
    expect(rates.fatigue).toBeCloseTo(1 / 20, 8);
  });

  it('adds 1 hunger point every 25 minutes in neutral conditions', () => {
    const state = createInitialState(); const before = state.player.needs.hunger; advanceTime(state, 25 * 60); expect(state.player.needs.hunger).toBeCloseTo(before + 1, 5);
  });

  it('adds 1 thirst point every 15 minutes in neutral conditions', () => {
    const state = createInitialState(); const before = state.player.needs.thirst; advanceTime(state, 15 * 60); expect(state.player.needs.thirst).toBeCloseTo(before + 1, 5);
  });

  it('adds 1 fatigue point every 20 minutes in neutral conditions', () => {
    const state = createInitialState(); const before = state.player.needs.fatigue; advanceTime(state, 20 * 60); expect(state.player.needs.fatigue).toBeCloseTo(before + 1, 5);
  });

  it('reproduces exact heat and humidity multipliers at 32C / 70%', () => {
    const modifiers = environmentPhysiologyModifiers(32, 70);
    expect(modifiers.thirstMultiplier).toBeCloseTo(1.35, 6);
    expect(modifiers.fatigueMultiplier).toBeCloseTo(1.06, 6);
  });

  it('caps extreme heat modifiers at historical maxima', () => {
    const modifiers = environmentPhysiologyModifiers(60, 100);
    expect(modifiers.thirstMultiplier).toBeCloseTo(2.2, 6);
    expect(modifiers.fatigueMultiplier).toBeCloseTo(1.35, 6);
  });

  it('uses current location environment to accelerate thirst and fatigue', () => {
    const state = createInitialState();
    const bedroom = state.locations.bedroom;
    if (!bedroom) throw new Error('missing bedroom');
    bedroom.ambientTemperatureC = 32;
    bedroom.ambientHumidityPercent = 70;
    const before = { ...state.player.needs };
    advanceTime(state, 60 * 60);
    expect(state.player.needs.thirst - before.thirst).toBeCloseTo((1 / 15) * 1.35 * 60, 5);
    expect(state.player.needs.fatigue - before.fatigue).toBeCloseTo((1 / 20) * 1.06 * 60, 5);
    expect(state.player.needs.hunger - before.hunger).toBeCloseTo((1 / 25) * 60, 5);
  });

  it('reproduces the v0.1.8 critical thirst regression: 95% thirst for 30 min costs exactly 1 PV', () => {
    const state = createInitialState();
    state.player.healthPv = 100;
    state.player.needs = { hunger: 20, thirst: 95, fatigue: 10, stress: 0, pain: 0 };
    const result = advanceTime(state, 30 * 60);
    expect(result.healthLostPv).toBe(1);
    expect(state.player.healthPv).toBe(99);
    expect(state.player.needs.thirst).toBeCloseTo(97, 6);
    expect(state.engine.damageBudgetPv).toBe(0);
  });

  it('lets heat cross the critical thirst threshold earlier and therefore cause PV loss', () => {
    const neutral = createInitialState();
    const hot = createInitialState();
    neutral.player.needs.thirst = 88.5;
    hot.player.needs.thirst = 88.5;
    const hotBedroom = hot.locations.bedroom;
    if (!hotBedroom) throw new Error('missing bedroom');
    hotBedroom.ambientTemperatureC = 40;
    hotBedroom.ambientHumidityPercent = 100;
    advanceTime(neutral, 45 * 60);
    advanceTime(hot, 45 * 60);
    expect(neutral.player.healthPv).toBe(100);
    expect(hot.player.healthPv).toBe(99);
  });

  it('persists fractional damage between advances', () => {
    const state = createInitialState(); state.player.needs.thirst = 90; advanceTime(state, 10 * 60); expect(state.player.healthPv).toBe(100); expect(state.engine.damageBudgetPv).toBeCloseTo(1 / 3, 5); advanceTime(state, 21 * 60); expect(state.player.healthPv).toBe(99); expect(state.engine.damageBudgetPv).toBeGreaterThan(0); expect(state.engine.damageBudgetPv).toBeLessThan(0.05);
  });

  it('keeps clinically relevant outcomes stable across simulation chunk sizes despite historical 6-decimal rounding', () => {
    const oneChunk = createInitialState(); const manyChunks = createInitialState();
    for (const state of [oneChunk, manyChunks]) { state.player.healthPv = 100; state.player.needs = { hunger: 92, thirst: 94, fatigue: 40, stress: 10, pain: 2 }; }
    advanceTime(oneChunk, 6 * 60 * 60); for (let index = 0; index < 360; index += 1) advanceTime(manyChunks, 60);
    expect(manyChunks.player.healthPv).toBe(oneChunk.player.healthPv); expect(manyChunks.engine.damageBudgetPv).toBeCloseTo(oneChunk.engine.damageBudgetPv, 3);
    for (const key of ['hunger', 'thirst', 'fatigue', 'stress', 'pain'] as const) expect(manyChunks.player.needs[key]).toBeCloseTo(oneChunk.player.needs[key], 3);
  });

  it('sets alive to false when PV reach zero', () => {
    const state = createInitialState(); state.player.healthPv = 1; state.player.needs.thirst = 100; const result = advanceTime(state, 10 * 60); expect(result.healthLostPv).toBeGreaterThanOrEqual(1); expect(state.player.healthPv).toBe(0); expect(state.player.alive).toBe(false);
  });
});
