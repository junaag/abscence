import { describe, expect, it } from 'vitest';
import { getContextActions, performAction } from '../../src/engine/actions';
import { createInitialState } from '../../src/engine/state';

describe('modular action dispatcher', () => {
  it('keeps the public action facade stable after domain split', () => {
    const state = createInitialState();
    expect(getContextActions(state).some((action) => action.id === 'MOVE')).toBe(true);
    const transition = performAction(state, { id: 'MOVE', targetId: 'kitchen' });
    expect(transition.result.success).toBe(true);
    expect(transition.state.player.locationId).toBe('kitchen');
  });

  it('keeps failed actions transactional', () => {
    const state = createInitialState();
    const snapshot = structuredClone(state);
    const transition = performAction(state, { id: 'EAT_ITEM', targetId: 'apple_01' });
    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
    expect(state).toEqual(snapshot);
  });
});
