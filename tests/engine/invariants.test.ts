import { describe, expect, it } from 'vitest';
import { performAction } from '../../src/engine/actions';
import { validateState } from '../../src/engine/invariants';
import { createInitialState } from '../../src/engine/state';

describe('game-state invariants', () => {
  it('accepts the initial state', () => {
    expect(validateState(createInitialState())).toEqual([]);
  });

  it('detects an inventory/location contradiction', () => {
    const state = createInitialState();
    state.player.inventoryIds.push('apple_01');
    expect(validateState(state).map((error) => error.code)).toContain('INVENTORY_LOCATION_MISMATCH');
  });

  it('detects a container/content contradiction', () => {
    const state = createInitialState();
    state.containers.bedroom_drawer?.contentIds.push('apple_01');
    expect(validateState(state).map((error) => error.code)).toContain('CONTAINER_LOCATION_MISMATCH');
  });

  it('remains valid through a representative action sequence', () => {
    let state = createInitialState();
    const actions = [
      { id: 'MOVE', targetId: 'kitchen' },
      { id: 'TAKE_ITEM', targetId: 'apple_01' },
      { id: 'EAT_ITEM', targetId: 'apple_01' },
      { id: 'TAKE_ITEM', targetId: 'water_01' },
      { id: 'DRINK_ITEM', targetId: 'water_01', amountMl: 250 },
      { id: 'FILL_LIQUID_CONTAINER', targetId: 'water_01' },
      { id: 'MOVE', targetId: 'bedroom' },
      { id: 'OPEN_CONTAINER', targetId: 'bedroom_drawer' },
      { id: 'TAKE_ITEM', targetId: 'spare_key_01' },
    ] as const;
    for (const action of actions) {
      const transition = performAction(state, action);
      expect(transition.result.success).toBe(true);
      state = transition.state;
      expect(validateState(state)).toEqual([]);
    }
  });
});
