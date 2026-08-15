import { describe, expect, it } from 'vitest';
import { performAction } from '../../src/engine/actions';
import { createInitialState } from '../../src/engine/state';

describe('engine transition immutability', () => {
  it('does not mutate the input state on a successful action', () => {
    const before = createInitialState();
    const snapshot = structuredClone(before);
    const transition = performAction(before, { id: 'MOVE', targetId: 'kitchen' });
    expect(transition.result.success).toBe(true);
    expect(before).toEqual(snapshot);
    expect(transition.state).not.toBe(before);
    expect(transition.state.player.locationId).toBe('kitchen');
  });

  it('does not mutate the input state on a failed action', () => {
    const before = createInitialState();
    const snapshot = structuredClone(before);
    const transition = performAction(before, { id: 'EAT_ITEM', targetId: 'apple_01' });
    expect(transition.result.success).toBe(false);
    expect(before).toEqual(snapshot);
  });
});
