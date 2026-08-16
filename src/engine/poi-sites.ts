import type { PoiClueState, PoiRiskKind, PoiRiskState, PoiSiteCategory, PoiSiteState, PoiZoneState } from './model';

interface RiskTemplate {
  kind: PoiRiskKind;
  label: string;
  description: string;
  secureSeconds: number;
  painPenalty: number;
  fatiguePenalty: number;
  stressPenalty: number;
}

interface ZoneTemplate {
  id: string;
  name: string;
  locked?: boolean;
  surfaceLoot: readonly string[];
  deepLoot: readonly string[];
  risk?: RiskTemplate;
  clue?: string;
}

interface PoiProfileTemplate {
  entranceLocked: boolean | 'variable';
  zones: readonly ZoneTemplate[];
}

const RISK = {
  brokenGlass: {
    kind: 'debris',
    label: 'Verre et débris au sol',
    description: 'Des morceaux de verre et des objets renversés rendent les déplacements et la fouille moins sûrs.',
    secureSeconds: 90,
    painPenalty: 1.5,
    fatiguePenalty: 1,
    stressPenalty: 1,
  },
  unstableShelves: {
    kind: 'unstable_storage',
    label: 'Rayonnage instable',
    description: 'Une partie du rangement penche dangereusement et pourrait céder si elle est manipulée sans précaution.',
    secureSeconds: 150,
    painPenalty: 2,
    fatiguePenalty: 1.5,
    stressPenalty: 1,
  },
  chemical: {
    kind: 'chemical',
    label: 'Odeur chimique irritante',
    description: 'Une odeur agressive flotte dans la zone ; plusieurs contenants ont été déplacés ou renversés.',
    secureSeconds: 180,
    painPenalty: 1,
    fatiguePenalty: 1,
    stressPenalty: 2,
  },
  electrical: {
    kind: 'electrical',
    label: 'Installation électrique dégradée',
    description: 'Des câbles et appareils ont été laissés dans un état douteux. La zone mérite d’être sécurisée avant manipulation.',
    secureSeconds: 180,
    painPenalty: 2,
    fatiguePenalty: 1,
    stressPenalty: 2,
  },
  darkness: {
    kind: 'darkness',
    label: 'Zone sombre et encombrée',
    description: 'La lumière pénètre mal ici et plusieurs obstacles sont difficiles à distinguer.',
    secureSeconds: 120,
    painPenalty: 1,
    fatiguePenalty: 1,
    stressPenalty: 1.5,
  },
} as const satisfies Record<string, RiskTemplate>;

const PROFILES: Readonly<Record<PoiSiteCategory, PoiProfileTemplate>> = Object.freeze({
  Automobile: {
    entranceLocked: false,
    zones: [
      {
        id: 'shop',
        name: 'Boutique / accueil',
        surfaceLoot: ['water_bottle'],
        deepLoot: ['canned_food', 'flashlight', 'work_gloves'],
        risk: RISK.brokenGlass,
        clue: 'Près de la caisse, une transaction est restée inachevée. Rien ne montre qu’elle ait été interrompue par une lutte ou une fuite précipitée.',
      },
      {
        id: 'stock',
        name: 'Réserve',
        locked: true,
        surfaceLoot: ['work_gloves'],
        deepLoot: ['tool_kit', 'water_bottle', 'crowbar'],
        risk: RISK.unstableShelves,
      },
      {
        id: 'technical',
        name: 'Local technique',
        surfaceLoot: ['empty_fuel_can'],
        deepLoot: ['flashlight', 'tool_kit'],
        risk: RISK.electrical,
      },
    ],
  },
  Commerce: {
    entranceLocked: false,
    zones: [
      {
        id: 'sales',
        name: 'Surface de vente',
        surfaceLoot: ['apple'],
        deepLoot: ['water_bottle', 'canned_food', 'canned_food'],
        risk: RISK.brokenGlass,
        clue: 'Des achats préparés sont restés sur place, certains paniers à moitié remplis. L’interruption semble avoir touché tout le monde au même instant.',
      },
      {
        id: 'stock',
        name: 'Réserve',
        locked: true,
        surfaceLoot: ['canned_food'],
        deepLoot: ['water_bottle', 'backpack', 'canned_food'],
        risk: RISK.unstableShelves,
      },
      {
        id: 'office',
        name: 'Bureau / locaux du personnel',
        surfaceLoot: ['key'],
        deepLoot: ['flashlight', 'waist_bag'],
      },
    ],
  },
  Santé: {
    entranceLocked: true,
    zones: [
      {
        id: 'public',
        name: 'Accueil / officine',
        surfaceLoot: ['bandage_pack'],
        deepLoot: ['bandage_pack', 'first_aid_kit', 'water_bottle'],
        clue: 'Plusieurs dossiers et préparations sont restés ouverts. Aucune note d’évacuation, aucune consigne d’urgence : l’activité s’est simplement arrêtée.',
      },
      {
        id: 'medical_stock',
        name: 'Réserve médicale',
        locked: true,
        surfaceLoot: ['bandage_pack'],
        deepLoot: ['first_aid_kit', 'bandage_pack', 'bandage_pack'],
        risk: RISK.unstableShelves,
      },
      {
        id: 'back_room',
        name: 'Arrière-boutique / bureau',
        surfaceLoot: ['key'],
        deepLoot: ['flashlight', 'waist_bag'],
      },
    ],
  },
  'Services publics': {
    entranceLocked: true,
    zones: [
      {
        id: 'reception',
        name: 'Accueil',
        surfaceLoot: ['flashlight'],
        deepLoot: ['water_bottle', 'first_aid_kit'],
        clue: 'Un registre de service s’interrompt au milieu d’une ligne. Les dernières annotations ne mentionnent aucune alerte inhabituelle.',
      },
      {
        id: 'office',
        name: 'Bureaux',
        surfaceLoot: ['key'],
        deepLoot: ['waist_bag', 'flashlight'],
      },
      {
        id: 'secure',
        name: 'Local sécurisé',
        locked: true,
        surfaceLoot: ['work_gloves'],
        deepLoot: ['crowbar', 'first_aid_kit', 'tool_kit'],
        risk: RISK.darkness,
      },
    ],
  },
  Industrie: {
    entranceLocked: true,
    zones: [
      {
        id: 'workshop',
        name: 'Atelier / zone de travail',
        surfaceLoot: ['work_gloves'],
        deepLoot: ['tool_kit', 'crowbar', 'flashlight'],
        risk: RISK.electrical,
        clue: 'Des machines sont restées dans la position exacte de leur dernier cycle. Aucun protocole d’arrêt n’a été appliqué.',
      },
      {
        id: 'warehouse',
        name: 'Stock / entrepôt',
        surfaceLoot: ['empty_fuel_can'],
        deepLoot: ['hiking_backpack', 'tool_kit', 'water_bottle'],
        risk: RISK.unstableShelves,
      },
      {
        id: 'office',
        name: 'Bureau technique',
        locked: true,
        surfaceLoot: ['key'],
        deepLoot: ['flashlight', 'first_aid_kit'],
      },
    ],
  },
  Résidentiel: {
    entranceLocked: 'variable',
    zones: [
      {
        id: 'living',
        name: 'Entrée / séjour',
        surfaceLoot: ['water_bottle'],
        deepLoot: ['flashlight', 'canned_food', 'waist_bag'],
        clue: 'Des objets personnels sont restés là où leurs propriétaires les utilisaient. Rien ne ressemble à un déménagement ou à un départ préparé.',
      },
      {
        id: 'kitchen',
        name: 'Cuisine',
        surfaceLoot: ['apple'],
        deepLoot: ['water_bottle', 'canned_food', 'towel'],
        risk: RISK.brokenGlass,
      },
      {
        id: 'bedroom',
        name: 'Chambre',
        locked: true,
        surfaceLoot: ['wristwatch'],
        deepLoot: ['backpack', 'key', 'first_aid_kit'],
      },
    ],
  },
  Inconnu: {
    entranceLocked: false,
    zones: [
      {
        id: 'main',
        name: 'Zone principale',
        surfaceLoot: ['water_bottle'],
        deepLoot: ['flashlight', 'canned_food', 'towel'],
        risk: RISK.darkness,
        clue: 'Le lieu semble avoir été laissé en plein usage, sans signe évident d’évacuation organisée.',
      },
      {
        id: 'secondary',
        name: 'Zone secondaire',
        locked: true,
        surfaceLoot: ['key'],
        deepLoot: ['crowbar', 'water_bottle'],
      },
    ],
  },
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
  switch (value) {
    case 'Industrie':
    case 'Commerce':
    case 'Santé':
    case 'Automobile':
    case 'Services publics':
    case 'Résidentiel':
      return value;
    default:
      return 'Inconnu';
  }
}

function createRisk(sourceId: string, zoneId: string, template: RiskTemplate): PoiRiskState {
  return {
    id: `${zoneId}_${template.kind}_${stablePoiHash(`${sourceId}:${zoneId}:risk`).toString(16)}`,
    kind: template.kind,
    label: template.label,
    description: template.description,
    discovered: false,
    resolved: false,
    triggered: false,
    secureSeconds: template.secureSeconds,
    painPenalty: template.painPenalty,
    fatiguePenalty: template.fatiguePenalty,
    stressPenalty: template.stressPenalty,
  };
}

function createClue(sourceId: string, zoneId: string, text: string): PoiClueState {
  return {
    id: `${zoneId}_clue_${stablePoiHash(`${sourceId}:${zoneId}:clue`).toString(16)}`,
    text,
    discovered: false,
  };
}

function createZones(sourceId: string, category: PoiSiteCategory): PoiZoneState[] {
  return PROFILES[category].zones.map((template, index) => ({
    id: template.id,
    name: template.name,
    locked: Boolean(template.locked),
    discovered: index === 0,
    surfaceRevealed: false,
    searched: false,
    ...(template.risk ? { risk: createRisk(sourceId, template.id, template.risk) } : {}),
    ...(template.clue ? { clue: createClue(sourceId, template.id, template.clue) } : {}),
  }));
}

function entranceLocked(sourceId: string, category: PoiSiteCategory): boolean {
  const rule = PROFILES[category].entranceLocked;
  if (rule !== 'variable') return rule;
  return stablePoiHash(sourceId) % 2 === 0;
}

export function createPoiSiteState(sourceId: string, categoryValue?: string, typeLabel?: string): PoiSiteState {
  const category = normalizePoiCategory(categoryValue);
  return {
    sourceId,
    category,
    ...(typeLabel ? { typeLabel } : {}),
    phase: 'outside',
    observed: false,
    entranceLocked: entranceLocked(sourceId, category),
    entranceForced: false,
    surfaceRevealed: false,
    searched: false,
    zones: createZones(sourceId, category),
  };
}

export function ensurePoiSiteStructure(site: PoiSiteState): PoiSiteState {
  const category = normalizePoiCategory(site.category);
  site.category = category;
  if (site.entranceLocked === undefined) site.entranceLocked = entranceLocked(site.sourceId, category);
  if (site.entranceForced === undefined) site.entranceForced = false;
  if (!site.zones || site.zones.length === 0) site.zones = createZones(site.sourceId, category);
  return site;
}

export function poiZones(site: PoiSiteState): PoiZoneState[] {
  return site.zones && site.zones.length > 0 ? site.zones : createZones(site.sourceId, normalizePoiCategory(site.category));
}

export function getPoiZone(site: PoiSiteState, zoneId: string | undefined): PoiZoneState | undefined {
  const zones = poiZones(site);
  if (!zoneId) return zones[0];
  return zones.find((zone) => zone.id === zoneId);
}

export function getActivePoiZone(site: PoiSiteState): PoiZoneState | undefined {
  return getPoiZone(site, site.activeZoneId);
}

export function getPoiLootDefinitionIds(site: PoiSiteState, zoneId: string, layer: 'surface' | 'deep'): readonly string[] {
  const category = normalizePoiCategory(site.category);
  const zoneTemplate = PROFILES[category].zones.find((zone) => zone.id === zoneId);
  return zoneTemplate?.[layer === 'surface' ? 'surfaceLoot' : 'deepLoot'] ?? [];
}