import { describe, expect, it } from 'vitest';
import { addPersistentEffect, activeEffectsAt, findActiveEffect } from '../../src/engine/effects';
import { validateState } from '../../src/engine/invariants';
import { createInitialState } from '../../src/engine/state';
import { advanceTime } from '../../src/engine/time';
import { describeCurrentLocation } from '../../src/narrative/location';

describe('persistent world effects restored from v0.1.9', () => {
  it('decays and spreads smoke through open connections using local ventilation', () => {
    const state = createInitialState();
    addPersistentEffect(state, 'smoke', 'kitchen', 46, { source: 'distant_fire' });
    advanceTime(state, 60);
    expect(findActiveEffect(state, 'smoke', 'kitchen')?.intensity).toBeCloseTo(44.894, 6);
    expect(findActiveEffect(state, 'smoke', 'bedroom')?.intensity).toBeCloseTo(3.59152, 6);
    expect(findActiveEffect(state, 'smoke', 'garden')?.intensity).toBeCloseTo(3.59152, 6);
  });

  it('grows a leak-fed puddle and spreads water indoors but not into the garden', () => {
    const state = createInitialState();
    state.world.leakActive = true;
    addPersistentEffect(state, 'water_puddle', 'kitchen', 54, { source: 'leak' });
    advanceTime(state, 60);
    expect(findActiveEffect(state, 'water_puddle', 'kitchen')?.intensity).toBeCloseTo(58.5, 6);
    expect(findActiveEffect(state, 'water_puddle', 'bedroom')?.intensity).toBeCloseTo(14.625, 6);
    expect(findActiveEffect(state, 'water_puddle', 'garden')).toBeUndefined();
  });

  it('applies local persistent-noise stress and natural noise decay', () => {
    const state = createInitialState();
    addPersistentEffect(state, 'persistent_noise', 'bedroom', 58, { source: 'unattended_device' });
    advanceTime(state, 60);
    expect(findActiveEffect(state, 'persistent_noise', 'bedroom')?.intensity).toBeCloseTo(57.88, 6);
    expect(state.player.needs.stress).toBeCloseTo(23.447, 6);
  });

  it('lets a dangerous local fire create smoke and eventually consume PV', () => {
    const state = createInitialState();
    addPersistentEffect(state, 'fire', 'bedroom', 60, { source: 'test_fire' });
    advanceTime(state, 240);
    expect(findActiveEffect(state, 'fire', 'bedroom')?.intensity).toBeGreaterThan(60);
    expect(findActiveEffect(state, 'smoke', 'bedroom')).toBeDefined();
    expect(state.player.healthPv).toBeLessThan(100);
    expect(state.player.needs.stress).toBeGreaterThan(22);
  });

  it('does not apply local physiology from an effect in another location', () => {
    const state = createInitialState();
    addPersistentEffect(state, 'persistent_noise', 'kitchen', 58);
    advanceTime(state, 60);
    expect(state.player.needs.stress).toBe(22);
  });

  it('surfaces local effects in state-driven narrative', () => {
    const state = createInitialState();
    addPersistentEffect(state, 'smoke', 'bedroom', 70);
    expect(describeCurrentLocation(state)).toContain('fumée épaisse');
  });

  it('validates persistent-effect references and ranges', () => {
    const state = createInitialState();
    addPersistentEffect(state, 'smoke', 'bedroom', 20);
    const effect = activeEffectsAt(state, 'bedroom')[0];
    if (!effect) throw new Error('missing effect fixture');
    effect.locationId = 'missing_room';
    effect.intensity = 120;
    const codes = validateState(state).map((error) => error.code);
    expect(codes).toContain('EFFECT_LOCATION_MISSING');
    expect(codes).toContain('EFFECT_INTENSITY_INVALID');
  });

  it('triggers the unattended kitchen noise at exactly five minutes', () => {
    const state = createInitialState();
    advanceTime(state, 299);
    expect(findActiveEffect(state, 'persistent_noise', 'kitchen')).toBeUndefined();
    const result = advanceTime(state, 1);
    const noise = findActiveEffect(state, 'persistent_noise', 'kitchen');
    expect(noise?.intensity).toBe(58);
    expect(noise?.createdAtSeconds).toBe(300);
    expect(result.effects.startedEventIds).toContain('evt_noise');
  });

  it('starts the kitchen water leak at exactly twelve minutes', () => {
    const state = createInitialState();
    advanceTime(state, 719);
    expect(state.world.leakActive).toBe(false);
    advanceTime(state, 1);
    expect(state.world.leakActive).toBe(true);
    expect(findActiveEffect(state, 'water_puddle', 'kitchen')?.intensity).toBe(18);
    expect(state.world.eventHistory.at(-1)?.type).toBe('WORLD_WATER_LEAK');
  });

  it('starts the distant garden smoke at exactly twenty-five minutes and does not duplicate events', () => {
    const state = createInitialState();
    advanceTime(state, 1500);
    expect(findActiveEffect(state, 'smoke', 'garden')?.intensity).toBe(46);
    expect(state.world.eventHistory).toHaveLength(3);
    advanceTime(state, 600);
    expect(state.world.eventHistory).toHaveLength(3);
    expect(state.world.scheduledEvents.every((event) => event.processed)).toBe(true);
  });
});
