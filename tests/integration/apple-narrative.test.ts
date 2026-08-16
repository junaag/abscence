import { describe, expect, it } from 'vitest';
import { performAction } from '../../src/engine/actions';
import { createInitialState } from '../../src/engine/state';
import { describeCurrentLocation, describeImmediateConcern } from '../../src/narrative/location';

describe('state-driven narrative', () => {
  it('stops mentioning the apple after it is eaten directly where it lies', () => {
    let state=createInitialState();
    state=performAction(state,{id:'MOVE',targetId:'kitchen'}).state;
    expect(describeCurrentLocation(state).toLowerCase()).toContain('pomme');
    state=performAction(state,{id:'EAT_ITEM',targetId:'apple_01'}).state;
    expect(describeCurrentLocation(state).toLowerCase()).not.toContain('pomme');
  });

  it('moves the early concern from calling out to phone contact to exterior verification', () => {
    let state=createInitialState();
    expect(describeImmediateConcern(state)).toContain('appelé personne à haute voix');

    state=performAction(state,{id:'SHOUT_FOR_WIFE'}).state;
    expect(describeImmediateConcern(state)).toContain('téléphone fonctionne encore');

    state=performAction(state,{id:'CALL_CONTACT',targetId:'wife'}).state;
    expect(describeImmediateConcern(state)).toContain('regarder dehors depuis le jardin');

    state=performAction(state,{id:'MOVE',targetId:'kitchen'}).state;
    state=performAction(state,{id:'MOVE',targetId:'garden'}).state;
    expect(describeImmediateConcern(state)).toContain('prochaine vérification naturelle est la rue');

    state=performAction(state,{id:'OPEN_CONNECTION',targetId:'garden_street'}).state;
    state=performAction(state,{id:'MOVE',targetId:'street'}).state;
    expect(describeImmediateConcern(state)).toContain('La rue confirme');
  });
});
