import { describe, expect, it } from 'vitest';
import {
  createVerticalSliceState,
  dispatchVerticalSlice,
  getVerticalSliceSnapshot,
} from '../../src/engine/vertical-slice';

describe('core gameplay vertical slice', () => {
  it('moves locally without mutating the previous state', () => {
    const initial = createVerticalSliceState();
    const transition = dispatchVerticalSlice(initial, { type: 'MOVE', dxM: 1, dyM: 0 });

    expect(transition.result.success).toBe(true);
    expect(initial.scene.playerPosition).toEqual({ x: 2, y: 4 });
    expect(transition.state.scene.playerPosition).toEqual({ x: 3, y: 4 });
    expect(transition.result.events[0]?.type).toBe('moved');
  });

  it('caps one movement command to the configured step limit', () => {
    const initial = createVerticalSliceState();
    const transition = dispatchVerticalSlice(initial, { type: 'MOVE', dxM: 10, dyM: 0 });

    expect(transition.state.scene.playerPosition.x).toBe(3.5);
    expect(transition.state.scene.playerPosition.y).toBe(4);
  });

  it('shooting consumes ammunition, applies damage and creates persistent noise', () => {
    const initial = createVerticalSliceState();
    const transition = dispatchVerticalSlice(initial, { type: 'SHOOT', targetId: 'wood_panel' });
    const snapshot = getVerticalSliceSnapshot(transition.state);
    const target = snapshot.targets.find((candidate) => candidate.id === 'wood_panel');

    expect(transition.result.success).toBe(true);
    expect(snapshot.weapon.ammo).toBe(11);
    expect(target?.healthPv).toBe(10);
    expect(snapshot.effects.some((effect) => effect.type === 'persistent_noise')).toBe(true);
  });

  it('destroying a water pipe starts a persistent water effect', () => {
    let state = createVerticalSliceState();
    state = dispatchVerticalSlice(state, { type: 'SHOOT', targetId: 'water_pipe' }).state;
    const transition = dispatchVerticalSlice(state, { type: 'SHOOT', targetId: 'water_pipe' });
    const snapshot = getVerticalSliceSnapshot(transition.state);
    const target = snapshot.targets.find((candidate) => candidate.id === 'water_pipe');

    expect(target?.destroyed).toBe(true);
    expect(snapshot.effects.some((effect) => effect.type === 'water_puddle')).toBe(true);
  });

  it('destruction can start smoke and fire using the existing persistent-effect engine', () => {
    let state = createVerticalSliceState();
    state = dispatchVerticalSlice(state, { type: 'SHOOT', targetId: 'power_box' }).state;
    state = dispatchVerticalSlice(state, { type: 'SHOOT', targetId: 'power_box' }).state;
    state = dispatchVerticalSlice(state, { type: 'SHOOT', targetId: 'fuel_canister' }).state;
    const snapshot = getVerticalSliceSnapshot(state);

    expect(snapshot.effects.some((effect) => effect.type === 'smoke')).toBe(true);
    expect(snapshot.effects.some((effect) => effect.type === 'fire')).toBe(true);
  });

  it('does not consume ammunition when a shot cannot be performed', () => {
    const initial = createVerticalSliceState();
    initial.scene.weapon.rangeM = 1;
    const transition = dispatchVerticalSlice(initial, { type: 'SHOOT', targetId: 'water_pipe' });

    expect(transition.result.success).toBe(false);
    expect(transition.state.scene.weapon.ammo).toBe(12);
  });
});
