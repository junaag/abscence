import { getDistanceMeters } from '../perception';
import type { EngineTransition, GameState } from '../model';
import { cloneState, recordLocationVisit } from '../state';
import { advanceTime } from '../time';
import { failure, success } from './result';

interface MapTravelTarget {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

const MAX_MAP_TRAVEL_DISTANCE_M = 1600;
const MAX_FREE_WALK_DISTANCE_M = 120;
const WALKING_SPEED_MPS = 1.25;

function parseTarget(value: string | undefined): MapTravelTarget | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<MapTravelTarget>;
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    const lat = Number(parsed.lat);
    const lon = Number(parsed.lon);
    if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -85 || lat > 85 || lon < -180 || lon > 180) return null;
    return { id: id.slice(0, 120), name: name.slice(0, 120), lat, lon };
  } catch {
    return null;
  }
}

function stableLocationId(sourceId: string): string {
  let hash = 2166136261;
  for (let index = 0; index < sourceId.length; index += 1) {
    hash ^= sourceId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `map_poi_${(hash >>> 0).toString(16)}`;
}

function distanceToTarget(state: GameState, target: MapTravelTarget): number | null {
  return getDistanceMeters(state, state.player.locationId, null, { lat: target.lat, lon: target.lon });
}

export function walkToMapPoint(state: GameState, encodedTarget: string | undefined): EngineTransition {
  const target = parseTarget(encodedTarget);
  if (!target) return failure(state, 'Destination invalide', 'Ce point de la carte ne peut pas être utilisé pour marcher.');

  const distanceM = distanceToTarget(state, target);
  if (distanceM === null) {
    return failure(state, 'Impossible depuis ici', 'Vous devez d’abord rejoindre l’extérieur avant de circuler dans le quartier.');
  }
  if (distanceM > MAX_FREE_WALK_DISTANCE_M) {
    return failure(state, 'Trop loin en une fois', `Choisissez un point situé à moins de ${MAX_FREE_WALK_DISTANCE_M} m pour avancer progressivement.`);
  }
  if (distanceM < 2) return failure(state, 'Déjà ici', 'Vous êtes déjà pratiquement à cet endroit.');

  const elapsedSeconds = Math.max(2, Math.round(distanceM / WALKING_SPEED_MPS));
  const next = cloneState(state);
  const origin = next.locations[state.player.locationId];
  const locationId = 'map_walk_position';
  next.locations[locationId] = {
    id: locationId,
    name: 'Rue / extérieur',
    ambientTemperatureC: origin?.ambientTemperatureC ?? 20,
    ambientHumidityPercent: origin?.ambientHumidityPercent ?? 50,
    ventilation: 1,
    features: {},
    position: { lat: target.lat, lon: target.lon },
  };
  next.player.locationId = locationId;
  recordLocationVisit(next, locationId);
  advanceTime(next, elapsedSeconds);

  return success(
    next,
    'Vous avancez à pied.',
    `Vous parcourez environ ${Math.max(1, Math.round(distanceM))} m.`,
    elapsedSeconds,
  );
}

export function travelToMapPoi(state: GameState, encodedTarget: string | undefined): EngineTransition {
  const target = parseTarget(encodedTarget);
  if (!target) return failure(state, 'Destination invalide', 'Ce point de la carte ne peut pas être utilisé comme destination.');

  const distanceM = distanceToTarget(state, target);
  if (distanceM === null) {
    return failure(state, 'Impossible depuis ici', 'Vous devez d’abord rejoindre l’extérieur avant de vous déplacer vers un point de la carte.');
  }
  if (distanceM > MAX_MAP_TRAVEL_DISTANCE_M) {
    return failure(state, 'Trop loin à pied', 'Cette destination dépasse encore votre zone d’exploration immédiate.');
  }

  const elapsedSeconds = Math.max(15, Math.round(distanceM / WALKING_SPEED_MPS));
  const next = cloneState(state);

  let destinationId: string;
  if (target.id === 'home') {
    destinationId = 'garden';
    if (!next.locations[destinationId]) return failure(state, 'Domicile inaccessible', 'Le point de retour n’existe plus.');
  } else {
    destinationId = stableLocationId(target.id);
    if (!next.locations[destinationId]) {
      const origin = next.locations[state.player.locationId];
      next.locations[destinationId] = {
        id: destinationId,
        name: target.name,
        ambientTemperatureC: origin?.ambientTemperatureC ?? 20,
        ambientHumidityPercent: origin?.ambientHumidityPercent ?? 50,
        ventilation: 1,
        features: {},
        position: { lat: target.lat, lon: target.lon },
      };
    }
  }

  next.player.locationId = destinationId;
  recordLocationVisit(next, destinationId);
  advanceTime(next, elapsedSeconds);

  const roundedDistance = Math.max(1, Math.round(distanceM));
  return success(
    next,
    target.id === 'home' ? 'Retour au domicile' : target.name,
    `Vous parcourez environ ${roundedDistance} m à pied. Le temps continue de s’écouler pendant le trajet.`,
    elapsedSeconds,
  );
}
