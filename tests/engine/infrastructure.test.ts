import { describe, expect, it } from 'vitest';
import { performAction } from '../../src/engine/actions';
import { applyDueInfrastructureTransitions, isElectricityAvailable, isMobileAvailable, isWaterAvailable, secondsUntilNextInfrastructureTransition } from '../../src/engine/infrastructure';
import type { GameState } from '../../src/engine/model';
import { createInitialState } from '../../src/engine/state';
import { advanceTime } from '../../src/engine/time';
import { hasRunningTap } from '../../src/engine/selectors';

function addOutlet(state: GameState): void {
  state.items.outlet_01 = { id: 'outlet_01', definitionId: 'wall_outlet', name: 'Prise électrique', location: { kind: 'location', id: 'kitchen' }, examined: false };
}

function putAppleInFridge(state: GameState): void {
  const apple = state.items.apple_01;
  const fridge = state.containers.kitchen_fridge;
  if (!apple || !fridge) throw new Error('missing perishable fixture');
  apple.location = { kind: 'container', id: fridge.id };
  fridge.contentIds.push(apple.id);
}

describe('deterministic infrastructure transitions', () => {
  it('applies a due electricity transition exactly once', () => {
    const state = createInitialState();
    state.infrastructure.transitions = [{ id: 'power_off', network: 'electricity', atSeconds: 60, processed: false, available: false }];
    expect(secondsUntilNextInfrastructureTransition(state, 300)).toBe(60);
    state.engine.elapsedSeconds = 60;
    const applied = applyDueInfrastructureTransitions(state);
    expect(applied.map((transition) => transition.id)).toEqual(['power_off']);
    expect(isElectricityAvailable(state)).toBe(false);
    expect(state.infrastructure.electricity.voltagePercent).toBe(0);
    expect(applyDueInfrastructureTransitions(state)).toEqual([]);
  });

  it('interrupts a long recharge when electricity becomes unavailable', () => {
    let state = createInitialState();
    addOutlet(state);
    state = performAction(state, { id: 'MOVE', targetId: 'kitchen' }).state;
    state.infrastructure.transitions = [{ id: 'power_off', network: 'electricity', atSeconds: state.engine.elapsedSeconds + 300, processed: false, available: false }];
    const result = performAction(state, { id: 'CHARGE_ITEM', targetId: 'phone_01', sourceId: 'outlet_01' });
    expect(result.result.success).toBe(true);
    expect(result.result.elapsedSeconds).toBe(300);
    expect(result.state.items.phone_01?.batteryPercent).toBeCloseTo(88, 4);
    expect(result.state.infrastructure.electricity.available).toBe(false);
    expect(result.result.body).toContain('interrompue');
  });

  it('applies network transitions during ordinary time advancement at the exact boundary', () => {
    const state = createInitialState();
    state.infrastructure.transitions = [
      { id: 'water_off', network: 'water', atSeconds: 120, processed: false, available: false },
      { id: 'mobile_off', network: 'mobile', atSeconds: 180, processed: false, available: false },
    ];
    state.player.locationId = 'kitchen';

    advanceTime(state, 119);
    expect(isWaterAvailable(state)).toBe(true);
    expect(hasRunningTap(state)).toBe(true);
    advanceTime(state, 1);
    expect(isWaterAvailable(state)).toBe(false);
    expect(hasRunningTap(state)).toBe(false);
    advanceTime(state, 60);
    expect(isMobileAvailable(state)).toBe(false);
    expect(state.infrastructure.transitions.every((transition) => transition.processed)).toBe(true);
  });

  it('segments refrigerator spoilage around an exact power outage', () => {
    const state = createInitialState();
    putAppleInFridge(state);
    state.infrastructure.transitions = [{ id: 'power_off', network: 'electricity', atSeconds: 3600, processed: false, available: false }];

    advanceTime(state, 7200);

    expect(state.infrastructure.electricity.available).toBe(false);
    // 1 h refrigerated at 4 C, then 1 h at the historical default kitchen temperature of 21 C.
    expect(state.items.apple_01?.freshnessPercent).toBeCloseTo(93.738, 6);
  });
});
