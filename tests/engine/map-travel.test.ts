import { describe, expect, it } from 'vitest';
import { performAction } from '../../src/engine/actions';
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
    expect(transition.state.memory.visitedLocationIds).toContain(location?.id);
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
