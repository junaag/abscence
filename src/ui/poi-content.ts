import type { ZoneAlphaPoi, ZoneAlphaCategory } from '../content/zone-alpha';

type Risk = readonly [string, string, string, number, number, number, number];
type Zone = readonly [
  string,
  string,
  boolean,
  readonly string[],
  readonly string[],
  (Risk | undefined)?,
  string?,
  number?,
  boolean?,
  string?,
];
export type PoiBlueprint = readonly [boolean, readonly Zone[]];

const GLASS: Risk = ['debris', 'Verre et débris au sol', 'Du verre et des objets renversés rendent la fouille risquée.', 90, 1.5, 1, 1];
const SHELF: Risk = ['unstable_storage', 'Rayonnage instable', 'Un rangement penche dangereusement et pourrait céder.', 150, 2, 1.5, 1];
const ELECTRIC: Risk = ['electrical', 'Installation électrique dégradée', 'Des câbles et appareils sont dans un état douteux.', 180, 2, 1, 2];
const DARK: Risk = ['darkness', 'Zone sombre et encombrée', 'La lumière pénètre mal et des obstacles restent difficiles à distinguer.', 120, 1, 1, 1.5];

const GENERIC_PROFILES: Readonly<Record<ZoneAlphaCategory, readonly Zone[]>> = Object.freeze({
  Automobile: [
    ['shop', 'Boutique / accueil', false, ['water_bottle'], ['canned_food', 'flashlight', 'work_gloves'], GLASS, 'Une transaction est restée inachevée près de la caisse, sans signe de lutte.', 45, false, 'technical'],
    ['stock', 'Réserve', true, ['work_gloves'], ['tool_kit', 'water_bottle', 'crowbar'], SHELF, undefined, 60],
    ['technical', 'Local technique', false, ['empty_fuel_can'], ['flashlight', 'tool_kit'], ELECTRIC, undefined, 50, true],
  ],
  Commerce: [
    ['sales', 'Surface de vente', false, ['apple'], ['water_bottle', 'canned_food', 'canned_food'], GLASS, 'Des paniers à moitié remplis sont restés sur place, comme interrompus au même instant.', 60, false, 'office'],
    ['stock', 'Réserve', true, ['canned_food'], ['water_bottle', 'backpack', 'canned_food'], SHELF, undefined, 60],
    ['office', 'Bureau / arrière-boutique', false, ['key'], ['flashlight', 'waist_bag'], undefined, undefined, 35, true],
  ],
  Santé: [
    ['public', 'Officine', false, ['bandage_pack'], ['bandage_pack', 'first_aid_kit', 'water_bottle'], undefined, 'Dossiers et préparations sont restés ouverts, sans consigne d’évacuation.', 45, false, 'back_room'],
    ['medical_stock', 'Réserve médicale', true, ['bandage_pack'], ['first_aid_kit', 'bandage_pack', 'bandage_pack'], SHELF, undefined, 60],
    ['back_room', 'Arrière-boutique / bureau', false, ['key'], ['flashlight', 'waist_bag'], DARK, undefined, 35, true],
  ],
  'Services publics': [
    ['main', 'Garage / espace principal', false, ['flashlight'], ['water_bottle', 'first_aid_kit', 'work_gloves'], undefined, 'Un registre de service s’interrompt sans mentionner d’alerte inhabituelle.', 60, false, 'secure'],
    ['office', 'Bureaux / vestiaires', false, ['key'], ['waist_bag', 'flashlight'], undefined, undefined, 50],
    ['secure', 'Réserve de matériel', true, ['work_gloves'], ['crowbar', 'first_aid_kit', 'tool_kit'], DARK, undefined, 70, true],
  ],
  Industrie: [
    ['workshop', 'Atelier / zone de travail', false, ['work_gloves'], ['tool_kit', 'crowbar', 'flashlight'], ELECTRIC, 'Des machines sont restées en plein cycle, sans procédure d’arrêt.', 75, false, 'office'],
    ['warehouse', 'Stock / entrepôt', false, ['empty_fuel_can'], ['hiking_backpack', 'tool_kit', 'water_bottle'], SHELF, undefined, 100],
    ['office', 'Bureau technique', true, ['key'], ['flashlight', 'first_aid_kit'], undefined, undefined, 45, true],
  ],
  Résidentiel: [
    ['living', 'Pièce de vie', false, ['water_bottle'], ['flashlight', 'canned_food', 'waist_bag'], undefined, 'Des objets personnels sont restés en place ; aucun départ ne semble avoir été préparé.', 35],
    ['kitchen', 'Cuisine', false, ['apple'], ['water_bottle', 'canned_food', 'towel'], GLASS, undefined, 40, false, 'annex'],
    ['night', 'Espace nuit', false, ['wristwatch'], ['backpack', 'key', 'first_aid_kit'], undefined, undefined, 40],
    ['annex', 'Annexe', true, ['key'], ['flashlight', 'tool_kit', 'water_bottle'], DARK, undefined, 30, true],
  ],
});

const BAKERY: readonly Zone[] = [
  ['shop', 'Boutique', false, ['apple'], ['water_bottle', 'canned_food'], undefined, 'La caisse est restée ouverte et une commande attend toujours sur le comptoir.', 35],
  ['bakery', 'Fournil', false, [], ['canned_food', 'work_gloves'], ELECTRIC, undefined, 50, false, 'stock'],
  ['stock', 'Réserve', true, ['water_bottle'], ['backpack', 'canned_food'], SHELF, undefined, 40, true],
];

const GROCERY: readonly Zone[] = [
  ['sales', 'Surface de vente', false, ['apple'], ['water_bottle', 'canned_food', 'canned_food'], GLASS, 'Plusieurs paniers ont été abandonnés en plein passage.', 60],
  ['stock', 'Réserve', true, ['canned_food'], ['water_bottle', 'backpack', 'canned_food'], SHELF, undefined, 60, false, 'office'],
  ['office', 'Bureau / livraison', false, ['key'], ['flashlight', 'waist_bag'], undefined, undefined, 35, true],
];

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function residentialProfile(poi: ZoneAlphaPoi): readonly Zone[] {
  const annexNames = ['Cellier', 'Buanderie', 'Cave', 'Dépendance'] as const;
  const annexName = annexNames[stableHash(poi.id) % annexNames.length]!;
  return GENERIC_PROFILES.Résidentiel.map((zone) => zone[0] === 'annex'
    ? [zone[0], annexName, zone[2], zone[3], zone[4], zone[5], zone[6], zone[7], zone[8], zone[9]] as Zone
    : zone);
}

function profileFor(poi: ZoneAlphaPoi): readonly Zone[] {
  if (poi.typeLabel === 'Boulangerie') return BAKERY;
  if (poi.typeLabel === 'Alimentation') return GROCERY;
  if (poi.category === 'Résidentiel') return residentialProfile(poi);
  return GENERIC_PROFILES[poi.category];
}

export function buildPoiBlueprint(poi: ZoneAlphaPoi): PoiBlueprint {
  const entranceLocked = poi.category === 'Santé' || poi.category === 'Services publics' || poi.category === 'Industrie'
    || (poi.category === 'Résidentiel' && stableHash(poi.id) % 2 === 0);
  return [entranceLocked, profileFor(poi)];
}
