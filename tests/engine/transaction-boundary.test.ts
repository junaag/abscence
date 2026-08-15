import { describe, expect, it } from 'vitest';
import { performAction } from '../../src/engine/actions';
import { createInitialState } from '../../src/engine/state';

describe('transactional gameplay boundary', () => {
  it('returns a distinct valid state after a successful action', () => {
    const state = createInitialState();
    const transition = performAction(state, { id: 'MOVE', targetId: 'kitchen' });
    expect(transition.result.success).toBe(true);
    expect(transition.state).not.toBe(state);
    expect(state.player.locationId).toBe('bedroom');
    expect(transition.state.player.locationId).toBe('kitchen');
  });

  it('returns the exact input state after a failed action', () => {
    const state = createInitialState();
    const transition = performAction(state, { id: 'EAT_ITEM', targetId: 'apple_01' });
    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
  });

  it('refuses to execute gameplay against a structurally inconsistent state', () => {
    const state = createInitialState();
    state.player.inventoryIds.push('apple_01');
    expect(() => performAction(state, { id: 'WAIT', seconds: 60 })).toThrow(/Invalid ABSENCE game state/);
  });
});
