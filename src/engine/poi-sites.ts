import type { PoiRiskKind, PoiSiteCategory, PoiSiteState, PoiZoneState } from './model';

type RawRisk = [PoiRiskKind, string, string, number, number, number, number];
type RawZone = [string, string, boolean, string[], string[], RawRisk?, string?, number?, boolean?, string?];
type Blueprint = [boolean, RawZone[]];

const GENERIC: PoiZoneState[] = [
  { id: 'main', name: 'Zone principale', locked: false, discovered: true, surfaceRevealed: false, searched: false, searchSeconds: 2700, searchProgressSeconds: 0, surfaceLootIds: ['water_bottle'], deepLootIds: ['flashlight', 'canned_food', 'towel'], revealsZoneId: 'secondary' },
  { id: 'secondary', name: 'Zone secondaire', locked: true, discovered: false, hidden: true, surfaceRevealed: false, searched: false, searchSeconds: 3600, searchProgressSeconds: 0, surfaceLootIds: ['key'], deepLootIds: ['crowbar', 'water_bottle'] },
];

export function stablePoiHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function normalizePoiCategory(value: string | undefined): PoiSiteCategory {
  return value === 'Industrie' || value === 'Commerce' || value === 'Santé' || value === 'Automobile'
    || value === 'Services publics' || value === 'Résidentiel' ? value : 'Inconnu';
}

function genericZones(): PoiZoneState[] { return structuredClone(GENERIC); }

function decode(sourceId: string, value: unknown): PoiZoneState[] | null {
  if (!Array.isArray(value) || !Array.isArray(value[1])) return null;
  const zones = (value as Blueprint)[1].slice(0, 6).map((row): PoiZoneState | null => {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'string') return null;
    const [id, name, locked, surface = [], deep = [], rawRisk, clue, searchMinutes, hidden, revealsZoneId] = row;
    const risk = Array.isArray(rawRisk) ? {
      id: `${id}_${rawRisk[0]}_${stablePoiHash(`${sourceId}:${id}:risk`).toString(16)}`,
      kind: rawRisk[0], label: rawRisk[1], description: rawRisk[2], discovered: false, resolved: false, triggered: false,
      secureSeconds: rawRisk[3], painPenalty: rawRisk[4], fatiguePenalty: rawRisk[5], stressPenalty: rawRisk[6],
    } : undefined;
    return {
      id: id.slice(0, 60), name: name.slice(0, 100), locked: locked === true, discovered: hidden !== true, hidden: hidden === true,
      surfaceRevealed: false, searched: false, searchSeconds: Math.round((searchMinutes ?? 45) * 60), searchProgressSeconds: 0,
      surfaceLootIds: surface.slice(0, 8), deepLootIds: deep.slice(0, 8),
      ...(revealsZoneId ? { revealsZoneId: revealsZoneId.slice(0, 60) } : {}),
      ...(risk ? { risk } : {}),
      ...(clue ? { clue: { id: `${id}_clue_${stablePoiHash(`${sourceId}:${id}:clue`).toString(16)}`, text: clue.slice(0, 320), discovered: false } } : {}),
    };
  }).filter((zone): zone is PoiZoneState => zone !== null);
  return zones.length ? zones : null;
}

export function createPoiSiteState(sourceId: string, categoryValue?: string, typeLabel?: string, blueprint?: unknown): PoiSiteState {
  const zones = decode(sourceId, blueprint);
  return {
    sourceId, category: normalizePoiCategory(categoryValue), ...(typeLabel ? { typeLabel } : {}), phase: 'outside', observed: false,
    entranceLocked: Array.isArray(blueprint) && blueprint[0] === true, entranceForced: false, surfaceRevealed: false,
    searched: false, zones: zones ?? genericZones(),
  };
}

export function ensurePoiSiteStructure(site: PoiSiteState): PoiSiteState {
  site.category = normalizePoiCategory(site.category);
  site.entranceLocked ??= false;
  site.entranceForced ??= false;
  if (!site.zones?.length) site.zones = genericZones();
  for (const zone of site.zones) {
    zone.searchSeconds ??= 2700;
    zone.searchProgressSeconds ??= zone.searched ? zone.searchSeconds : 0;
    zone.hidden ??= false;
  }
  return site;
}

export function poiZones(site: PoiSiteState): PoiZoneState[] { return site.zones?.length ? site.zones : genericZones(); }
export function discoveredPoiZones(site: PoiSiteState): PoiZoneState[] { return poiZones(site).filter((zone) => zone.discovered); }
export function getPoiZone(site: PoiSiteState, zoneId: string | undefined): PoiZoneState | undefined {
  const zones = poiZones(site);
  return zoneId ? zones.find((zone) => zone.id === zoneId) : zones[0];
}
export function getActivePoiZone(site: PoiSiteState): PoiZoneState | undefined { return getPoiZone(site, site.activeZoneId); }
export function getPoiZoneSearchSeconds(zone: PoiZoneState): number { return zone.searchSeconds ?? 2700; }
export function getPoiZoneSearchProgressSeconds(zone: PoiZoneState): number { return zone.searchProgressSeconds ?? (zone.searched ? getPoiZoneSearchSeconds(zone) : 0); }
export function getPoiZoneSearchRemainingSeconds(zone: PoiZoneState): number { return Math.max(0, getPoiZoneSearchSeconds(zone) - getPoiZoneSearchProgressSeconds(zone)); }
export function getPoiLootDefinitionIds(site: PoiSiteState, zoneId: string, layer: 'surface' | 'deep'): readonly string[] {
  const zone = getPoiZone(site, zoneId);
  return layer === 'surface' ? zone?.surfaceLootIds ?? [] : zone?.deepLootIds ?? [];
}
