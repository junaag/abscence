import { describe, expect, it } from 'vitest';
import { getContextActions, performAction } from '../../src/engine/actions';
import { validateState } from '../../src/engine/invariants';
import { createInitialState } from '../../src/engine/state';

describe('connection parity with engine v0.1.8', () => {
  it('requires a closed connection to be opened before movement', () => {
    const state = createInitialState();
    const connection = state.connections.bedroom_kitchen;
    if (!connection) throw new Error('missing test connection');
    connection.open = false;

    const moveWhileClosed = performAction(state, { id: 'MOVE', targetId: 'kitchen' });
    expect(moveWhileClosed.result.success).toBe(false);
    expect(moveWhileClosed.state).toBe(state);

    const options = getContextActions(state);
    expect(options.some((option) => option.id === 'OPEN_CONNECTION' && option.targetId === connection.id)).toBe(true);
    expect(options.some((option) => option.id === 'MOVE' && option.targetId === 'kitchen')).toBe(false);

    const opened = performAction(state, { id: 'OPEN_CONNECTION', targetId: connection.id });
    expect(opened.result.success).toBe(true);
    expect(opened.result.elapsedSeconds).toBe(connection.openSeconds);
    expect(opened.state.connections.bedroom_kitchen?.open).toBe(true);
    expect(validateState(opened.state)).toEqual([]);

    const moved = performAction(opened.state, { id: 'MOVE', targetId: 'kitchen' });
    expect(moved.result.success).toBe(true);
    expect(moved.result.elapsedSeconds).toBe(connection.travelSeconds);
    expect(moved.state.player.locationId).toBe('kitchen');
    expect(validateState(moved.state)).toEqual([]);
  });

  it('does not open or traverse a locked connection', () => {
    const state = createInitialState();
    const connection = state.connections.bedroom_kitchen;
    if (!connection) throw new Error('missing test connection');
    connection.open = false;
    connection.locked = true;

    expect(getContextActions(state).some((option) => option.targetId === 'kitchen' || option.targetId === connection.id)).toBe(false);
    expect(performAction(state, { id: 'OPEN_CONNECTION', targetId: connection.id }).result.success).toBe(false);
    expect(performAction(state, { id: 'MOVE', targetId: 'kitchen' }).result.success).toBe(false);
  });

  it('rejects opening a non-adjacent connection', () => {
    const state = createInitialState();
    const connection = state.connections.kitchen_garden;
    if (!connection) throw new Error('missing test connection');
    connection.open = false;
    expect(performAction(state, { id: 'OPEN_CONNECTION', targetId: connection.id }).result.success).toBe(false);
  });
});
