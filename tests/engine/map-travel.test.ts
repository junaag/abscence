import { describe, expect, it } from 'vitest';
import { getContextActions, performAction } from '../../src/engine/actions';
import { createInitialState } from '../../src/engine/state';

function target(id: string, name: string, lat: number, lon: number): string {
  return encodeURIComponent(JSON.stringify({ id, name, lat, lon }));
}

function reachGarden() {
  let state = createInitialState();
  state = performAction(state, { id: 'MOVE', targetId: 'kitchen' }).state;
  state = performAction(state, { id: 'MOVE', targetId: 'garden' }).state;
  return state;
}

function reachPoi() {
  let state = reachGarden();
  state = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('node:1', 'Station Ingres', 43.4055, 5.0549) }).state;
  return state;
}

describe('map travel', () => {
  it('requires a geographic exterior position before map travel', () => {
    const state = createInitialState();
    const transition = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('node:1', 'Station Ingres', 43.4055, 5.0549) });
    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
    expect(transition.result.body).toContain('rejoindre l’extérieur');
  });

  it('creates a persistent geographic location and advances walking time', () => {
    const state = reachGarden();
    const before = state.engine.elapsedSeconds;
    const transition = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('node:1', 'Station Ingres', 43.4055, 5.0549) });
    expect(transition.result.success).toBe(true);
    expect(transition.result.elapsedSeconds).toBeGreaterThanOrEqual(15);
    expect(transition.state.engine.elapsedSeconds).toBe(before + transition.result.elapsedSeconds);
    const location = transition.state.locations[transition.state.player.locationId];
    expect(location?.name).toBe('Station Ingres');
    expect(location?.position).toEqual({ lat: 43.4055, lon: 5.0549 });
    expect(location?.poiSite).toEqual({ sourceId: 'node:1', phase: 'outside', observed: false, searched: false });
    expect(transition.state.memory.visitedLocationIds).toContain(location?.id);
  });

  it('exposes observe then enter then search then leave without quest guidance', () => {
    let state = reachPoi();
    expect(getContextActions(state).map((action) => action.id)).toContain('OBSERVE_LOCATION');
    expect(getContextActions(state).map((action) => action.id)).not.toContain('SEARCH_LOCATION');

    state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
    expect(state.locations[state.player.locationId]?.poiSite?.observed).toBe(true);
    expect(getContextActions(state).map((action) => action.id)).toContain('ENTER_POI');

    state = performAction(state, { id: 'ENTER_POI' }).state;
    expect(state.locations[state.player.locationId]?.poiSite?.phase).toBe('inside');
    expect(getContextActions(state).map((action) => action.id)).toContain('SEARCH_LOCATION');
    expect(getContextActions(state).map((action) => action.id)).toContain('LEAVE_POI');

    const beforeSearch = state.engine.elapsedSeconds;
    const search = performAction(state, { id: 'SEARCH_LOCATION' });
    expect(search.result.success).toBe(true);
    expect(search.result.elapsedSeconds).toBe(180);
    expect(search.state.engine.elapsedSeconds).toBe(beforeSearch + 180);
    expect(search.state.locations[search.state.player.locationId]?.poiSite?.searched).toBe(true);
    const foundItems = Object.values(search.state.items).filter((item) => item.location.kind === 'location' && item.location.id === search.state.player.locationId);
    expect(foundItems).toHaveLength(2);
    expect(search.result.body).toContain(foundItems[0]?.name.toLowerCase() ?? '');

    state = performAction(search.state, { id: 'LEAVE_POI' }).state;
    expect(state.locations[state.player.locationId]?.poiSite?.phase).toBe('outside');
  });

  it('does not allow repeated searches to duplicate resources', () => {
    let state = reachPoi();
    state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
    state = performAction(state, { id: 'ENTER_POI' }).state;
    state = performAction(state, { id: 'SEARCH_LOCATION' }).state;
    const itemCount = Object.keys(state.items).length;
    const retry = performAction(state, { id: 'SEARCH_LOCATION' });
    expect(retry.result.success).toBe(false);
    expect(retry.state).toBe(state);
    expect(Object.keys(retry.state.items)).toHaveLength(itemCount);
    expect(retry.result.title).toBe('Déjà fouillé');
  });

  it('requires leaving an interior before using map travel again', () => {
    let state = reachPoi();
    state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
    state = performAction(state, { id: 'ENTER_POI' }).state;
    const transition = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('node:2', 'Garage du Sud', 43.4057, 5.0551) });
    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
    expect(transition.result.title).toBe('Vous êtes à l’intérieur');
  });

  it('allows short progressive walking steps through the street network view', () => {
    const state = reachGarden();
    const transition = performAction(state, {
      id: 'WALK_TO_MAP_POINT',
      targetId: target('walk', 'Rue / extérieur', 43.40555, 5.05495),
    });
    expect(transition.result.success).toBe(true);
    expect(transition.state.player.locationId).toBe('map_walk_position');
    expect(transition.state.locations.map_walk_position?.position).toEqual({ lat: 43.40555, lon: 5.05495 });
    expect(transition.result.body).toContain('m');
  });

  it('limits each free walking step so exploration remains progressive', () => {
    const state = reachGarden();
    const transition = performAction(state, {
      id: 'WALK_TO_MAP_POINT',
      targetId: target('walk', 'Rue / extérieur', 43.408, 5.05495),
    });
    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
    expect(transition.result.title).toBe('Trop loin en une fois');
  });

  it('uses the residential domicile marker as a real return trip to the garden', () => {
    let state = reachGarden();
    state = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('node:1', 'Station Ingres', 43.4055, 5.0549) }).state;
    const transition = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('home', 'Domicile', 43.4053, 5.0548) });
    expect(transition.result.success).toBe(true);
    expect(transition.state.player.locationId).toBe('garden');
    expect(transition.result.title).toBe('Retour au domicile');
  });

  it('rejects destinations outside the immediate exploration radius transactionally', () => {
    const state = reachGarden();
    const transition = performAction(state, { id: 'TRAVEL_TO_MAP_POI', targetId: target('node:far', 'Lieu lointain', 43.45, 5.1) });
    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
    expect(transition.result.title).toBe('Trop loin à pied');
  });
});
