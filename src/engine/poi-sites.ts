import type { PoiClueState, PoiRiskKind, PoiRiskState, PoiSiteCategory, PoiSiteState, PoiZoneState } from './model';

type RiskKey = 'glass' | 'shelf' | 'electric' | 'dark';
type RiskSpec = readonly [PoiRiskKind, string, string, number, number, number, number];
type ZoneSpec = readonly [string, string, boolean, readonly string[], readonly string[], (RiskKey | undefined)?, string?];
type ProfileSpec = readonly [0 | 1 | 2, readonly ZoneSpec[]];

const R: Readonly<Record<RiskKey, RiskSpec>> = Object.freeze({
  glass: ['debris', 'Verre et débris au sol', 'Du verre et des objets renversés rendent la fouille risquée.', 90, 1.5, 1, 1],
  shelf: ['unstable_storage', 'Rayonnage instable', 'Un rangement penche dangereusement et pourrait céder.', 150, 2, 1.5, 1],
  electric: ['electrical', 'Installation électrique dégradée', 'Des câbles et appareils sont dans un état douteux.', 180, 2, 1, 2],
  dark: ['darkness', 'Zone sombre et encombrée', 'La lumière pénètre mal et des obstacles restent difficiles à distinguer.', 120, 1, 1, 1.5],
});

const P: Readonly<Record<PoiSiteCategory, ProfileSpec>> = Object.freeze({
  Automobile: [0, [
    ['shop', 'Boutique / accueil', false, ['water_bottle'], ['canned_food', 'flashlight', 'work_gloves'], 'glass', 'Une transaction est restée inachevée près de la caisse, sans signe de lutte.'],
    ['stock', 'Réserve', true, ['work_gloves'], ['tool_kit', 'water_bottle', 'crowbar'], 'shelf'],
    ['technical', 'Local technique', false, ['empty_fuel_can'], ['flashlight', 'tool_kit'], 'electric'],
  ]],
  Commerce: [0, [
    ['sales', 'Surface de vente', false, ['apple'], ['water_bottle', 'canned_food', 'canned_food'], 'glass', 'Des paniers à moitié remplis sont restés sur place, comme interrompus au même instant.'],
    ['stock', 'Réserve', true, ['canned_food'], ['water_bottle', 'backpack', 'canned_food'], 'shelf'],
    ['office', 'Bureau / locaux du personnel', false, ['key'], ['flashlight', 'waist_bag']],
  ]],
  Santé: [1, [
    ['public', 'Accueil / officine', false, ['bandage_pack'], ['bandage_pack', 'first_aid_kit', 'water_bottle'], undefined, 'Dossiers et préparations sont restés ouverts, sans consigne d’évacuation.'],
    ['medical_stock', 'Réserve médicale', true, ['bandage_pack'], ['first_aid_kit', 'bandage_pack', 'bandage_pack'], 'shelf'],
    ['back_room', 'Arrière-boutique / bureau', false, ['key'], ['flashlight', 'waist_bag']],
  ]],
  'Services publics': [1, [
    ['reception', 'Accueil', false, ['flashlight'], ['water_bottle', 'first_aid_kit'], undefined, 'Un registre de service s’interrompt sans mentionner d’alerte inhabituelle.'],
    ['office', 'Bureaux', false, ['key'], ['waist_bag', 'flashlight']],
    ['secure', 'Local sécurisé', true, ['work_gloves'], ['crowbar', 'first_aid_kit', 'tool_kit'], 'dark'],
  ]],
  Industrie: [1, [
    ['workshop', 'Atelier / zone de travail', false, ['work_gloves'], ['tool_kit', 'crowbar', 'flashlight'], 'electric', 'Des machines sont restées en plein cycle, sans procédure d’arrêt.'],
    ['warehouse', 'Stock / entrepôt', false, ['empty_fuel_can'], ['hiking_backpack', 'tool_kit', 'water_bottle'], 'shelf'],
    ['office', 'Bureau technique', true, ['key'], ['flashlight', 'first_aid_kit']],
  ]],
  Résidentiel: [2, [
    ['living', 'Entrée / séjour', false, ['water_bottle'], ['flashlight', 'canned_food', 'waist_bag'], undefined, 'Des objets personnels sont restés en place ; aucun départ ne semble avoir été préparé.'],
    ['kitchen', 'Cuisine', false, ['apple'], ['water_bottle', 'canned_food', 'towel'], 'glass'],
    ['bedroom', 'Chambre', true, ['wristwatch'], ['backpack', 'key', 'first_aid_kit']],
  ]],
  Inconnu: [0, [
    ['main', 'Zone principale', false, ['water_bottle'], ['flashlight', 'canned_food', 'towel'], 'dark', 'Le lieu paraît avoir été laissé en plein usage, sans évacuation organisée.'],
    ['secondary', 'Zone secondaire', true, ['key'], ['crowbar', 'water_bottle']],
  ]],
});

export function stablePoiHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function normalizePoiCategory(value: string | undefined): PoiSiteCategory {
  return value === 'Industrie' || value === 'Commerce' || value === 'Santé' || value === 'Automobile'
    || value === 'Services publics' || value === 'Résidentiel' ? value : 'Inconnu';
}

function risk(sourceId: string, zoneId: string, key: RiskKey): PoiRiskState {
  const [kind, label, description, secureSeconds, painPenalty, fatiguePenalty, stressPenalty] = R[key];
  return {
    id: `${zoneId}_${kind}_${stablePoiHash(`${sourceId}:${zoneId}:risk`).toString(16)}`,
    kind, label, description, discovered: false, resolved: false, triggered: false,
    secureSeconds, painPenalty, fatiguePenalty, stressPenalty,
  };
}

function clue(sourceId: string, zoneId: string, text: string): PoiClueState {
  return { id: `${zoneId}_clue_${stablePoiHash(`${sourceId}:${zoneId}:clue`).toString(16)}`, text, discovered: false };
}

function zones(sourceId: string, category: PoiSiteCategory): PoiZoneState[] {
  return P[category][1].map((spec, index) => ({
    id: spec[0], name: spec[1], locked: spec[2], discovered: index === 0, surfaceRevealed: false, searched: false,
    ...(spec[5] ? { risk: risk(sourceId, spec[0], spec[5]) } : {}),
    ...(spec[6] ? { clue: clue(sourceId, spec[0], spec[6]) } : {}),
  }));
}

function isEntranceLocked(sourceId: string, category: PoiSiteCategory): boolean {
  const rule = P[category][0];
  return rule === 1 || (rule === 2 && stablePoiHash(sourceId) % 2 === 0);
}

export function createPoiSiteState(sourceId: string, categoryValue?: string, typeLabel?: string): PoiSiteState {
  const category = normalizePoiCategory(categoryValue);
  return {
    sourceId, category, ...(typeLabel ? { typeLabel } : {}), phase: 'outside', observed: false,
    entranceLocked: isEntranceLocked(sourceId, category), entranceForced: false, surfaceRevealed: false,
    searched: false, zones: zones(sourceId, category),
  };
}

export function ensurePoiSiteStructure(site: PoiSiteState): PoiSiteState {
  const category = normalizePoiCategory(site.category);
  site.category = category;
  if (site.entranceLocked === undefined) site.entranceLocked = isEntranceLocked(site.sourceId, category);
  if (site.entranceForced === undefined) site.entranceForced = false;
  if (!site.zones?.length) site.zones = zones(site.sourceId, category);
  return site;
}

export function poiZones(site: PoiSiteState): PoiZoneState[] {
  return site.zones?.length ? site.zones : zones(site.sourceId, normalizePoiCategory(site.category));
}

export function getPoiZone(site: PoiSiteState, zoneId: string | undefined): PoiZoneState | undefined {
  const list = poiZones(site);
  return zoneId ? list.find((zone) => zone.id === zoneId) : list[0];
}

export function getActivePoiZone(site: PoiSiteState): PoiZoneState | undefined {
  return getPoiZone(site, site.activeZoneId);
}

export function getPoiLootDefinitionIds(site: PoiSiteState, zoneId: string, layer: 'surface' | 'deep'): readonly string[] {
  const spec = P[normalizePoiCategory(site.category)][1].find((zone) => zone[0] === zoneId);
  return spec?.[layer === 'surface' ? 3 : 4] ?? [];
}