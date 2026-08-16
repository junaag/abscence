import { getDistanceMeters } from '../perception';
import type { EngineTransition, GameState } from '../model';
import { cloneState } from '../state';
import { advanceTime } from '../time';
import { failure, success } from './result';

interface MapPoiTravelTarget {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

const MAX_MAP_TRAVEL_DISTANCE_M = 1600;
const WALKING_SPEED_MPS = 1.25;

function parseTarget(value: string | undefined): MapPoiTravelTarget | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<MapPoiTravelTarget>;
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

export function travelToMapPoi(state: GameState, encodedTarget: string | undefined): EngineTransition {
  const target = parseTarget(encodedTarget);
  if (!target) return failure(state, 'Destination invalide', 'Ce point de la carte ne peut pas être utilisé comme destination.');

  const distanceM = getDistanceMeters(state, state.player.locationId, null, { lat: target.lat, lon: target.lon });
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
    if (!next.locations[destinationId]) return failure(state, 'Maison inaccessible', 'Le point de retour à la maison n’existe plus.');
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
  if (!next.memory.visitedLocationIds.includes(destinationId)) next.memory.visitedLocationIds.push(destinationId);
  advanceTime(next, elapsedSeconds);

  const roundedDistance = Math.max(1, Math.round(distanceM));
  return success(
    next,
    target.id === 'home' ? 'Retour vers la maison' : target.name,
    `Vous parcourez environ ${roundedDistance} m à pied. Le temps continue de s’écouler pendant le trajet.`,
    elapsedSeconds,
  );
}
