import { describe, expect, it } from 'vitest';
import { getContainerActions, getContextActions, performAction } from '../../src/engine/actions';
import { validateState } from '../../src/engine/invariants';
import { createInitialState } from '../../src/engine/state';
import type { GameState } from '../../src/engine/model';

function carrySpareKey(state: GameState, keyCode: string): string {
  const key = state.items.spare_key_01;
  const drawer = state.containers.bedroom_drawer;
  if (!key || !drawer) throw new Error('Missing lock test fixtures');
  drawer.contentIds = drawer.contentIds.filter((id) => id !== key.id);
  key.location = { kind: 'inventory' };
  key.keyCode = keyCode;
  if (!state.player.inventoryIds.includes(key.id)) state.player.inventoryIds.push(key.id);
  return key.id;
}

describe('generic key and lock system', () => {
  it('unlocks a connection with a matching carried key, without opening it automatically', () => {
    const state = createInitialState();
    const keyId = carrySpareKey(state, 'home-door-a');
    const connection = state.connections.bedroom_kitchen;
    if (!connection) throw new Error('Missing test connection');
    connection.open = false;
    connection.locked = true;
    connection.lockCode = 'home-door-a';

    expect(validateState(state)).toEqual([]);
    expect(getContextActions(state)).toContainEqual(expect.objectContaining({
      id: 'UNLOCK_TARGET', targetId: connection.id, sourceId: keyId,
    }));

    const unlocked = performAction(state, { id: 'UNLOCK_TARGET', targetId: connection.id, sourceId: keyId });
    expect(unlocked.result.success).toBe(true);
    expect(unlocked.result.elapsedSeconds).toBe(4);
    expect(unlocked.state.connections.bedroom_kitchen?.locked).toBe(false);
    expect(unlocked.state.connections.bedroom_kitchen?.open).toBe(false);
    expect(validateState(unlocked.state)).toEqual([]);

    const opened = performAction(unlocked.state, { id: 'OPEN_CONNECTION', targetId: connection.id });
    expect(opened.result.success).toBe(true);
    expect(opened.state.connections.bedroom_kitchen?.open).toBe(true);
  });

  it('does not expose or accept an incompatible key', () => {
    const state = createInitialState();
    const keyId = carrySpareKey(state, 'wrong-key');
    const connection = state.connections.bedroom_kitchen;
    if (!connection) throw new Error('Missing test connection');
    connection.open = false;
    connection.locked = true;
    connection.lockCode = 'needed-key';

    expect(getContextActions(state).some((option) => option.id === 'UNLOCK_TARGET' && option.targetId === connection.id)).toBe(false);
    const failed = performAction(state, { id: 'UNLOCK_TARGET', targetId: connection.id, sourceId: keyId });
    expect(failed.result.success).toBe(false);
    expect(failed.state).toBe(state);
    expect(connection.locked).toBe(true);
  });

  it('uses the same lock mechanism for containers, then keeps opening as a distinct action', () => {
    const state = createInitialState();
    const keyId = carrySpareKey(state, 'drawer-a');
    const drawer = state.containers.bedroom_drawer;
    if (!drawer) throw new Error('Missing test drawer');
    drawer.open = false;
    drawer.locked = true;
    drawer.lockCode = 'drawer-a';

    expect(getContainerActions(state, drawer.id)).toContainEqual(expect.objectContaining({
      id: 'UNLOCK_TARGET', targetId: drawer.id, sourceId: keyId,
    }));

    const unlocked = performAction(state, { id: 'UNLOCK_TARGET', targetId: drawer.id, sourceId: keyId });
    expect(unlocked.result.success).toBe(true);
    expect(unlocked.state.containers.bedroom_drawer?.locked).toBe(false);
    expect(unlocked.state.containers.bedroom_drawer?.open).toBe(false);
    expect(getContainerActions(unlocked.state, drawer.id)).toContainEqual(expect.objectContaining({ id: 'OPEN_CONTAINER' }));
  });
});
