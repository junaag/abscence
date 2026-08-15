import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/engine/state';
import { advanceTime } from '../../src/engine/time';

describe('physiology parity with historical engine v0.1.8', () => {
  it('adds 1 hunger point every 25 minutes', () => {
    const state = createInitialState();
    const before = state.player.needs.hunger;
    advanceTime(state, 25 * 60);
    expect(state.player.needs.hunger).toBeCloseTo(before + 1, 5);
  });

  it('adds 1 thirst point every 15 minutes', () => {
    const state = createInitialState();
    const before = state.player.needs.thirst;
    advanceTime(state, 15 * 60);
    expect(state.player.needs.thirst).toBeCloseTo(before + 1, 5);
  });

  it('adds 1 fatigue point every 20 minutes', () => {
    const state = createInitialState();
    const before = state.player.needs.fatigue;
    advanceTime(state, 20 * 60);
    expect(state.player.needs.fatigue).toBeCloseTo(before + 1, 5);
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

  it('persists fractional damage between advances', () => {
    const state = createInitialState();
    state.player.needs.thirst = 90;
    advanceTime(state, 10 * 60);
    expect(state.player.healthPv).toBe(100);
    expect(state.engine.damageBudgetPv).toBeCloseTo(1 / 3, 5);
    advanceTime(state, 21 * 60);
    expect(state.player.healthPv).toBe(99);
    expect(state.engine.damageBudgetPv).toBeGreaterThan(0);
    expect(state.engine.damageBudgetPv).toBeLessThan(0.05);
  });

  it('keeps clinically relevant outcomes stable across simulation chunk sizes despite historical 6-decimal rounding', () => {
    const oneChunk = createInitialState();
    const manyChunks = createInitialState();
    for (const state of [oneChunk, manyChunks]) {
      state.player.healthPv = 100;
      state.player.needs = { hunger: 92, thirst: 94, fatigue: 40, stress: 10, pain: 2 };
    }
    advanceTime(oneChunk, 6 * 60 * 60);
    for (let index = 0; index < 360; index += 1) advanceTime(manyChunks, 60);
    expect(manyChunks.player.healthPv).toBe(oneChunk.player.healthPv);
    expect(manyChunks.engine.damageBudgetPv).toBeCloseTo(oneChunk.engine.damageBudgetPv, 3);
    for (const key of ['hunger', 'thirst', 'fatigue', 'stress', 'pain'] as const) {
      expect(manyChunks.player.needs[key]).toBeCloseTo(oneChunk.player.needs[key], 3);
    }
  });

  it('sets alive to false when PV reach zero', () => {
    const state = createInitialState();
    state.player.healthPv = 1;
    state.player.needs.thirst = 100;
    const result = advanceTime(state, 10 * 60);
    expect(result.healthLostPv).toBeGreaterThanOrEqual(1);
    expect(state.player.healthPv).toBe(0);
    expect(state.player.alive).toBe(false);
  });
});
