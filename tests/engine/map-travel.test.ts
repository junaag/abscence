import { describe, expect, it } from 'vitest';
import { getContextActions, performAction } from '../../src/engine/actions';
import { createInitialState } from '../../src/engine/state';

function target(id: string, name: string, x: number, y: number): string {
  return encodeURIComponent(JSON.stringify({ id, name, x, y }));
}

function reachGarden() {
  let state = createInitialState();
  state = performAction(state, { id: 'MOVE', targetId: 'kitchen' }).state;
  state = performAction(state, { id: 'MOVE', targetId: 'garden' }).state;
  return state;
}

function reachPoi() {
  let state = reachGarden();
  state = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('poi:test', 'Lieu test', 190, 336) }).state;
  return state;
}

describe('Zone Alpha map travel', () => {
  it('requires an exterior position before map travel', () => {
    const state = createInitialState();
    const transition = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('poi:test', 'Lieu test', 190, 336) });
    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
    expect(transition.result.body).toContain('rejoindre l’extérieur');
  });

  it('creates a persistent local XY location and advances walking time', () => {
    const state = reachGarden();
    const before = state.engine.elapsedSeconds;
    const transition = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('poi:test', 'Lieu test', 190, 336) });
    expect(transition.result.success).toBe(true);
    expect(transition.result.elapsedSeconds).toBeGreaterThanOrEqual(15);
    expect(transition.state.engine.elapsedSeconds).toBe(before + transition.result.elapsedSeconds);
    const location = transition.state.locations[transition.state.player.locationId];
    expect(location?.name).toBe('Lieu test');
    expect(location?.position).toEqual({ x: 190, y: 336 });
    expect(location?.poiSite).toMatchObject({
      sourceId: 'poi:test',
      category: 'Inconnu',
      phase: 'outside',
      observed: false,
      surfaceRevealed: false,
      searched: false,
    });
    expect(location?.poiSite?.zones?.length).toBeGreaterThan(1);
    expect(transition.state.memory.visitedLocationIds).toContain(location?.id);
  });

  it('reveals obvious objects on entry and preserves search progress until exhaustive completion', () => {
    let state = reachPoi();
    expect(getContextActions(state).map((action) => action.id)).toContain('OBSERVE_LOCATION');
    expect(getContextActions(state).map((action) => action.id)).not.toContain('SEARCH_LOCATION');

    state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
    state = performAction(state, { id: 'ENTER_POI' }).state;
    const locationId = state.player.locationId;
    const active = state.locations[locationId]?.poiSite?.zones?.[0];
    expect(active?.searchSeconds).toBe(45 * 60);
    expect(active?.searchProgressSeconds).toBe(0);

    const visibleOnEntry = Object.values(state.items).filter((item) => item.location.kind === 'location' && item.location.id === locationId);
    expect(visibleOnEntry).toHaveLength(1);

    const beforeSearch = state.engine.elapsedSeconds;
    const first = performAction(state, { id: 'SEARCH_LOCATION' });
    expect(first.result.success).toBe(true);
    expect(first.result.elapsedSeconds).toBe(15 * 60);
    expect(first.state.engine.elapsedSeconds).toBe(beforeSearch + 15 * 60);
    expect(first.state.locations[locationId]?.poiSite?.searched).toBe(false);
    expect(first.state.locations[locationId]?.poiSite?.zones?.[0]?.searchProgressSeconds).toBe(15 * 60);
    expect(first.result.body).toContain('reste environ 30 minutes');
    expect(Object.values(first.state.items).filter((item) => item.location.kind === 'location' && item.location.id === locationId)).toHaveLength(1);

    const second = performAction(first.state, { id: 'SEARCH_LOCATION' });
    expect(second.state.locations[locationId]?.poiSite?.zones?.[0]?.searchProgressSeconds).toBe(30 * 60);
    expect(second.state.locations[locationId]?.poiSite?.searched).toBe(false);

    const third = performAction(second.state, { id: 'SEARCH_LOCATION' });
    expect(third.state.locations[locationId]?.poiSite?.zones?.[0]?.searchProgressSeconds).toBe(45 * 60);
    expect(third.state.locations[locationId]?.poiSite?.searched).toBe(true);
    expect(Object.values(third.state.items).filter((item) => item.location.kind === 'location' && item.location.id === locationId)).toHaveLength(4);
    expect(third.result.body).toContain('fouille exhaustive');

    state = performAction(third.state, { id: 'LEAVE_POI' }).state;
    expect(state.locations[state.player.locationId]?.poiSite?.phase).toBe('outside');
  });

  it('does not allow a completed search to duplicate resources after re-entry', () => {
    let state = reachPoi();
    state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
    state = performAction(state, { id: 'ENTER_POI' }).state;
    state = performAction(state, { id: 'SEARCH_LOCATION' }).state;
    state = performAction(state, { id: 'SEARCH_LOCATION' }).state;
    state = performAction(state, { id: 'SEARCH_LOCATION' }).state;
    const itemCount = Object.keys(state.items).length;
    const retry = performAction(state, { id: 'SEARCH_LOCATION' });
    expect(retry.result.success).toBe(false);
    expect(retry.state).toBe(state);
    expect(Object.keys(retry.state.items)).toHaveLength(itemCount);
    expect(retry.result.title).toBe('Zone déjà fouillée');

    state = performAction(state, { id: 'LEAVE_POI' }).state;
    state = performAction(state, { id: 'ENTER_POI' }).state;
    expect(Object.keys(state.items)).toHaveLength(itemCount);
  });

  it('requires leaving an interior before using map travel again', () => {
    let state = reachPoi();
    state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
    state = performAction(state, { id: 'ENTER_POI' }).state;
    const transition = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('poi:second', 'Deuxième lieu', 220, 336) });
    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
    expect(transition.result.title).toBe('Impossible depuis ici');
  });

  it('allows short progressive XY walking steps outdoors', () => {
    const state = reachGarden();
    const transition = performAction(state, {
      id: 'WALK_TO_MAP_POINT',
      targetId: target('walk', 'Rue / extérieur', 130, 338),
    });
    expect(transition.result.success).toBe(true);
    expect(transition.state.player.locationId).toBe('map_walk_position');
    expect(transition.state.locations.map_walk_position?.position).toEqual({ x: 130, y: 338 });
    expect(transition.result.body).toContain('m');
  });

  it('limits each free walking step so exploration remains progressive', () => {
    const state = reachGarden();
    const transition = performAction(state, {
      id: 'WALK_TO_MAP_POINT',
      targetId: target('walk', 'Rue / extérieur', 300, 338),
    });
    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
    expect(transition.result.title).toBe('Trop loin en une fois');
  });

  it('uses Maison 1 as the real return trip to the garden', () => {
    let state = reachGarden();
    state = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('poi:test', 'Lieu test', 190, 336) }).state;
    const transition = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('house_1', 'Maison 1', 72, 344) });
    expect(transition.result.success).toBe(true);
    expect(transition.state.player.locationId).toBe('garden');
    expect(transition.result.title).toBe('Retour au domicile');
  });

  it('rejects destinations outside the immediate playable radius transactionally', () => {
    const state = reachGarden();
    const transition = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('poi:far', 'Lieu lointain', 2000, 2000) });
    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
    expect(transition.result.title).toBe('Trop loin à pied');
  });
});
