import type { PoiRiskKind, PoiRiskState, PoiSiteCategory, PoiSiteState, PoiZoneState } from './model';

const RISK_KINDS = new Set<PoiRiskKind>(['debris', 'unstable_storage', 'chemical', 'electrical', 'darkness']);
const GENERIC_SURFACE = ['water_bottle'];
const GENERIC_DEEP = ['flashlight', 'canned_food', 'towel'];

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

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loot(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((entry) => text(entry, 60)).filter(Boolean);
}

function parseRisk(sourceId: string, zoneId: string, value: unknown): PoiRiskState | undefined {
  if (!Array.isArray(value)) return undefined;
  const kind = text(value[0], 40) as PoiRiskKind;
  if (!RISK_KINDS.has(kind)) return undefined;
  const label = text(value[1], 100);
  const description = text(value[2], 240);
  if (!label || !description) return undefined;
  return {
    id: `${zoneId}_${kind}_${stablePoiHash(`${sourceId}:${zoneId}:risk`).toString(16)}`,
    kind,
    label,
    description,
    discovered: false,
    resolved: false,
    triggered: false,
    secureSeconds: Math.max(1, Math.round(number(value[3], 120))),
    painPenalty: Math.max(0, number(value[4])),
    fatiguePenalty: Math.max(0, number(value[5])),
    stressPenalty: Math.max(0, number(value[6])),
  };
}

function parseBlueprint(sourceId: string, value: unknown): { entranceLocked: boolean; zones: PoiZoneState[] } | null {
  if (!Array.isArray(value) || !Array.isArray(value[1])) return null;
  const zones: PoiZoneState[] = [];
  for (const [index, raw] of value[1].slice(0, 5).entries()) {
    if (!Array.isArray(raw)) continue;
    const id = text(raw[0], 60);
    const name = text(raw[1], 100);
    if (!id || !name || zones.some((zone) => zone.id === id)) continue;
    const risk = parseRisk(sourceId, id, raw[5]);
    const clue = text(raw[6], 320);
    zones.push({
      id,
      name,
      locked: raw[2] === true,
      discovered: index === 0,
      surfaceRevealed: false,
      searched: false,
      surfaceLootIds: loot(raw[3]),
      deepLootIds: loot(raw[4]),
      ...(risk ? { risk } : {}),
      ...(clue ? { clue: { id: `${id}_clue_${stablePoiHash(`${sourceId}:${id}:clue`).toString(16)}`, text: clue, discovered: false } } : {}),
    });
  }
  return zones.length > 0 ? { entranceLocked: value[0] === true, zones } : null;
}

function genericZones(): PoiZoneState[] {
  return [
    { id: 'main', name: 'Zone principale', locked: false, discovered: true, surfaceRevealed: false, searched: false, surfaceLootIds: GENERIC_SURFACE, deepLootIds: GENERIC_DEEP },
    { id: 'secondary', name: 'Zone secondaire', locked: true, discovered: false, surfaceRevealed: false, searched: false, surfaceLootIds: ['key'], deepLootIds: ['crowbar', 'water_bottle'] },
  ];
}

export function createPoiSiteState(sourceId: string, categoryValue?: string, typeLabel?: string, blueprint?: unknown): PoiSiteState {
  const parsed = parseBlueprint(sourceId, blueprint);
  return {
    sourceId,
    category: normalizePoiCategory(categoryValue),
    ...(typeLabel ? { typeLabel } : {}),
    phase: 'outside',
    observed: false,
    entranceLocked: parsed?.entranceLocked ?? false,
    entranceForced: false,
    surfaceRevealed: false,
    searched: false,
    zones: parsed?.zones ?? genericZones(),
  };
}

export function ensurePoiSiteStructure(site: PoiSiteState): PoiSiteState {
  site.category = normalizePoiCategory(site.category);
  if (site.entranceLocked === undefined) site.entranceLocked = false;
  if (site.entranceForced === undefined) site.entranceForced = false;
  if (!site.zones?.length) site.zones = genericZones();
  return site;
}

export function poiZones(site: PoiSiteState): PoiZoneState[] {
  return site.zones?.length ? site.zones : genericZones();
}

export function getPoiZone(site: PoiSiteState, zoneId: string | undefined): PoiZoneState | undefined {
  const list = poiZones(site);
  return zoneId ? list.find((zone) => zone.id === zoneId) : list[0];
}

export function getActivePoiZone(site: PoiSiteState): PoiZoneState | undefined {
  return getPoiZone(site, site.activeZoneId);
}

export function getPoiLootDefinitionIds(site: PoiSiteState, zoneId: string, layer: 'surface' | 'deep'): readonly string[] {
  const zone = getPoiZone(site, zoneId);
  return layer === 'surface' ? zone?.surfaceLootIds ?? [] : zone?.deepLootIds ?? [];
}