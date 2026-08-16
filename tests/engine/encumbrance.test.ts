import { describe, expect, it } from 'vitest';
import { performAction } from '../../src/engine/actions';
import { getEncumbranceProfile } from '../../src/engine/encumbrance';
import type { GameState } from '../../src/engine/model';
import { createInitialState } from '../../src/engine/state';

function target(id: string, name: string, lat: number, lon: number): string {
  return encodeURIComponent(JSON.stringify({ id, name, lat, lon }));
}

function reachGarden(): GameState {
  let state = createInitialState();
  state = performAction(state, { id: 'MOVE', targetId: 'kitchen' }).state;
  state = performAction(state, { id: 'MOVE', targetId: 'garden' }).state;
  return state;
}

function addHeavyLoad(state: GameState): void {
  for (let index = 0; index < 4; index += 1) {
    const id = `test_water_${index}`;
    state.items[id] = {
      id,
      definitionId: 'water_bottle',
      name: `Bouteille test ${index + 1}`,
      location: { kind: 'inventory' },
      examined: false,
      liquidMl: 500,
      capacityMl: 500,
    };
    state.player.inventoryIds.push(id);
  }
}

function reachPoiInterior(): GameState {
  let state = reachGarden();
  state = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('node:load', 'Lieu test', 43.4055, 5.0549) }).state;
  state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
  state = performAction(state, { id: 'ENTER_POI' }).state;
  return state;
}

describe('encumbrance', () => {
  it('classifies carried load relative to current capacity', () => {
    const state = reachGarden();
    expect(getEncumbranceProfile(state).tier).toBe('light');
    addHeavyLoad(state);
    const profile = getEncumbranceProfile(state);
    expect(profile.load).toBeCloseTo(3.2, 5);
    expect(profile.capacity).toBe(4);
    expect(profile.ratio).toBeCloseTo(0.8, 5);
    expect(profile.tier).toBe('heavy');
    expect(profile.label).toBe('Charge lourde');
  });

  it('makes the same walk slower and more tiring when heavily loaded', () => {
    const base = reachGarden();
    const light = structuredClone(base);
    const heavy = structuredClone(base);
    addHeavyLoad(heavy);

    const lightBeforeFatigue = light.player.needs.fatigue;
    const heavyBeforeFatigue = heavy.player.needs.fatigue;
    const destination = target('walk', 'Rue / extérieur', 43.40555, 5.05495);
    const lightWalk = performAction(light, { id: 'WALK_TO_MAP_POINT', targetId: destination });
    const heavyWalk = performAction(heavy, { id: 'WALK_TO_MAP_POINT', targetId: destination });

    expect(heavyWalk.result.elapsedSeconds).toBeGreaterThan(lightWalk.result.elapsedSeconds);
    expect(heavyWalk.state.player.needs.fatigue - heavyBeforeFatigue)
      .toBeGreaterThan(lightWalk.state.player.needs.fatigue - lightBeforeFatigue);
    expect(heavyWalk.state.player.needs.thirst).toBeGreaterThan(lightWalk.state.player.needs.thirst);
    expect(heavyWalk.result.body).toContain('Charge lourde');
  });

  it('makes a methodical search take longer and add more fatigue under a heavy load', () => {
    const light = reachPoiInterior();
    const heavy = structuredClone(light);
    addHeavyLoad(heavy);
    const lightBeforeFatigue = light.player.needs.fatigue;
    const heavyBeforeFatigue = heavy.player.needs.fatigue;

    const lightSearch = performAction(light, { id: 'SEARCH_LOCATION' });
    const heavySearch = performAction(heavy, { id: 'SEARCH_LOCATION' });

    expect(lightSearch.result.elapsedSeconds).toBe(12 * 60);
    expect(heavySearch.result.elapsedSeconds).toBeGreaterThan(12 * 60);
    expect(heavySearch.state.player.needs.fatigue - heavyBeforeFatigue)
      .toBeGreaterThan(lightSearch.state.player.needs.fatigue - lightBeforeFatigue);
    expect(heavySearch.result.body).toContain('Charge lourde');
  });
});
