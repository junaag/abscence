import { describe, expect, it } from 'vitest';
import { getWorldEventDefinition, WORLD_EVENT_DEFINITIONS } from '../../src/content/world-events';
import type { WorldEventDefinitionId, WorldEventState } from '../../src/engine/model';
import { getDistanceMeters, getPerceivedWorldEvents, getWorldEventPerception } from '../../src/engine/perception';
import { createInitialState } from '../../src/engine/state';

function activeEvent(definitionId: WorldEventDefinitionId, overrides: Partial<WorldEventState> = {}): WorldEventState {
  const definition = getWorldEventDefinition(definitionId);
  return {
    id: `event_${definitionId}`,
    definitionId,
    status: 'active',
    sensory: { ...definition.sensory },
    narrativeEvent: definition.narrativeEvent,
    tags: [...definition.tags],
    discoveredByPlayer: false,
    startedAtSeconds: 0,
    ...overrides,
  };
}

describe('historical world-event perception', () => {
  it('uses local metric positions and exposes only channels within range', () => {
    const state = createInitialState();
    const garden = state.locations.garden;
    if (!garden) throw new Error('missing garden');
    garden.position = { x: 120, y: 0 };
    const event = activeEvent('animal_noise', { id: 'animal_event', locationId: 'garden' });

    const perception = getWorldEventPerception(state, event, 'bedroom');
    expect(perception?.distanceM).toBe(120);
    expect(perception?.channels.some((entry) => entry.channel === 'audible')).toBe(true);
    expect(perception?.channels.some((entry) => entry.channel === 'visible')).toBe(false);
  });

  it('falls back to graph travel time at the historical 1.4 m/s conversion', () => {
    const state = createInitialState();
    const bedroom = state.locations.bedroom;
    const kitchen = state.locations.kitchen;
    const connection = state.connections.bedroom_kitchen;
    if (!bedroom || !kitchen || !connection) throw new Error('missing canonical house graph');
    bedroom.position = undefined;
    kitchen.position = undefined;
    connection.travelSeconds = 10;
    expect(getDistanceMeters(state, 'bedroom', 'kitchen')).toBeCloseTo(14, 9);
  });

  it('uses Haversine distance for geographic coordinates', () => {
    const state = createInitialState();
    const bedroom = state.locations.bedroom;
    const kitchen = state.locations.kitchen;
    if (!bedroom || !kitchen) throw new Error('missing canonical locations');
    bedroom.position = { lat: 0, lon: 0 };
    kitchen.position = { lat: 0, lon: 0.001 };
    expect(getDistanceMeters(state, 'bedroom', 'kitchen')).toBeCloseTo(111.19, 1);
  });

  it('restores smoke visual and smell channels with linear strength', () => {
    const state = createInitialState();
    const event = activeEvent('smoke_plume', { id: 'smoke_event', position: { x: 200, y: 0 } });
    const perception = getWorldEventPerception(state, event, 'bedroom');

    expect(perception?.distanceM).toBe(200);
    expect(perception?.channels).toEqual([
      { channel: 'visible', rangeM: 2000, strength: 0.9 },
      { channel: 'smell', rangeM: 250, strength: 0.2 },
    ]);
  });

  it('does not reveal resolved or out-of-range events', () => {
    const state = createInitialState();
    const resolved = activeEvent('security_alarm', { status: 'resolved', locationId: 'kitchen' });
    const remoteNoise = activeEvent('unattended_noise', { position: { x: 181, y: 0 } });
    expect(getWorldEventPerception(state, resolved, 'bedroom')).toBeNull();
    expect(getWorldEventPerception(state, remoteNoise, 'bedroom')).toBeNull();
  });

  it('sorts perceived events by distance and can mark them discovered', () => {
    const state = createInitialState();
    const near = activeEvent('unattended_noise', { id: 'near', position: { x: 90, y: 0 } });
    const far = activeEvent('smoke_plume', { id: 'far', position: { x: 800, y: 0 } });
    state.world.events = [far, near];

    const perceptions = getPerceivedWorldEvents(state, 'bedroom', { markDiscovered: true });
    expect(perceptions.map((entry) => entry.eventId)).toEqual(['near', 'far']);
    expect(near.discoveredByPlayer).toBe(true);
    expect(far.discoveredByPlayer).toBe(true);
  });

  it('keeps all five v0.1.8 sensory profiles exact', () => {
    expect(WORLD_EVENT_DEFINITIONS.water_leak.sensory).toEqual({ audibleRangeM: 35, visibleRangeM: 12, smellRangeM: 0 });
    expect(WORLD_EVENT_DEFINITIONS.security_alarm.sensory).toEqual({ audibleRangeM: 600, visibleRangeM: 0, smellRangeM: 0 });
    expect(WORLD_EVENT_DEFINITIONS.smoke_plume.sensory).toEqual({ audibleRangeM: 80, visibleRangeM: 2000, smellRangeM: 250 });
    expect(WORLD_EVENT_DEFINITIONS.animal_noise.sensory).toEqual({ audibleRangeM: 250, visibleRangeM: 80, smellRangeM: 0 });
    expect(WORLD_EVENT_DEFINITIONS.unattended_noise.sensory).toEqual({ audibleRangeM: 180, visibleRangeM: 0, smellRangeM: 0 });
  });
});
