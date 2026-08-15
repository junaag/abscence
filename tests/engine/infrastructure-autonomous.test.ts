import { describe, expect, it } from 'vitest';
import {
  applyDueInfrastructureTransitions,
  getMobileNetworkState,
  INFRASTRUCTURE_PROFILES,
  INFRASTRUCTURE_SEED,
  setInfrastructureSeed,
} from '../../src/engine/infrastructure';
import type { InfrastructureTransitionState } from '../../src/engine/model';
import { createInitialState } from '../../src/engine/state';

function autoTransitionsFor(state: ReturnType<typeof createInitialState>, network: InfrastructureTransitionState['network']) {
  return (state.infrastructure.transitions ?? [])
    .filter((transition) => transition.network === network && transition.id.startsWith('auto_infrastructure:'))
    .sort((a, b) => a.atSeconds - b.atSeconds);
}

describe('historical seeded autonomous infrastructure', () => {
  it('uses the v0.1.8 default seed and schedules all three networks', () => {
    const state = createInitialState();
    expect(state.engine.infrastructureSeed).toBe(INFRASTRUCTURE_SEED);
    expect(state.engine.infrastructureSimulationEnabled).toBe(true);
    expect(autoTransitionsFor(state, 'electricity')).toHaveLength(2);
    expect(autoTransitionsFor(state, 'water')).toHaveLength(2);
    expect(autoTransitionsFor(state, 'mobile')).toHaveLength(2);
  });

  it('keeps first and second transitions inside the exact historical hour ranges', () => {
    const state = createInitialState();
    for (const network of ['electricity', 'water', 'mobile'] as const) {
      const transitions = autoTransitionsFor(state, network);
      const first = transitions[0];
      const second = transitions[1];
      if (!first || !second) throw new Error(`missing ${network} schedule`);
      const firstHours = first.atSeconds / 3600;
      const secondStageHours = (second.atSeconds - first.atSeconds) / 3600;
      expect(firstHours).toBeGreaterThanOrEqual(INFRASTRUCTURE_PROFILES[network].on.minHours);
      expect(firstHours).toBeLessThanOrEqual(INFRASTRUCTURE_PROFILES[network].on.maxHours);
      expect(secondStageHours).toBeGreaterThanOrEqual(INFRASTRUCTURE_PROFILES[network].unstable.minHours);
      expect(secondStageHours).toBeLessThanOrEqual(INFRASTRUCTURE_PROFILES[network].unstable.maxHours);
    }
  });

  it('is deterministic for the same seed and changes schedule for another seed', () => {
    const first = createInitialState();
    const second = createInitialState();
    expect(second.infrastructure.transitions).toEqual(first.infrastructure.transitions);

    const before = autoTransitionsFor(first, 'electricity')[0]?.atSeconds;
    setInfrastructureSeed(first, 4242, true);
    const after = autoTransitionsFor(first, 'electricity')[0]?.atSeconds;
    expect(after).not.toBe(before);

    const third = createInitialState();
    setInfrastructureSeed(third, 4242, true);
    expect(third.infrastructure.transitions).toEqual(first.infrastructure.transitions);
  });

  it('applies the exact historical unstable quality bands', () => {
    const state = createInitialState();
    const electricity = autoTransitionsFor(state, 'electricity')[0];
    const water = autoTransitionsFor(state, 'water')[0];
    const mobile = autoTransitionsFor(state, 'mobile')[0];
    if (!electricity || !water || !mobile) throw new Error('missing unstable transitions');

    state.engine.elapsedSeconds = Math.max(electricity.atSeconds, water.atSeconds, mobile.atSeconds);
    applyDueInfrastructureTransitions(state);

    expect(state.infrastructure.electricity.voltagePercent).toBeGreaterThanOrEqual(65);
    expect(state.infrastructure.electricity.voltagePercent).toBeLessThanOrEqual(92);
    expect(state.infrastructure.water.pressure).toBeGreaterThanOrEqual(0.3);
    expect(state.infrastructure.water.pressure).toBeLessThanOrEqual(0.75);
    const mobileState = getMobileNetworkState(state);
    expect(mobileState.signalPercent).toBeGreaterThanOrEqual(15);
    expect(mobileState.signalPercent).toBeLessThanOrEqual(60);
    expect(mobileState.smsAvailable).toBe(mobileState.signalPercent >= 10);
    expect(mobileState.callsAvailable).toBe(mobileState.signalPercent >= 20);
    expect(mobileState.dataAvailable).toBe(mobileState.signalPercent >= 30);
  });

  it('transitions mobile from full service to unstable then off at exact boundaries', () => {
    const state = createInitialState();
    const [unstable, off] = autoTransitionsFor(state, 'mobile');
    if (!unstable || !off) throw new Error('missing mobile schedule');

    state.engine.elapsedSeconds = unstable.atSeconds - 1;
    applyDueInfrastructureTransitions(state);
    expect(getMobileNetworkState(state).signalPercent).toBe(100);

    state.engine.elapsedSeconds += 1;
    applyDueInfrastructureTransitions(state);
    const degraded = getMobileNetworkState(state);
    expect(degraded.available).toBe(true);
    expect(degraded.signalPercent).toBeGreaterThanOrEqual(15);
    expect(degraded.signalPercent).toBeLessThanOrEqual(60);

    state.engine.elapsedSeconds = off.atSeconds;
    applyDueInfrastructureTransitions(state);
    const down = getMobileNetworkState(state);
    expect(down.available).toBe(false);
    expect(down.signalPercent).toBe(0);
    expect(down.callsAvailable).toBe(false);
    expect(down.smsAvailable).toBe(false);
    expect(down.dataAvailable).toBe(false);
  });

  it('does not let a later autonomous transition resurrect a manually forced outage', () => {
    const state = createInitialState();
    const firstAuto = autoTransitionsFor(state, 'electricity')[0];
    if (!firstAuto) throw new Error('missing power schedule');
    state.infrastructure.transitions = [
      ...(state.infrastructure.transitions ?? []),
      { id: 'manual_power_off', network: 'electricity', atSeconds: firstAuto.atSeconds - 10, processed: false, available: false },
    ];

    state.engine.elapsedSeconds = firstAuto.atSeconds;
    applyDueInfrastructureTransitions(state);
    expect(state.infrastructure.electricity.available).toBe(false);
    expect(state.infrastructure.electricity.voltagePercent).toBe(0);
    expect(autoTransitionsFor(state, 'electricity').every((transition) => transition.processed)).toBe(true);
  });
});
