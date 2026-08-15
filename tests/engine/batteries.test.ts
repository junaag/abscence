import { describe, expect, it } from 'vitest';
import { getItemActions, performAction } from '../../src/engine/actions';
import type { GameState, ItemState } from '../../src/engine/model';
import { createInitialState } from '../../src/engine/state';
import { advanceTime } from '../../src/engine/time';

function addInventoryItem(state: GameState, item: ItemState): void { state.items[item.id] = item; state.player.inventoryIds.push(item.id); }
function addOutlet(state: GameState): void { state.items.outlet_01 = { id: 'outlet_01', definitionId: 'wall_outlet', name: 'Prise électrique', location: { kind: 'location', id: 'kitchen' }, examined: false }; }

describe('generic battery resources from engine v0.1.8', () => {
  it('starts the smartphone at the historical 78% charge and spends 0.03% per use', () => {
    const state = createInitialState();
    expect(state.items.phone_01?.batteryPercent).toBe(78);
    const result = performAction(state, { id: 'USE_ITEM', targetId: 'phone_01' });
    expect(result.result.success).toBe(true);
    expect(result.result.elapsedSeconds).toBe(3);
    expect(result.state.items.phone_01?.batteryPercent).toBeCloseTo(77.97, 5);
  });

  it('blocks use at 0% charge', () => {
    const state = createInitialState();
    if (!state.items.phone_01) throw new Error('missing phone');
    state.items.phone_01.batteryPercent = 0;
    const result = performAction(state, { id: 'USE_ITEM', targetId: 'phone_01' });
    expect(result.result.success).toBe(false);
    expect(result.state).toBe(state);
  });

  it('drains an enabled flashlight by 0.25 percentage point per minute and switches it off at zero', () => {
    const state = createInitialState();
    addInventoryItem(state, { id: 'flashlight_01', definitionId: 'flashlight', name: 'Lampe torche', location: { kind: 'inventory' }, examined: false, batteryPercent: 0.1, enabled: true });
    advanceTime(state, 60);
    expect(state.items.flashlight_01?.batteryPercent).toBe(0);
    expect(state.items.flashlight_01?.enabled).toBe(false);
  });

  it('toggles a flashlight through the same generic USE_ITEM action', () => {
    const state = createInitialState();
    addInventoryItem(state, { id: 'flashlight_01', definitionId: 'flashlight', name: 'Lampe torche', location: { kind: 'inventory' }, examined: false, batteryPercent: 64, enabled: false });
    const result = performAction(state, { id: 'USE_ITEM', targetId: 'flashlight_01' });
    expect(result.result.success).toBe(true);
    expect(result.state.items.flashlight_01?.enabled).toBe(true);
    expect(result.state.items.flashlight_01?.batteryPercent).toBeLessThan(63.99);
  });

  it('charges a rechargeable item from a powered generic source', () => {
    let state = createInitialState();
    addOutlet(state);
    state = performAction(state, { id: 'MOVE', targetId: 'kitchen' }).state;
    const actions = getItemActions(state, 'phone_01');
    const charge = actions.find((action) => action.id === 'CHARGE_ITEM');
    expect(charge?.sourceId).toBe('outlet_01');
    const result = performAction(state, { id: 'CHARGE_ITEM', targetId: 'phone_01', sourceId: 'outlet_01' });
    expect(result.result.success).toBe(true);
    expect(result.result.elapsedSeconds).toBe(660);
    expect(result.state.items.phone_01?.batteryPercent).toBe(100);
  });

  it('cannot charge when electricity is unavailable', () => {
    let state = createInitialState();
    addOutlet(state);
    state = performAction(state, { id: 'MOVE', targetId: 'kitchen' }).state;
    state.infrastructure.electricity.available = false;
    state.infrastructure.electricity.voltagePercent = 0;
    const result = performAction(state, { id: 'CHARGE_ITEM', targetId: 'phone_01', sourceId: 'outlet_01' });
    expect(result.result.success).toBe(false);
    expect(result.state).toBe(state);
  });

  it('interrupts a long recharge exactly when electricity goes off', () => {
    let state = createInitialState();
    addOutlet(state);
    state = performAction(state, { id: 'MOVE', targetId: 'kitchen' }).state;
    state.infrastructure.transitions = [{
      id: 'power_off_during_charge',
      network: 'electricity',
      atSeconds: state.engine.elapsedSeconds + 120,
      processed: false,
      available: false,
      voltagePercent: 0,
    }];
    const result = performAction(state, { id: 'CHARGE_ITEM', targetId: 'phone_01', sourceId: 'outlet_01', seconds: 600 });
    expect(result.result.success).toBe(true);
    expect(result.result.elapsedSeconds).toBe(120);
    expect(result.state.items.phone_01?.batteryPercent).toBeCloseTo(82, 5);
    expect(result.state.infrastructure.electricity.available).toBe(false);
    expect(result.state.infrastructure.transitions?.[0]?.processed).toBe(true);
  });
});
