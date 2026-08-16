import { describe, expect, it } from 'vitest';
import { getContextActions, performAction } from '../../src/engine/actions';
import { addPersistentEffect, findActiveEffect } from '../../src/engine/effects';
import type { GameState } from '../../src/engine/model';
import { createInitialState } from '../../src/engine/state';

function moveFixtureToInventory(state: GameState, itemId: string): void {
  const item = state.items[itemId];
  if (!item) throw new Error(`missing fixture ${itemId}`);
  item.location = { kind: 'inventory' };
  if (!state.player.inventoryIds.includes(itemId)) state.player.inventoryIds.push(itemId);
}

function inKitchen(): GameState {
  const state = createInitialState();
  state.player.locationId = 'kitchen';
  return state;
}

describe('persistent effect mitigation restored from engine v0.1.9', () => {
  it('mops 38 intensity points over 150 s while an active leak can refill the puddle', () => {
    const state = inKitchen();
    moveFixtureToInventory(state, 'towel_01');
    state.world.leakActive = true;
    const puddle = addPersistentEffect(state, 'water_puddle', 'kitchen', 60, { source: 'leak', spreading: false });

    const result = performAction(state, { id: 'MOP_EFFECT', targetId: puddle.id, sourceId: 'towel_01' });
    expect(result.result.success).toBe(true);
    expect(result.result.elapsedSeconds).toBe(150);
    expect(findActiveEffect(result.state, 'water_puddle', 'kitchen')?.intensity).toBeCloseTo(33.25, 5);
  });

  it('opens ventilation, removes 18 smoke points and then lets ventilation act for 20 s', () => {
    const state = inKitchen();
    const smoke = addPersistentEffect(state, 'smoke', 'kitchen', 50, { spreading: false });

    const result = performAction(state, { id: 'VENTILATE_EFFECT', targetId: smoke.id });
    expect(result.result.success).toBe(true);
    expect(result.result.elapsedSeconds).toBe(20);
    expect(result.state.world.windowsOpen.kitchen).toBe(true);
    expect(findActiveEffect(result.state, 'smoke', 'kitchen')?.intensity).toBeCloseTo(30.951333, 5);
  });

  it('uses 250 ml and removes 48 fire intensity points in 15 s', () => {
    const state = inKitchen();
    moveFixtureToInventory(state, 'water_01');
    const fire = addPersistentEffect(state, 'fire', 'kitchen', 40, { spreading: false });

    const result = performAction(state, { id: 'DOUSE_EFFECT', targetId: fire.id, sourceId: 'water_01' });
    expect(result.result.success).toBe(true);
    expect(result.result.elapsedSeconds).toBe(15);
    expect(result.state.items.water_01?.liquidMl).toBe(250);
    expect(findActiveEffect(result.state, 'fire', 'kitchen')).toBeUndefined();
  });

  it('silences a persistent source completely in 25 s', () => {
    const state = inKitchen();
    const noise = addPersistentEffect(state, 'persistent_noise', 'kitchen', 58, { spreading: false });
    const result = performAction(state, { id: 'SILENCE_EFFECT', targetId: noise.id });
    expect(result.result.success).toBe(true);
    expect(result.result.elapsedSeconds).toBe(25);
    expect(findActiveEffect(result.state, 'persistent_noise', 'kitchen')).toBeUndefined();
  });

  it('stops the kitchen leak in 18 s and leaves existing water to dry', () => {
    const state = inKitchen();
    state.world.leakActive = true;
    addPersistentEffect(state, 'water_puddle', 'kitchen', 18, { source: 'leak', spreading: false });
    const result = performAction(state, { id: 'STOP_LEAK' });
    expect(result.result.success).toBe(true);
    expect(result.result.elapsedSeconds).toBe(18);
    expect(result.state.world.leakActive).toBe(false);
    expect(findActiveEffect(result.state, 'water_puddle', 'kitchen')?.intensity).toBeCloseTo(17.895, 5);
  });

  it('does not mutate state when trying to douse without enough carried water', () => {
    const state = inKitchen();
    const fire = addPersistentEffect(state, 'fire', 'kitchen', 40, { spreading: false });
    const result = performAction(state, { id: 'DOUSE_EFFECT', targetId: fire.id, sourceId: 'water_01' });
    expect(result.result.success).toBe(false);
    expect(result.state).toBe(state);
  });

  it('only exposes resource-dependent mitigation actions when requirements are carried', () => {
    const state = inKitchen();
    const puddle = addPersistentEffect(state, 'water_puddle', 'kitchen', 30, { spreading: false });
    const fire = addPersistentEffect(state, 'fire', 'kitchen', 30, { spreading: false });
    let actions = getContextActions(state);
    expect(actions.some((action) => action.id === 'MOP_EFFECT' && action.targetId === puddle.id)).toBe(false);
    expect(actions.some((action) => action.id === 'DOUSE_EFFECT' && action.targetId === fire.id)).toBe(false);

    moveFixtureToInventory(state, 'towel_01');
    moveFixtureToInventory(state, 'water_01');
    actions = getContextActions(state);
    expect(actions.some((action) => action.id === 'MOP_EFFECT' && action.sourceId === 'towel_01')).toBe(true);
    expect(actions.some((action) => action.id === 'DOUSE_EFFECT' && action.sourceId === 'water_01')).toBe(true);
  });
});
