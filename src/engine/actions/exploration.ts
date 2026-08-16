import { getItemDefinition } from '../../content/items';
import { applyPhysicalExertion, scalePhysicalDuration } from '../encumbrance';
import type { EngineTransition, GameState, ItemState, LocationState, PoiRiskState, PoiZoneState } from '../model';
import { getDistanceMeters } from '../perception';
import { createPoiSiteState, ensurePoiSiteStructure, getActivePoiZone, getPoiLootDefinitionIds, getPoiZone, stablePoiHash } from '../poi-sites';
import { cloneState, clampNeeds, recordLocationVisit } from '../state';
import { advanceTime } from '../time';
import { failure, success } from './result';

interface MapTravelTarget { id: string; name: string; lat: number; lon: number; category?: string; typeLabel?: string; blueprint?: unknown; }

function parseTarget(value: string | undefined): MapTravelTarget | null {
  if (!value) return null;
  try {
    const p = JSON.parse(decodeURIComponent(value)) as Partial<MapTravelTarget>;
    const id = typeof p.id === 'string' ? p.id.trim() : '';
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    const lat = Number(p.lat), lon = Number(p.lon);
    if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -85 || lat > 85 || lon < -180 || lon > 180) return null;
    return {
      id: id.slice(0, 120), name: name.slice(0, 120), lat, lon,
      ...(typeof p.category === 'string' ? { category: p.category.slice(0, 60) } : {}),
      ...(typeof p.typeLabel === 'string' ? { typeLabel: p.typeLabel.slice(0, 80) } : {}),
      ...(p.blueprint !== undefined ? { blueprint: p.blueprint } : {}),
    };
  } catch { return null; }
}

function currentPoi(state: GameState): LocationState | null {
  const location = state.locations[state.player.locationId];
  return location?.poiSite ? location : null;
}

function distance(state: GameState, target: MapTravelTarget): number | null {
  return getDistanceMeters(state, state.player.locationId, null, { lat: target.lat, lon: target.lon });
}

function mapBlocked(state: GameState): EngineTransition | null {
  return currentPoi(state)?.poiSite?.phase === 'inside'
    ? failure(state, 'Vous êtes à l’intérieur', 'Sortez d’abord avant de reprendre votre déplacement.')
    : null;
}

function createLoot(locationId: string, sourceId: string, zoneId: string, layer: 'surface' | 'deep', index: number, definitionId: string): ItemState {
  const definition = getItemDefinition(definitionId);
  const item: ItemState = {
    id: `${locationId}_loot_${stablePoiHash(`${sourceId}:${zoneId}:${layer}:${index}:${definitionId}`).toString(16)}`,
    definitionId, name: definition?.name ?? 'Objet', location: { kind: 'location', id: locationId }, examined: false, poiZoneId: zoneId, condition: 'Utilisable',
  };
  if (definitionId === 'water_bottle') { item.liquidMl = 500; item.capacityMl = 500; item.condition = 'Fermée'; }
  else if (definitionId === 'apple') { item.freshnessPercent = 82; item.condition = 'Encore ferme'; }
  else if (definitionId === 'flashlight') { item.batteryPercent = 61; item.enabled = false; item.condition = 'Bon état'; }
  return item;
}

function reveal(state: GameState, location: LocationState, zone: PoiZoneState, layer: 'surface' | 'deep'): string[] {
  const site = location.poiSite;
  if (!site) return [];
  return getPoiLootDefinitionIds(site, zone.id, layer).map((definitionId, index) => {
    const item = createLoot(location.id, site.sourceId, zone.id, layer, index, definitionId);
    state.items[item.id] ??= item;
    return item.name.toLowerCase();
  });
}

function revealSurface(state: GameState, location: LocationState, zone: PoiZoneState): string[] {
  const site = location.poiSite;
  if (!site) return [];
  zone.discovered = true;
  if (zone.risk) zone.risk.discovered = true;
  if (zone.surfaceRevealed) return [];
  zone.surfaceRevealed = true;
  site.surfaceRevealed = true;
  return reveal(state, location, zone, 'surface');
}

function hasCrowbar(state: GameState): boolean { return state.player.inventoryIds.some((id) => state.items[id]?.definitionId === 'crowbar'); }
function forceTime(state: GameState, seconds: number): number { return scalePhysicalDuration(state, hasCrowbar(state) ? Math.round(seconds * 0.45) : seconds, 'action'); }
function noToolCost(state: GameState, tool: boolean): void { if (!tool) { state.player.needs.pain += 0.5; state.player.needs.stress += 1.5; clampNeeds(state); } }
function riskText(risk: PoiRiskState | undefined): string { return risk?.discovered && !risk.resolved ? ` Risque : ${risk.label.toLowerCase()}.` : ''; }
function triggerRisk(state: GameState, risk: PoiRiskState): string {
  risk.triggered = risk.resolved = true;
  state.player.needs.pain += risk.painPenalty;
  state.player.needs.fatigue += risk.fatiguePenalty;
  state.player.needs.stress += risk.stressPenalty;
  clampNeeds(state);
  return ` En fouillant sans sécuriser la zone, ${risk.label.toLowerCase()} vous atteint.`;
}

export function observeLocation(state: GameState): EngineTransition {
  const location = currentPoi(state), site = location?.poiSite;
  if (!location || !site) return failure(state, 'Rien à observer ici', 'Aucun lieu à observer.');
  if (site.phase !== 'outside') return failure(state, 'Déjà à l’intérieur', 'Vous êtes déjà dedans.');
  if (site.observed) return failure(state, 'Déjà observé', 'Les abords sont déjà connus.');
  const next = cloneState(state), nextSite = next.locations[location.id]?.poiSite;
  if (!nextSite) return failure(state, 'Lieu indisponible', 'Lieu inaccessible.');
  ensurePoiSiteStructure(nextSite); nextSite.observed = true; advanceTime(next, 25);
  return success(next, 'Vous observez les lieux.', nextSite.entranceLocked ? 'Aucun mouvement. L’accès est verrouillé.' : 'Aucun mouvement. L’accès paraît praticable.', 25);
}

export function forcePoiAccess(state: GameState): EngineTransition {
  const location = currentPoi(state), site = location?.poiSite;
  if (!location || !site || site.phase !== 'outside') return failure(state, 'Accès impossible', 'Pas d’accès extérieur ici.');
  if (!site.observed) return failure(state, 'Accès mal évalué', 'Observez d’abord le lieu.');
  if (!site.entranceLocked) return failure(state, 'Accès déjà libre', 'L’accès est libre.');
  const tool = hasCrowbar(state), seconds = forceTime(state, 240), next = cloneState(state), nextSite = next.locations[location.id]?.poiSite;
  if (!nextSite) return failure(state, 'Lieu indisponible', 'Lieu inaccessible.');
  nextSite.entranceLocked = false; nextSite.entranceForced = true;
  advanceTime(next, seconds); applyPhysicalExertion(next, seconds, 0.9); noToolCost(next, tool);
  return success(next, 'Vous forcez l’accès.', tool ? 'Le pied-de-biche fait céder l’accès.' : 'L’accès finit par céder après un effort bruyant.', seconds);
}

export function enterPoi(state: GameState): EngineTransition {
  const location = currentPoi(state), site = location?.poiSite;
  if (!location || !site) return failure(state, 'Aucune entrée ici', 'Aucun intérieur accessible.');
  if (site.phase === 'inside') return failure(state, 'Déjà à l’intérieur', 'Vous êtes déjà dedans.');
  if (!site.observed) return failure(state, 'Accès mal évalué', 'Observez d’abord le lieu.');
  if (site.entranceLocked) return failure(state, 'Accès verrouillé', 'L’entrée est verrouillée.');
  const seconds = scalePhysicalDuration(state, 12, 'action'), next = cloneState(state), nextLocation = next.locations[location.id], nextSite = nextLocation?.poiSite;
  if (!nextLocation || !nextSite) return failure(state, 'Lieu indisponible', 'Lieu inaccessible.');
  ensurePoiSiteStructure(nextSite);
  const zone = nextSite.zones?.[0];
  if (!zone) return failure(state, 'Intérieur inaccessible', 'Aucune zone intérieure.');
  nextSite.phase = 'inside'; nextSite.activeZoneId = zone.id;
  const visible = revealSurface(next, nextLocation, zone);
  advanceTime(next, seconds); applyPhysicalExertion(next, seconds, 0.5);
  return success(next, `Vous entrez dans ${location.name}.`, `${zone.name}.${visible.length ? ` Vous repérez ${visible.join(' et ')}.` : ''}${riskText(zone.risk)}`, seconds);
}

export function movePoiZone(state: GameState, zoneId: string | undefined): EngineTransition {
  const location = currentPoi(state), site = location?.poiSite;
  if (!location || !site || site.phase !== 'inside') return failure(state, 'Déplacement impossible', 'Vous devez être à l’intérieur.');
  const target = getPoiZone(site, zoneId);
  if (!target) return failure(state, 'Zone inconnue', 'Zone inaccessible.');
  if (target.id === site.activeZoneId) return failure(state, 'Déjà ici', 'Vous êtes déjà ici.');
  if (target.locked) return failure(state, 'Accès verrouillé', 'Cette zone est verrouillée.');
  const seconds = scalePhysicalDuration(state, 18, 'action'), next = cloneState(state), nextLocation = next.locations[location.id], nextSite = nextLocation?.poiSite;
  if (!nextLocation || !nextSite) return failure(state, 'Lieu indisponible', 'Lieu inaccessible.');
  const nextTarget = getPoiZone(nextSite, target.id);
  if (!nextTarget) return failure(state, 'Zone inconnue', 'Zone inaccessible.');
  nextSite.activeZoneId = nextTarget.id;
  const visible = revealSurface(next, nextLocation, nextTarget);
  advanceTime(next, seconds); applyPhysicalExertion(next, seconds, 0.35);
  return success(next, `Vous gagnez ${nextTarget.name.toLowerCase()}.`, `${visible.length ? `Vous repérez ${visible.join(' et ')}.` : 'La zone reste silencieuse.'}${riskText(nextTarget.risk)}`, seconds);
}

export function forcePoiZone(state: GameState, zoneId: string | undefined): EngineTransition {
  const location = currentPoi(state), site = location?.poiSite;
  if (!location || !site || site.phase !== 'inside') return failure(state, 'Accès impossible', 'Vous devez être à l’intérieur.');
  const target = getPoiZone(site, zoneId);
  if (!target) return failure(state, 'Zone inconnue', 'Zone inconnue.');
  if (!target.locked) return failure(state, 'Accès déjà libre', 'Cette zone est ouverte.');
  const tool = hasCrowbar(state), seconds = forceTime(state, 180), next = cloneState(state), nextLocation = next.locations[location.id], nextSite = nextLocation?.poiSite;
  if (!nextLocation || !nextSite) return failure(state, 'Lieu indisponible', 'Lieu inaccessible.');
  const nextTarget = getPoiZone(nextSite, target.id);
  if (!nextTarget) return failure(state, 'Zone inconnue', 'Zone inaccessible.');
  nextTarget.locked = false; nextTarget.discovered = true; nextSite.activeZoneId = nextTarget.id;
  const visible = revealSurface(next, nextLocation, nextTarget);
  advanceTime(next, seconds); applyPhysicalExertion(next, seconds, 0.9); noToolCost(next, tool);
  return success(next, `Vous forcez l’accès vers ${nextTarget.name.toLowerCase()}.`, `${tool ? 'Le pied-de-biche facilite l’ouverture.' : 'L’accès finit par céder.'}${visible.length ? ` Vous repérez ${visible.join(' et ')}.` : ''}${riskText(nextTarget.risk)}`, seconds);
}

export function securePoiRisk(state: GameState): EngineTransition {
  const location = currentPoi(state), site = location?.poiSite, zone = site ? getActivePoiZone(site) : undefined, risk = zone?.risk;
  if (!location || !site || site.phase !== 'inside' || !zone || !risk?.discovered) return failure(state, 'Rien à sécuriser', 'Aucun risque identifié.');
  if (risk.resolved) return failure(state, 'Zone déjà sécurisée', 'Risque déjà traité.');
  const seconds = scalePhysicalDuration(state, risk.secureSeconds, 'action'), next = cloneState(state), nextRisk = next.locations[location.id]?.poiSite ? getActivePoiZone(next.locations[location.id]!.poiSite!)?.risk : undefined;
  if (!nextRisk) return failure(state, 'Risque disparu', 'Risque absent.');
  nextRisk.resolved = true; advanceTime(next, seconds); applyPhysicalExertion(next, seconds, 0.65);
  return success(next, 'Vous sécurisez la zone.', risk.description, seconds);
}

export function searchLocation(state: GameState): EngineTransition {
  const location = currentPoi(state), site = location?.poiSite, zone = site ? getActivePoiZone(site) : undefined;
  if (!location || !site || !zone) return failure(state, 'Rien à fouiller ici', 'Aucune zone à fouiller.');
  if (site.phase !== 'inside') return failure(state, 'Vous êtes dehors', 'Entrez avant de fouiller.');
  if (zone.searched) return failure(state, 'Zone déjà fouillée', 'Cette zone est déjà fouillée.');
  const seconds = scalePhysicalDuration(state, 720, 'action'), next = cloneState(state), nextLocation = next.locations[location.id], nextSite = nextLocation?.poiSite;
  if (!nextLocation || !nextSite) return failure(state, 'Lieu indisponible', 'Lieu inaccessible.');
  const nextZone = getActivePoiZone(nextSite);
  if (!nextZone) return failure(state, 'Zone indisponible', 'Zone inaccessible.');
  nextZone.searched = true; nextSite.searched = true;
  const found = reveal(next, nextLocation, nextZone, 'deep');
  const incident = nextZone.risk?.discovered && !nextZone.risk.resolved ? triggerRisk(next, nextZone.risk) : '';
  let clue = '';
  if (nextZone.clue && !nextZone.clue.discovered) { nextZone.clue.discovered = true; clue = ` Indice : ${nextZone.clue.text}`; }
  advanceTime(next, seconds); applyPhysicalExertion(next, seconds, 0.75);
  const minutes = Math.max(1, Math.round(seconds / 60));
  return success(next, `Vous fouillez ${nextZone.name.toLowerCase()} méthodiquement.`, `${found.length ? `Après environ ${minutes} minutes, vous découvrez ${found.join(', ')}.` : `Après environ ${minutes} minutes, rien d’exploitable.`}${incident}${clue}`, seconds);
}

export function leavePoi(state: GameState): EngineTransition {
  const location = currentPoi(state), site = location?.poiSite;
  if (!location || !site || site.phase !== 'inside') return failure(state, 'Déjà dehors', 'Vous êtes déjà dehors.');
  const seconds = scalePhysicalDuration(state, 8, 'action'), next = cloneState(state), nextSite = next.locations[location.id]?.poiSite;
  if (!nextSite) return failure(state, 'Lieu indisponible', 'Lieu inaccessible.');
  nextSite.phase = 'outside'; delete nextSite.activeZoneId;
  advanceTime(next, seconds); applyPhysicalExertion(next, seconds, 0.5);
  return success(next, `Vous ressortez de ${location.name}.`, 'Vous retrouvez l’extérieur.', seconds);
}

export function walkToMapPoint(state: GameState, encodedTarget: string | undefined): EngineTransition {
  const blocked = mapBlocked(state); if (blocked) return blocked;
  const target = parseTarget(encodedTarget); if (!target) return failure(state, 'Destination invalide', 'Point invalide.');
  const meters = distance(state, target);
  if (meters === null) return failure(state, 'Impossible depuis ici', 'Vous devez d’abord rejoindre l’extérieur.');
  if (meters > 120) return failure(state, 'Trop loin en une fois', 'Choisissez un point à moins de 120 m.');
  if (meters < 2) return failure(state, 'Déjà ici', 'Vous êtes déjà ici.');
  const seconds = scalePhysicalDuration(state, Math.max(2, Math.round(meters / 1.25)), 'movement'), next = cloneState(state), origin = next.locations[state.player.locationId];
  next.locations.map_walk_position = { id: 'map_walk_position', name: 'Rue / extérieur', ambientTemperatureC: origin?.ambientTemperatureC ?? 20, ambientHumidityPercent: origin?.ambientHumidityPercent ?? 50, ventilation: 1, features: {}, position: { lat: target.lat, lon: target.lon } };
  next.player.locationId = 'map_walk_position'; recordLocationVisit(next, 'map_walk_position'); advanceTime(next, seconds); applyPhysicalExertion(next, seconds, 1);
  return success(next, 'Vous avancez à pied.', `Vous parcourez environ ${Math.max(1, Math.round(meters))} m.`, seconds);
}

export function travelToMapPoi(state: GameState, encodedTarget: string | undefined): EngineTransition {
  const blocked = mapBlocked(state); if (blocked) return blocked;
  const target = parseTarget(encodedTarget); if (!target) return failure(state, 'Destination invalide', 'Destination invalide.');
  const meters = distance(state, target);
  if (meters === null) return failure(state, 'Impossible depuis ici', 'Vous devez d’abord rejoindre l’extérieur.');
  if (meters > 1600) return failure(state, 'Trop loin à pied', 'Destination trop éloignée.');
  const seconds = scalePhysicalDuration(state, Math.max(15, Math.round(meters / 1.25)), 'movement'), next = cloneState(state);
  let destinationId: string;
  if (target.id === 'home') {
    destinationId = 'garden';
    if (!next.locations.garden) return failure(state, 'Domicile inaccessible', 'Domicile absent.');
  } else {
    destinationId = `map_poi_${stablePoiHash(target.id).toString(16)}`;
    const existing = next.locations[destinationId];
    if (!existing) {
      const origin = next.locations[state.player.locationId];
      next.locations[destinationId] = { id: destinationId, name: target.name, ambientTemperatureC: origin?.ambientTemperatureC ?? 20, ambientHumidityPercent: origin?.ambientHumidityPercent ?? 50, ventilation: 1, features: {}, position: { lat: target.lat, lon: target.lon }, poiSite: createPoiSiteState(target.id, target.category, target.typeLabel, target.blueprint) };
    } else if (!existing.poiSite) existing.poiSite = createPoiSiteState(target.id, target.category, target.typeLabel, target.blueprint);
    else if (target.category && existing.poiSite.category === 'Inconnu' && !existing.poiSite.observed && !existing.poiSite.searched) existing.poiSite = createPoiSiteState(target.id, target.category, target.typeLabel, target.blueprint);
    else { ensurePoiSiteStructure(existing.poiSite); if (target.typeLabel && !existing.poiSite.typeLabel) existing.poiSite.typeLabel = target.typeLabel; }
  }
  next.player.locationId = destinationId; recordLocationVisit(next, destinationId); advanceTime(next, seconds); applyPhysicalExertion(next, seconds, 1);
  return success(next, target.id === 'home' ? 'Retour au domicile' : target.name, `Vous parcourez environ ${Math.max(1, Math.round(meters))} m à pied.`, seconds);
}