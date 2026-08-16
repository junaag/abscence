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

describe('map POI travel', () => {
  it('requires a geographic exterior position before map travel', () => {
    const state = createInitialState();
    const transition = performAction(state, {
      id: 'TRAVEL_TO_MAP_POI',
      targetId: target('node:1', 'Station Ingres', 43.4055, 5.0549),
    });

    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
    expect(transition.result.body).toContain('rejoindre l’extérieur');
  });

  it('creates a persistent geographic location and advances walking time', () => {
    const state = reachGarden();
    const before = state.engine.elapsedSeconds;
    const transition = performAction(state, {
      id: 'TRAVEL_TO_MAP_POI',
      targetId: target('node:1', 'Station Ingres', 43.4055, 5.0549),
    });

    expect(transition.result.success).toBe(true);
    expect(transition.result.elapsedSeconds).toBeGreaterThanOrEqual(15);
    expect(transition.state.engine.elapsedSeconds).toBe(before + transition.result.elapsedSeconds);
    const location = transition.state.locations[transition.state.player.locationId];
    expect(location?.name).toBe('Station Ingres');
    expect(location?.position).toEqual({ lat: 43.4055, lon: 5.0549 });
    expect(transition.state.memory.visitedLocationIds).toContain(location?.id);
  });

  it('uses the home marker as a real return trip to the garden', () => {
    let state = reachGarden();
    state = performAction(state, {
      id: 'TRAVEL_TO_MAP_POI',
      targetId: target('node:1', 'Station Ingres', 43.4055, 5.0549),
    }).state;

    const transition = performAction(state, {
      id: 'TRAVEL_TO_MAP_POI',
      targetId: target('home', 'Maison', 43.4053, 5.0548),
    });

    expect(transition.result.success).toBe(true);
    expect(transition.state.player.locationId).toBe('garden');
    expect(transition.result.title).toBe('Retour vers la maison');
  });

  it('rejects destinations outside the immediate exploration radius transactionally', () => {
    const state = reachGarden();
    const transition = performAction(state, {
      id: 'TRAVEL_TO_MAP_POI',
      targetId: target('node:far', 'Lieu lointain', 43.45, 5.1),
    });

    expect(transition.result.success).toBe(false);
    expect(transition.state).toBe(state);
    expect(transition.result.title).toBe('Trop loin à pied');
  });
});
