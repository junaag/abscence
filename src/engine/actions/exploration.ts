import { getItemDefinition } from '../../content/items';
import { applyPhysicalExertion, getEncumbranceProfile, scalePhysicalDuration } from '../encumbrance';
import { getDistanceMeters } from '../perception';
import type { EngineTransition, GameState, ItemState, LocationState } from '../model';
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
const OBSERVE_SECONDS = 25;
const ENTER_SECONDS = 12;
const SEARCH_SECONDS = 12 * 60;
const LEAVE_SECONDS = 8;

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

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableLocationId(sourceId: string): string {
  return `map_poi_${stableHash(sourceId).toString(16)}`;
}

function distanceToTarget(state: GameState, target: MapTravelTarget): number | null {
  return getDistanceMeters(state, state.player.locationId, null, { lat: target.lat, lon: target.lon });
}

function currentPoiLocation(state: GameState): LocationState | null {
  const location = state.locations[state.player.locationId];
  return location?.poiSite ? location : null;
}

function requireOutsideForMapTravel(state: GameState): EngineTransition | null {
  const location = currentPoiLocation(state);
  if (location?.poiSite?.phase === 'inside') {
    return failure(state, 'Vous êtes à l’intérieur', 'Sortez d’abord du lieu avant de reprendre votre déplacement dans le quartier.');
  }
  return null;
}

function createLootItem(locationId: string, sourceId: string, layer: 'surface' | 'deep', index: number, definitionId: string): ItemState {
  const definition = getItemDefinition(definitionId);
  const item: ItemState = {
    id: `${locationId}_loot_${stableHash(`${sourceId}:${layer}:${index}:${definitionId}`).toString(16)}`,
    definitionId,
    name: definition?.name ?? 'Objet',
    location: { kind: 'location', id: locationId },
    examined: false,
    condition: 'Utilisable',
  };
  if (definitionId === 'water_bottle') {
    item.liquidMl = 500;
    item.capacityMl = 500;
    item.condition = 'Fermée';
  } else if (definitionId === 'apple') {
    item.freshnessPercent = 82;
    item.condition = 'Encore ferme';
  } else if (definitionId === 'flashlight') {
    item.batteryPercent = 61;
    item.enabled = false;
    item.condition = 'Bon état';
  } else if (definitionId === 'backpack' || definitionId === 'waist_bag') {
    item.condition = 'Bon état';
  } else if (definitionId === 'towel') {
    item.condition = 'Sec';
  }
  return item;
}

function lootProfile(sourceId: string): { surface: readonly string[]; deep: readonly string[] } {
  const profiles = [
    { surface: ['water_bottle'], deep: ['flashlight', 'waist_bag', 'apple'] },
    { surface: ['apple'], deep: ['water_bottle', 'towel', 'flashlight'] },
    { surface: ['towel'], deep: ['waist_bag', 'water_bottle', 'apple'] },
    { surface: ['water_bottle'], deep: ['backpack', 'flashlight', 'towel'] },
  ] as const;
  return profiles[stableHash(sourceId) % profiles.length] ?? profiles[0];
}

function revealLootLayer(state: GameState, location: LocationState, layer: 'surface' | 'deep'): string[] {
  const site = location.poiSite;
  if (!site) return [];
  const definitions = lootProfile(site.sourceId)[layer];
  const names: string[] = [];
  definitions.forEach((definitionId, index) => {
    const item = createLootItem(location.id, site.sourceId, layer, index, definitionId);
    if (!state.items[item.id]) state.items[item.id] = item;
    names.push(item.name.toLowerCase());
  });
  return names;
}

function exertionSuffix(state: GameState): string {
  const encumbrance = getEncumbranceProfile(state);
  return encumbrance.tier === 'light' ? '' : ` ${encumbrance.label} ralentit vos gestes et accentue l’effort.`;
}

export function observeLocation(state: GameState): EngineTransition {
  const location = currentPoiLocation(state);
  const site = location?.poiSite;
  if (!location || !site) return failure(state, 'Rien à observer ici', 'Cette action concerne les lieux découverts sur la carte.');
  if (site.phase !== 'outside') return failure(state, 'Déjà à l’intérieur', 'Vous avez déjà franchi l’entrée de ce lieu.');
  if (site.observed) return failure(state, 'Déjà observé', 'Vous avez déjà pris le temps d’examiner les abords et les accès visibles.');

  const next = cloneState(state);
  const nextSite = next.locations[location.id]?.poiSite;
  if (!nextSite) return failure(state, 'Lieu indisponible', 'Le lieu n’est plus accessible.');
  nextSite.observed = true;
  advanceTime(next, OBSERVE_SECONDS);
  return success(
    next,
    'Vous observez les lieux.',
    'Vous prenez le temps de regarder les accès, les vitrages et ce qui est visible depuis l’extérieur. Aucun mouvement humain ne se manifeste.',
    OBSERVE_SECONDS,
  );
}

export function enterPoi(state: GameState): EngineTransition {
  const location = currentPoiLocation(state);
  const site = location?.poiSite;
  if (!location || !site) return failure(state, 'Aucune entrée ici', 'Ce lieu ne possède pas encore d’espace à explorer.');
  if (site.phase === 'inside') return failure(state, 'Déjà à l’intérieur', 'Vous êtes déjà entré dans ce lieu.');
  if (!site.observed) return failure(state, 'Accès mal évalué', 'Observez d’abord les abords avant de vous engager à l’intérieur.');

  const elapsedSeconds = scalePhysicalDuration(state, ENTER_SECONDS, 'action');
  const next = cloneState(state);
  const nextLocation = next.locations[location.id];
  const nextSite = nextLocation?.poiSite;
  if (!nextLocation || !nextSite) return failure(state, 'Lieu indisponible', 'Le lieu n’est plus accessible.');
  nextSite.phase = 'inside';
  const newlyVisible = nextSite.surfaceRevealed ? [] : revealLootLayer(next, nextLocation, 'surface');
  nextSite.surfaceRevealed = true;
  advanceTime(next, elapsedSeconds);
  applyPhysicalExertion(next, elapsedSeconds, 0.5);
  const visibleText = newlyVisible.length > 0
    ? ` Sans fouiller, vous repérez déjà ${newlyVisible.join(' et ')}.`
    : '';
  return success(
    next,
    `Vous entrez dans ${location.name}.`,
    `L’air et l’acoustique changent aussitôt. Le lieu paraît avoir été abandonné sans préparation, comme si son activité s’était interrompue d’un seul coup.${visibleText}${exertionSuffix(state)}`,
    elapsedSeconds,
  );
}

export function searchLocation(state: GameState): EngineTransition {
  const location = currentPoiLocation(state);
  const site = location?.poiSite;
  if (!location || !site) return failure(state, 'Rien à fouiller ici', 'Cette zone ne possède pas de fouille persistante.');
  if (site.phase !== 'inside') return failure(state, 'Vous êtes dehors', 'Entrez dans le lieu avant de commencer une fouille méthodique.');
  if (site.searched) return failure(state, 'Déjà fouillé', 'Vous avez déjà inspecté méthodiquement les zones accessibles de ce lieu.');

  const elapsedSeconds = scalePhysicalDuration(state, SEARCH_SECONDS, 'action');
  const next = cloneState(state);
  const nextLocation = next.locations[location.id];
  const nextSite = nextLocation?.poiSite;
  if (!nextLocation || !nextSite) return failure(state, 'Lieu indisponible', 'Le lieu n’est plus accessible.');
  nextSite.searched = true;
  const found = revealLootLayer(next, nextLocation, 'deep');
  advanceTime(next, elapsedSeconds);
  applyPhysicalExertion(next, elapsedSeconds, 0.75);
  const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
  return success(
    next,
    'Vous fouillez méthodiquement.',
    found.length > 0
      ? `Pendant environ ${minutes} minutes, vous inspectez tiroirs, recoins, réserves et zones moins évidentes. Vous découvrez en plus ${found.join(', ')}. Cette fouille approfondie révèle nettement plus qu’un simple passage dans le lieu.${exertionSuffix(state)}`
      : `Après environ ${minutes} minutes d’inspection attentive, rien de réellement exploitable ne se révèle.${exertionSuffix(state)}`,
    elapsedSeconds,
  );
}

export function leavePoi(state: GameState): EngineTransition {
  const location = currentPoiLocation(state);
  const site = location?.poiSite;
  if (!location || !site) return failure(state, 'Aucune sortie ici', 'Vous n’êtes pas dans un lieu exploratoire.');
  if (site.phase !== 'inside') return failure(state, 'Déjà dehors', 'Vous vous trouvez déjà à l’extérieur.');

  const elapsedSeconds = scalePhysicalDuration(state, LEAVE_SECONDS, 'action');
  const next = cloneState(state);
  const nextSite = next.locations[location.id]?.poiSite;
  if (!nextSite) return failure(state, 'Lieu indisponible', 'Le lieu n’est plus accessible.');
  nextSite.phase = 'outside';
  advanceTime(next, elapsedSeconds);
  applyPhysicalExertion(next, elapsedSeconds, 0.5);
  return success(next, `Vous ressortez de ${location.name}.`, `Vous retrouvez l’air extérieur et le silence du quartier.${exertionSuffix(state)}`, elapsedSeconds);
}

export function walkToMapPoint(state: GameState, encodedTarget: string | undefined): EngineTransition {
  const blocked = requireOutsideForMapTravel(state);
  if (blocked) return blocked;
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

  const baseSeconds = Math.max(2, Math.round(distanceM / WALKING_SPEED_MPS));
  const elapsedSeconds = scalePhysicalDuration(state, baseSeconds, 'movement');
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
  applyPhysicalExertion(next, elapsedSeconds, 1);

  return success(
    next,
    'Vous avancez à pied.',
    `Vous parcourez environ ${Math.max(1, Math.round(distanceM))} m.${exertionSuffix(state)}`,
    elapsedSeconds,
  );
}

export function travelToMapPoi(state: GameState, encodedTarget: string | undefined): EngineTransition {
  const blocked = requireOutsideForMapTravel(state);
  if (blocked) return blocked;
  const target = parseTarget(encodedTarget);
  if (!target) return failure(state, 'Destination invalide', 'Ce point de la carte ne peut pas être utilisé comme destination.');

  const distanceM = distanceToTarget(state, target);
  if (distanceM === null) {
    return failure(state, 'Impossible depuis ici', 'Vous devez d’abord rejoindre l’extérieur avant de vous déplacer vers un point de la carte.');
  }
  if (distanceM > MAX_MAP_TRAVEL_DISTANCE_M) {
    return failure(state, 'Trop loin à pied', 'Cette destination dépasse encore votre zone d’exploration immédiate.');
  }

  const baseSeconds = Math.max(15, Math.round(distanceM / WALKING_SPEED_MPS));
  const elapsedSeconds = scalePhysicalDuration(state, baseSeconds, 'movement');
  const next = cloneState(state);

  let destinationId: string;
  if (target.id === 'home') {
    destinationId = 'garden';
    if (!next.locations[destinationId]) return failure(state, 'Domicile inaccessible', 'Le point de retour n’existe plus.');
  } else {
    destinationId = stableLocationId(target.id);
    const existing = next.locations[destinationId];
    if (!existing) {
      const origin = next.locations[state.player.locationId];
      next.locations[destinationId] = {
        id: destinationId,
        name: target.name,
        ambientTemperatureC: origin?.ambientTemperatureC ?? 20,
        ambientHumidityPercent: origin?.ambientHumidityPercent ?? 50,
        ventilation: 1,
        features: {},
        position: { lat: target.lat, lon: target.lon },
        poiSite: { sourceId: target.id, phase: 'outside', observed: false, surfaceRevealed: false, searched: false },
      };
    } else if (!existing.poiSite) {
      existing.poiSite = { sourceId: target.id, phase: 'outside', observed: false, surfaceRevealed: false, searched: false };
    }
  }

  next.player.locationId = destinationId;
  recordLocationVisit(next, destinationId);
  advanceTime(next, elapsedSeconds);
  applyPhysicalExertion(next, elapsedSeconds, 1);

  const roundedDistance = Math.max(1, Math.round(distanceM));
  return success(
    next,
    target.id === 'home' ? 'Retour au domicile' : target.name,
    `Vous parcourez environ ${roundedDistance} m à pied. Le temps continue de s’écouler pendant le trajet.${exertionSuffix(state)}`,
    elapsedSeconds,
  );
}
