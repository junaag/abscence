import { describe, expect, it } from 'vitest';
import { performAction } from '../../src/engine/actions';
import { applyDueInfrastructureTransitions, isElectricityAvailable, secondsUntilNextInfrastructureTransition } from '../../src/engine/infrastructure';
import type { GameState } from '../../src/engine/model';
import { createInitialState } from '../../src/engine/state';

function addOutlet(state: GameState): void {
  state.items.outlet_01 = { id: 'outlet_01', definitionId: 'wall_outlet', name: 'Prise électrique', location: { kind: 'location', id: 'kitchen' }, examined: false };
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
});
