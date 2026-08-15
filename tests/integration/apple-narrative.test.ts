import { describe, expect, it } from 'vitest';
import { performAction } from '../../src/engine/actions';
import { createInitialState } from '../../src/engine/state';
import { describeCurrentLocation } from '../../src/narrative/location';

describe('state-driven narrative', () => {
  it('stops mentioning the apple after it has been taken and eaten', () => { let state=createInitialState(); state=performAction(state,{id:'MOVE',targetId:'kitchen'}).state; expect(describeCurrentLocation(state).toLowerCase()).toContain('pomme'); state=performAction(state,{id:'TAKE_ITEM',targetId:'apple_01'}).state; state=performAction(state,{id:'EAT_ITEM',targetId:'apple_01'}).state; expect(describeCurrentLocation(state).toLowerCase()).not.toContain('pomme'); });
});
