import { getWorldEventDefinition } from '../content/world-events';
import type { GameState, LocationId, SensoryProfile, WorldEventState } from './model';

type LocalPosition = { x: number; y: number; system: 'local_m' };
type GeoPosition = { lat: number; lon: number; system: 'geo' };
type NormalizedPosition = LocalPosition | GeoPosition;

export type PerceptionChannelId = 'audible' | 'visible' | 'smell';

export interface PerceptionChannel {
  channel: PerceptionChannelId;
  rangeM: number;
  strength: number;
}

export interface WorldEventPerception {
  eventId: string;
  definitionId: WorldEventState['definitionId'];
  narrativeEvent: string;
  distanceM: number;
  channels: PerceptionChannel[];
  locationId?: LocationId;
  tags: string[];
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeWorldEventPosition(value: unknown): NormalizedPosition | null {
  if (!value || typeof value !== 'object') return null;
  const position = value as Record<string, unknown>;
  const x = finiteNumber(position.x);
  const y = finiteNumber(position.y);
  if (x !== null && y !== null) return { x, y, system: 'local_m' };

  const lat = finiteNumber(position.lat ?? position.latitude);
  const lon = finiteNumber(position.lon ?? position.lng ?? position.longitude);
  if (lat !== null && lon !== null) return { lat, lon, system: 'geo' };
  return null;
}

function locationPosition(state: GameState, locationId?: LocationId | null): NormalizedPosition | null {
  if (!locationId) return null;
  return normalizeWorldEventPosition(state.locations[locationId]?.position ?? null);
}

function haversineMeters(a: GeoPosition, b: GeoPosition): number {
  const rad = Math.PI / 180;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function graphDistanceMeters(state: GameState, fromLocationId?: LocationId | null, toLocationId?: LocationId | null): number | null {
  if (!fromLocationId || !toLocationId) return null;
  if (fromLocationId === toLocationId) return 0;

  const distances = new Map<LocationId, number>([[fromLocationId, 0]]);
  const queue: Array<[number, LocationId]> = [[0, fromLocationId]];
  const visited = new Set<LocationId>();

  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0]);
    const [distance, current] = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === toLocationId) return distance;

    for (const connection of Object.values(state.connections)) {
      if (connection.a !== current && connection.b !== current) continue;
      const next = connection.a === current ? connection.b : connection.a;
      const travelSeconds = Math.max(1, Number(connection.travelSeconds) || 15);
      const candidate = distance + travelSeconds * 1.4;
      const previous = distances.get(next);
      if (previous === undefined || candidate < previous) {
        distances.set(next, candidate);
        queue.push([candidate, next]);
      }
    }
  }
  return null;
}

/**
 * Historical v0.1.8 distance precedence:
 * local coordinates -> geographic coordinates -> location graph.
 * The graph fallback deliberately uses travel time as distance (1.4 m/s) and
 * does not filter closed connections, matching the old simulation exactly.
 */
export function getDistanceMeters(
  state: GameState,
  fromLocationId?: LocationId | null,
  toLocationId?: LocationId | null,
  toPosition: unknown = null,
  fromPosition: unknown = null,
): number | null {
  const a = normalizeWorldEventPosition(fromPosition) ?? locationPosition(state, fromLocationId);
  const b = normalizeWorldEventPosition(toPosition) ?? locationPosition(state, toLocationId);

  if (a?.system === 'local_m' && b?.system === 'local_m') return Math.hypot(b.x - a.x, b.y - a.y);
  if (a?.system === 'geo' && b?.system === 'geo') return haversineMeters(a, b);

  const graphDistance = graphDistanceMeters(state, fromLocationId, toLocationId);
  if (graphDistance !== null) return graphDistance;
  return fromLocationId && toLocationId && fromLocationId === toLocationId ? 0 : null;
}

function eventSensory(event: WorldEventState): SensoryProfile {
  return event.sensory ?? getWorldEventDefinition(event.definitionId).sensory;
}

export function getWorldEventPerception(
  state: GameState,
  event: WorldEventState,
  observerLocationId: LocationId | null = null,
): WorldEventPerception | null {
  if (event.status !== 'active') return null;
  const observer = observerLocationId ?? state.player.locationId;
  const distanceM = getDistanceMeters(state, observer, event.locationId, event.position, null);
  if (distanceM === null || !Number.isFinite(distanceM)) return null;

  const sensory = eventSensory(event);
  const channels: PerceptionChannel[] = [];
  const definitions: Array<[PerceptionChannelId, keyof SensoryProfile]> = [
    ['audible', 'audibleRangeM'],
    ['visible', 'visibleRangeM'],
    ['smell', 'smellRangeM'],
  ];

  for (const [channel, rangeKey] of definitions) {
    const rangeM = Math.max(0, Number(sensory[rangeKey]) || 0);
    if (rangeM <= 0 || distanceM > rangeM) continue;
    channels.push({ channel, rangeM, strength: round(Math.max(0, 1 - distanceM / rangeM), 4) });
  }

  if (channels.length === 0) return null;
  const perception: WorldEventPerception = {
    eventId: event.id,
    definitionId: event.definitionId,
    narrativeEvent: event.narrativeEvent,
    distanceM: round(distanceM, 2),
    channels,
    tags: [...event.tags],
  };
  if (event.locationId) perception.locationId = event.locationId;
  return perception;
}

export function getPerceivedWorldEvents(
  state: GameState,
  observerLocationId: LocationId | null = null,
  options: { markDiscovered?: boolean } = {},
): WorldEventPerception[] {
  const perceptions: WorldEventPerception[] = [];
  for (const event of state.world.events ?? []) {
    const perception = getWorldEventPerception(state, event, observerLocationId);
    if (!perception) continue;
    perceptions.push(perception);
    if (options.markDiscovered) event.discoveredByPlayer = true;
  }
  return perceptions.sort((a, b) => a.distanceM - b.distanceM);
}
