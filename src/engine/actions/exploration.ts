import { getItemDefinition } from '../../content/items';
import { applyPhysicalExertion, getEncumbranceProfile, scalePhysicalDuration } from '../encumbrance';
import type { EngineTransition, GameState, ItemState, LocationState, PoiRiskState, PoiZoneState } from '../model';
import { getDistanceMeters } from '../perception';
import {
  createPoiSiteState,
  ensurePoiSiteStructure,
  getActivePoiZone,
  getPoiLootDefinitionIds,
  getPoiZone,
  stablePoiHash,
} from '../poi-sites';
import { cloneState, clampNeeds, recordLocationVisit } from '../state';
import { advanceTime } from '../time';
import { failure, success } from './result';

interface MapTravelTarget {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category?: string;
  typeLabel?: string;
}

const MAX_MAP_TRAVEL_DISTANCE_M = 1600;
const MAX_FREE_WALK_DISTANCE_M = 120;
const WALKING_SPEED_MPS = 1.25;
const OBSERVE_SECONDS = 25;
const ENTER_SECONDS = 12;
const SEARCH_SECONDS = 12 * 60;
const LEAVE_SECONDS = 8;
const MOVE_ZONE_SECONDS = 18;
const FORCE_ENTRANCE_SECONDS = 4 * 60;
const FORCE_ZONE_SECONDS = 3 * 60;

function parseTarget(value: string | undefined): MapTravelTarget | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<MapTravelTarget>;
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    const lat = Number(parsed.lat);
    const lon = Number(parsed.lon);
    const category = typeof parsed.category === 'string' ? parsed.category.trim() : '';
    const typeLabel = typeof parsed.typeLabel === 'string' ? parsed.typeLabel.trim() : '';
    if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -85 || lat > 85 || lon < -180 || lon > 180) return null;
    return {
      id: id.slice(0, 120),
      name: name.slice(0, 120),
      lat,
      lon,
      ...(category ? { category: category.slice(0, 60) } : {}),
      ...(typeLabel ? { typeLabel: typeLabel.slice(0, 80) } : {}),
    };
  } catch {
    return null;
  }
}

function stableLocationId(sourceId: string): string {
  return `map_poi_${stablePoiHash(sourceId).toString(16)}`;
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

function createLootItem(locationId: string, sourceId: string, zoneId: string, layer: 'surface' | 'deep', index: number, definitionId: string): ItemState {
  const definition = getItemDefinition(definitionId);
  const item: ItemState = {
    id: `${locationId}_loot_${stablePoiHash(`${sourceId}:${zoneId}:${layer}:${index}:${definitionId}`).toString(16)}`,
    definitionId,
    name: definition?.name ?? 'Objet',
    location: { kind: 'location', id: locationId },
    examined: false,
    poiZoneId: zoneId,
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
  } else if (definitionId === 'backpack' || definitionId === 'waist_bag' || definitionId === 'hiking_backpack') {
    item.condition = 'Bon état';
  } else if (definitionId === 'towel') {
    item.condition = 'Sec';
  } else if (definitionId === 'crowbar' || definitionId === 'tool_kit' || definitionId === 'work_gloves') {
    item.condition = 'Utilisable';
  } else if (definitionId === 'first_aid_kit' || definitionId === 'bandage_pack') {
    item.condition = 'Emballage intact';
  } else if (definitionId === 'canned_food') {
    item.condition = 'Scellée';
  } else if (definitionId === 'empty_fuel_can') {
    item.condition = 'Vide';
  }
  return item;
}

function revealLootLayer(state: GameState, location: LocationState, zone: PoiZoneState, layer: 'surface' | 'deep'): string[] {
  const site = location.poiSite;
  if (!site) return [];
  const definitions = getPoiLootDefinitionIds(site, zone.id, layer);
  const names: string[] = [];
  definitions.forEach((definitionId, index) => {
    const item = createLootItem(location.id, site.sourceId, zone.id, layer, index, definitionId);
    if (!state.items[item.id]) state.items[item.id] = item;
    names.push(item.name.toLowerCase());
  });
  return names;
}

function revealZoneSurface(state: GameState, location: LocationState, zone: PoiZoneState): string[] {
  const site = location.poiSite;
  if (!site) return [];
  zone.discovered = true;
  if (zone.risk) zone.risk.discovered = true;
  if (zone.surfaceRevealed) return [];
  const found = revealLootLayer(state, location, zone, 'surface');
  zone.surfaceRevealed = true;
  site.surfaceRevealed = true;
  return found;
}

function exertionSuffix(state: GameState): string {
  const encumbrance = getEncumbranceProfile(state);
  return encumbrance.tier === 'light' ? '' : ` ${encumbrance.label} ralentit vos gestes et accentue l’effort.`;
}

function hasCrowbar(state: GameState): boolean {
  return state.player.inventoryIds.some((id) => state.items[id]?.definitionId === 'crowbar');
}

function forceDuration(state: GameState, baseSeconds: number): number {
  const toolAdjusted = hasCrowbar(state) ? Math.round(baseSeconds * 0.45) : baseSeconds;
  return scalePhysicalDuration(state, toolAdjusted, 'action');
}

function applyForcedAccessCost(state: GameState, usedCrowbar: boolean): void {
  if (usedCrowbar) return;
  state.player.needs.pain += 0.5;
  state.player.needs.stress += 1.5;
  clampNeeds(state);
}

function riskText(risk: PoiRiskState | undefined): string {
  if (!risk?.discovered || risk.resolved) return '';
  return ` Vous repérez un risque : ${risk.label.toLowerCase()}.`;
}

function applyRiskIncident(state: GameState, risk: PoiRiskState): string {
  risk.triggered = true;
  risk.resolved = true;
  state.player.needs.pain += risk.painPenalty;
  state.player.needs.fatigue += risk.fatiguePenalty;
  state.player.needs.stress += risk.stressPenalty;
  clampNeeds(state);
  return ` En fouillant sans sécuriser la zone, ${risk.label.toLowerCase()} vous gêne réellement : douleur, fatigue et tension augmentent.`;
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
  ensurePoiSiteStructure(nextSite);
  nextSite.observed = true;
  advanceTime(next, OBSERVE_SECONDS);
  const access = nextSite.entranceLocked
    ? ' L’accès principal est verrouillé ; entrer demandera de le forcer.'
    : ' L’accès principal paraît praticable.';
  return success(
    next,
    'Vous observez les lieux.',
    `Vous prenez le temps de regarder les accès, les vitrages et ce qui est visible depuis l’extérieur. Aucun mouvement humain ne se manifeste.${access}`,
    OBSERVE_SECONDS,
  );
}

export function forcePoiAccess(state: GameState): EngineTransition {
  const location = currentPoiLocation(state);
  const site = location?.poiSite;
  if (!location || !site || site.phase !== 'outside') return failure(state, 'Accès impossible', 'Vous n’êtes pas devant un accès extérieur à forcer.');
  if (!site.observed) return failure(state, 'Accès mal évalué', 'Observez d’abord le lieu avant de tenter de forcer une entrée.');
  if (!site.entranceLocked) return failure(state, 'Accès déjà libre', 'L’entrée ne nécessite pas d’être forcée.');

  const usedCrowbar = hasCrowbar(state);
  const elapsedSeconds = forceDuration(state, FORCE_ENTRANCE_SECONDS);
  const next = cloneState(state);
  const nextSite = next.locations[location.id]?.poiSite;
  if (!nextSite) return failure(state, 'Lieu indisponible', 'Le lieu n’est plus accessible.');
  ensurePoiSiteStructure(nextSite);
  nextSite.entranceLocked = false;
  nextSite.entranceForced = true;
  advanceTime(next, elapsedSeconds);
  applyPhysicalExertion(next, elapsedSeconds, 0.9);
  applyForcedAccessCost(next, usedCrowbar);
  return success(
    next,
    'Vous forcez l’accès.',
    usedCrowbar
      ? 'Le pied-de-biche fait levier efficacement. L’accès cède sans vous obliger à vous exposer longtemps.'
      : 'Sans outil réellement adapté, l’opération est lente, bruyante et éprouvante. L’accès finit par céder.',
    elapsedSeconds,
  );
}

export function enterPoi(state: GameState): EngineTransition {
  const location = currentPoiLocation(state);
  const site = location?.poiSite;
  if (!location || !site) return failure(state, 'Aucune entrée ici', 'Ce lieu ne possède pas encore d’espace à explorer.');
  if (site.phase === 'inside') return failure(state, 'Déjà à l’intérieur', 'Vous êtes déjà entré dans ce lieu.');
  if (!site.observed) return failure(state, 'Accès mal évalué', 'Observez d’abord les abords avant de vous engager à l’intérieur.');
  if (site.entranceLocked) return failure(state, 'Accès verrouillé', 'L’entrée principale est verrouillée.');

  const elapsedSeconds = scalePhysicalDuration(state, ENTER_SECONDS, 'action');
  const next = cloneState(state);
  const nextLocation = next.locations[location.id];
  const nextSite = nextLocation?.poiSite;
  if (!nextLocation || !nextSite) return failure(state, 'Lieu indisponible', 'Le lieu n’est plus accessible.');
  ensurePoiSiteStructure(nextSite);
  const firstZone = nextSite.zones?.[0];
  if (!firstZone) return failure(state, 'Intérieur inaccessible', 'Aucune zone intérieure n’est disponible.');
  nextSite.phase = 'inside';
  nextSite.activeZoneId = firstZone.id;
  const newlyVisible = revealZoneSurface(next, nextLocation, firstZone);
  advanceTime(next, elapsedSeconds);
  applyPhysicalExertion(next, elapsedSeconds, 0.5);
  const visibleText = newlyVisible.length > 0 ? ` Sans fouiller, vous repérez déjà ${newlyVisible.join(' et ')}.` : '';
  return success(
    next,
    `Vous entrez dans ${location.name}.`,
    `Vous débouchez dans ${firstZone.name.toLowerCase()}. L’air et l’acoustique changent aussitôt ; le lieu semble avoir été abandonné en plein fonctionnement.${visibleText}${riskText(firstZone.risk)}${exertionSuffix(state)}`,
    elapsedSeconds,
  );
}

export function movePoiZone(state: GameState, zoneId: string | undefined): EngineTransition {
  const location = currentPoiLocation(state);
  const site = location?.poiSite;
  if (!location || !site || site.phase !== 'inside') return failure(state, 'Déplacement intérieur impossible', 'Vous devez être à l’intérieur du lieu.');
  const target = getPoiZone(site, zoneId);
  if (!target) return failure(state, 'Zone inconnue', 'Cette partie du lieu n’est pas accessible.');
  if (target.id === site.activeZoneId) return failure(state, 'Déjà ici', 'Vous vous trouvez déjà dans cette zone.');
  if (target.locked) return failure(state, 'Accès verrouillé', `L’accès vers ${target.name.toLowerCase()} est verrouillé.`);

  const elapsedSeconds = scalePhysicalDuration(state, MOVE_ZONE_SECONDS, 'action');
  const next = cloneState(state);
  const nextLocation = next.locations[location.id];
  const nextSite = nextLocation?.poiSite;
  if (!nextLocation || !nextSite) return failure(state, 'Lieu indisponible', 'Le lieu n’est plus accessible.');
  ensurePoiSiteStructure(nextSite);
  const nextTarget = getPoiZone(nextSite, target.id);
  if (!nextTarget) return failure(state, 'Zone inconnue', 'Cette partie du lieu n’est plus accessible.');
  nextSite.activeZoneId = nextTarget.id;
  const visible = revealZoneSurface(next, nextLocation, nextTarget);
  advanceTime(next, elapsedSeconds);
  applyPhysicalExertion(next, elapsedSeconds, 0.35);
  return success(
    next,
    `Vous gagnez ${nextTarget.name.toLowerCase()}.`,
    `${visible.length > 0 ? `À première vue, vous repérez ${visible.join(' et ')}. ` : ''}${nextTarget.risk?.discovered && !nextTarget.risk.resolved ? nextTarget.risk.description : 'La zone reste silencieuse.'}`,
    elapsedSeconds,
  );
}

export function forcePoiZone(state: GameState, zoneId: string | undefined): EngineTransition {
  const location = currentPoiLocation(state);
  const site = location?.poiSite;
  if (!location || !site || site.phase !== 'inside') return failure(state, 'Accès impossible', 'Vous devez être à l’intérieur du lieu.');
  const target = getPoiZone(site, zoneId);
  if (!target) return failure(state, 'Zone inconnue', 'Cette partie du lieu n’existe pas.');
  if (!target.locked) return failure(state, 'Accès déjà libre', 'Cette zone ne nécessite pas d’être forcée.');

  const usedCrowbar = hasCrowbar(state);
  const elapsedSeconds = forceDuration(state, FORCE_ZONE_SECONDS);
  const next = cloneState(state);
  const nextLocation = next.locations[location.id];
  const nextSite = nextLocation?.poiSite;
  if (!nextLocation || !nextSite) return failure(state, 'Lieu indisponible', 'Le lieu n’est plus accessible.');
  ensurePoiSiteStructure(nextSite);
  const nextTarget = getPoiZone(nextSite, target.id);
  if (!nextTarget) return failure(state, 'Zone inconnue', 'Cette partie du lieu n’est plus accessible.');
  nextTarget.locked = false;
  nextTarget.discovered = true;
  nextSite.activeZoneId = nextTarget.id;
  const visible = revealZoneSurface(next, nextLocation, nextTarget);
  advanceTime(next, elapsedSeconds);
  applyPhysicalExertion(next, elapsedSeconds, 0.9);
  applyForcedAccessCost(next, usedCrowbar);
  return success(
    next,
    `Vous forcez l’accès vers ${nextTarget.name.toLowerCase()}.`,
    `${usedCrowbar ? 'Le pied-de-biche réduit nettement l’effort nécessaire.' : 'L’accès résiste longtemps avant de céder.'}${visible.length > 0 ? ` Une fois passé, vous repérez ${visible.join(' et ')}.` : ''}${riskText(nextTarget.risk)}`,
    elapsedSeconds,
  );
}

export function securePoiRisk(state: GameState): EngineTransition {
  const location = currentPoiLocation(state);
  const site = location?.poiSite;
  const zone = site ? getActivePoiZone(site) : undefined;
  const risk = zone?.risk;
  if (!location || !site || site.phase !== 'inside' || !zone || !risk?.discovered) return failure(state, 'Rien à sécuriser', 'Aucun risque local clairement identifié ici.');
  if (risk.resolved) return failure(state, 'Zone déjà sécurisée', 'Ce risque a déjà été traité.');

  const elapsedSeconds = scalePhysicalDuration(state, risk.secureSeconds, 'action');
  const next = cloneState(state);
  const nextSite = next.locations[location.id]?.poiSite;
  if (!nextSite) return failure(state, 'Lieu indisponible', 'Le lieu n’est plus accessible.');
  ensurePoiSiteStructure(nextSite);
  const nextRisk = getActivePoiZone(nextSite)?.risk;
  if (!nextRisk) return failure(state, 'Risque disparu', 'Ce risque n’est plus présent.');
  nextRisk.resolved = true;
  advanceTime(next, elapsedSeconds);
  applyPhysicalExertion(next, elapsedSeconds, 0.65);
  return success(next, 'Vous sécurisez la zone.', `${risk.description} Vous prenez le temps de réduire suffisamment le danger avant de poursuivre.`, elapsedSeconds);
}

export function searchLocation(state: GameState): EngineTransition {
  const location = currentPoiLocation(state);
  const site = location?.poiSite;
  const zone = site ? getActivePoiZone(site) : undefined;
  if (!location || !site || !zone) return failure(state, 'Rien à fouiller ici', 'Cette zone ne possède pas de fouille persistante.');
  if (site.phase !== 'inside') return failure(state, 'Vous êtes dehors', 'Entrez dans le lieu avant de commencer une fouille méthodique.');
  if (zone.searched) return failure(state, 'Zone déjà fouillée', `Vous avez déjà inspecté méthodiquement ${zone.name.toLowerCase()}.`);

  const elapsedSeconds = scalePhysicalDuration(state, SEARCH_SECONDS, 'action');
  const next = cloneState(state);
  const nextLocation = next.locations[location.id];
  const nextSite = nextLocation?.poiSite;
  if (!nextLocation || !nextSite) return failure(state, 'Lieu indisponible', 'Le lieu n’est plus accessible.');
  ensurePoiSiteStructure(nextSite);
  const nextZone = getActivePoiZone(nextSite);
  if (!nextZone) return failure(state, 'Zone indisponible', 'Cette partie du lieu n’est plus accessible.');
  nextZone.searched = true;
  nextSite.searched = true;
  const found = revealLootLayer(next, nextLocation, nextZone, 'deep');
  const incident = nextZone.risk?.discovered && !nextZone.risk.resolved ? applyRiskIncident(next, nextZone.risk) : '';
  let clueText = '';
  if (nextZone.clue && !nextZone.clue.discovered) {
    nextZone.clue.discovered = true;
    clueText = ` Indice : ${nextZone.clue.text}`;
  }
  advanceTime(next, elapsedSeconds);
  applyPhysicalExertion(next, elapsedSeconds, 0.75);
  const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
  return success(
    next,
    `Vous fouillez ${nextZone.name.toLowerCase()} méthodiquement.`,
    `${found.length > 0 ? `Après environ ${minutes} minutes, vous découvrez ${found.join(', ')}.` : `Après environ ${minutes} minutes, rien de réellement exploitable ne se révèle.`}${incident}${clueText}${exertionSuffix(state)}`,
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
  delete nextSite.activeZoneId;
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
  if (distanceM === null) return failure(state, 'Impossible depuis ici', 'Vous devez d’abord rejoindre l’extérieur avant de circuler dans le quartier.');
  if (distanceM > MAX_FREE_WALK_DISTANCE_M) return failure(state, 'Trop loin en une fois', `Choisissez un point situé à moins de ${MAX_FREE_WALK_DISTANCE_M} m pour avancer progressivement.`);
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
  return success(next, 'Vous avancez à pied.', `Vous parcourez environ ${Math.max(1, Math.round(distanceM))} m.${exertionSuffix(state)}`, elapsedSeconds);
}

export function travelToMapPoi(state: GameState, encodedTarget: string | undefined): EngineTransition {
  const blocked = requireOutsideForMapTravel(state);
  if (blocked) return blocked;
  const target = parseTarget(encodedTarget);
  if (!target) return failure(state, 'Destination invalide', 'Ce point de la carte ne peut pas être utilisé comme destination.');

  const distanceM = distanceToTarget(state, target);
  if (distanceM === null) return failure(state, 'Impossible depuis ici', 'Vous devez d’abord rejoindre l’extérieur avant de vous déplacer vers un point de la carte.');
  if (distanceM > MAX_MAP_TRAVEL_DISTANCE_M) return failure(state, 'Trop loin à pied', 'Cette destination dépasse encore votre zone d’exploration immédiate.');

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
        poiSite: createPoiSiteState(target.id, target.category, target.typeLabel),
      };
    } else if (!existing.poiSite) {
      existing.poiSite = createPoiSiteState(target.id, target.category, target.typeLabel);
    } else {
      ensurePoiSiteStructure(existing.poiSite);
      if (target.category && existing.poiSite.category === 'Inconnu') existing.poiSite.category = createPoiSiteState(target.id, target.category, target.typeLabel).category;
      if (target.typeLabel && !existing.poiSite.typeLabel) existing.poiSite.typeLabel = target.typeLabel;
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