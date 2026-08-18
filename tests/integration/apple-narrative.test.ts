import { describe, expect, it } from 'vitest';
import { performAction } from '../../src/engine/actions';
import { createInitialState } from '../../src/engine/state';
import { describeCurrentLocation, describeImmediateConcern } from '../../src/narrative/location';

describe('state-driven narrative', () => {
  it('opens on amnesia and the flash without inventing known family context', () => {
    const state = createInitialState();
    const text = describeCurrentLocation(state).toLowerCase();
    expect(text).toContain('flash');
    expect(text).toContain('aucun nom');
    expect(text).not.toContain('épouse');
    expect(text).not.toContain('fille');
  });

  it('stops mentioning the apple after it is eaten directly where it lies', () => {
    let state=createInitialState();
    state=performAction(state,{id:'MOVE',targetId:'kitchen'}).state;
    expect(describeCurrentLocation(state).toLowerCase()).toContain('pomme');
    state=performAction(state,{id:'EAT_ITEM',targetId:'apple_01'}).state;
    expect(describeCurrentLocation(state).toLowerCase()).not.toContain('pomme');
  });

  it('does not prescribe a next action in the situation narrative', () => {
    const state=createInitialState();
    expect(describeImmediateConcern(state)).toBe('');
    const text=describeCurrentLocation(state).toLowerCase();
    expect(text).not.toContain('vous devriez');
    expect(text).not.toContain('prochaine vérification');
    expect(text).not.toContain('naturel serait');
  });

  it('uses a shorter description when returning to a known place', () => {
    let state=createInitialState();
    const firstBedroom=describeCurrentLocation(state);
    state=performAction(state,{id:'MOVE',targetId:'kitchen'}).state;
    state=performAction(state,{id:'MOVE',targetId:'bedroom'}).state;
    const revisit=describeCurrentLocation(state);
    expect(revisit.length).toBeLessThan(firstBedroom.length);
    expect(revisit).toContain('retrouvez la chambre');
  });
});
