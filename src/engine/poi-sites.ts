import type { PoiRiskKind, PoiRiskState, PoiSiteCategory, PoiSiteState, PoiZoneState } from './model';

const GENERIC: PoiZoneState[] = [
  { id: 'main', name: 'Zone principale', locked: false, discovered: true, surfaceRevealed: false, searched: false, surfaceLootIds: ['water_bottle'], deepLootIds: ['flashlight', 'canned_food', 'towel'] },
  { id: 'secondary', name: 'Zone secondaire', locked: true, discovered: false, surfaceRevealed: false, searched: false, surfaceLootIds: ['key'], deepLootIds: ['crowbar', 'water_bottle'] },
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

function string(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function list(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, 8) : []; }

function risk(sourceId: string, zoneId: string, raw: unknown): PoiRiskState | undefined {
  if (!Array.isArray(raw)) return undefined;
  const kind = string(raw[0]) as PoiRiskKind;
  if (!['debris', 'unstable_storage', 'chemical', 'electrical', 'darkness'].includes(kind)) return undefined;
  const label = string(raw[1]);
  const description = string(raw[2]);
  if (!label || !description) return undefined;
  const n = (index: number, fallback = 0): number => Number.isFinite(Number(raw[index])) ? Number(raw[index]) : fallback;
  return {
    id: `${zoneId}_${kind}_${stablePoiHash(`${sourceId}:${zoneId}:risk`).toString(16)}`,
    kind, label, description, discovered: false, resolved: false, triggered: false,
    secureSeconds: Math.max(1, Math.round(n(3, 120))), painPenalty: Math.max(0, n(4)),
    fatiguePenalty: Math.max(0, n(5)), stressPenalty: Math.max(0, n(6)),
  };
}

function decode(sourceId: string, blueprint: unknown): { entranceLocked: boolean; zones: PoiZoneState[] } | null {
  if (!Array.isArray(blueprint) || !Array.isArray(blueprint[1])) return null;
  const zones: PoiZoneState[] = [];
  for (const [index, raw] of blueprint[1].slice(0, 5).entries()) {
    if (!Array.isArray(raw)) continue;
    const id = string(raw[0]);
    const name = string(raw[1]);
    if (!id || !name || zones.some((z) => z.id === id)) continue;
    const localRisk = risk(sourceId, id, raw[5]);
    const clueText = string(raw[6]);
    zones.push({
      id, name, locked: raw[2] === true, discovered: index === 0, surfaceRevealed: false, searched: false,
      surfaceLootIds: list(raw[3]), deepLootIds: list(raw[4]),
      ...(localRisk ? { risk: localRisk } : {}),
      ...(clueText ? { clue: { id: `${id}_clue_${stablePoiHash(`${sourceId}:${id}:clue`).toString(16)}`, text: clueText, discovered: false } } : {}),
    });
  }
  return zones.length ? { entranceLocked: blueprint[0] === true, zones } : null;
}

function genericZones(): PoiZoneState[] { return structuredClone(GENERIC); }

export function createPoiSiteState(sourceId: string, categoryValue?: string, typeLabel?: string, blueprint?: unknown): PoiSiteState {
  const parsed = decode(sourceId, blueprint);
  return {
    sourceId, category: normalizePoiCategory(categoryValue), ...(typeLabel ? { typeLabel } : {}),
    phase: 'outside', observed: false, entranceLocked: parsed?.entranceLocked ?? false,
    entranceForced: false, surfaceRevealed: false, searched: false, zones: parsed?.zones ?? genericZones(),
  };
}

export function ensurePoiSiteStructure(site: PoiSiteState): PoiSiteState {
  site.category = normalizePoiCategory(site.category);
  site.entranceLocked ??= false;
  site.entranceForced ??= false;
  if (!site.zones?.length) site.zones = genericZones();
  return site;
}

export function poiZones(site: PoiSiteState): PoiZoneState[] { return site.zones?.length ? site.zones : genericZones(); }
export function getPoiZone(site: PoiSiteState, zoneId: string | undefined): PoiZoneState | undefined {
  const zones = poiZones(site);
  return zoneId ? zones.find((zone) => zone.id === zoneId) : zones[0];
}
export function getActivePoiZone(site: PoiSiteState): PoiZoneState | undefined { return getPoiZone(site, site.activeZoneId); }
export function getPoiLootDefinitionIds(site: PoiSiteState, zoneId: string, layer: 'surface' | 'deep'): readonly string[] {
  const zone = getPoiZone(site, zoneId);
  return layer === 'surface' ? zone?.surfaceLootIds ?? [] : zone?.deepLootIds ?? [];
}