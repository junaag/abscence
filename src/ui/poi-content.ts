import type { MapPoi, MapPoiCategory } from './map-pois';

type Risk = readonly [string, string, string, number, number, number, number];
type Zone = readonly [string, string, boolean, readonly string[], readonly string[], Risk?, string?];
export type PoiBlueprint = readonly [boolean, readonly Zone[]];

const GLASS: Risk = ['debris', 'Verre et débris au sol', 'Du verre et des objets renversés rendent la fouille risquée.', 90, 1.5, 1, 1];
const SHELF: Risk = ['unstable_storage', 'Rayonnage instable', 'Un rangement penche dangereusement et pourrait céder.', 150, 2, 1.5, 1];
const ELECTRIC: Risk = ['electrical', 'Installation électrique dégradée', 'Des câbles et appareils sont dans un état douteux.', 180, 2, 1, 2];
const DARK: Risk = ['darkness', 'Zone sombre et encombrée', 'La lumière pénètre mal et des obstacles restent difficiles à distinguer.', 120, 1, 1, 1.5];

const PROFILES: Readonly<Record<MapPoiCategory, readonly Zone[]>> = Object.freeze({
  Automobile: [
    ['shop', 'Boutique / accueil', false, ['water_bottle'], ['canned_food', 'flashlight', 'work_gloves'], GLASS, 'Une transaction est restée inachevée près de la caisse, sans signe de lutte.'],
    ['stock', 'Réserve', true, ['work_gloves'], ['tool_kit', 'water_bottle', 'crowbar'], SHELF],
    ['technical', 'Local technique', false, ['empty_fuel_can'], ['flashlight', 'tool_kit'], ELECTRIC],
  ],
  Commerce: [
    ['sales', 'Surface de vente', false, ['apple'], ['water_bottle', 'canned_food', 'canned_food'], GLASS, 'Des paniers à moitié remplis sont restés sur place, comme interrompus au même instant.'],
    ['stock', 'Réserve', true, ['canned_food'], ['water_bottle', 'backpack', 'canned_food'], SHELF],
    ['office', 'Bureau / locaux du personnel', false, ['key'], ['flashlight', 'waist_bag']],
  ],
  Santé: [
    ['public', 'Accueil / officine', false, ['bandage_pack'], ['bandage_pack', 'first_aid_kit', 'water_bottle'], undefined, 'Dossiers et préparations sont restés ouverts, sans consigne d’évacuation.'],
    ['medical_stock', 'Réserve médicale', true, ['bandage_pack'], ['first_aid_kit', 'bandage_pack', 'bandage_pack'], SHELF],
    ['back_room', 'Arrière-boutique / bureau', false, ['key'], ['flashlight', 'waist_bag']],
  ],
  'Services publics': [
    ['reception', 'Accueil', false, ['flashlight'], ['water_bottle', 'first_aid_kit'], undefined, 'Un registre de service s’interrompt sans mentionner d’alerte inhabituelle.'],
    ['office', 'Bureaux', false, ['key'], ['waist_bag', 'flashlight']],
    ['secure', 'Local sécurisé', true, ['work_gloves'], ['crowbar', 'first_aid_kit', 'tool_kit'], DARK],
  ],
  Industrie: [
    ['workshop', 'Atelier / zone de travail', false, ['work_gloves'], ['tool_kit', 'crowbar', 'flashlight'], ELECTRIC, 'Des machines sont restées en plein cycle, sans procédure d’arrêt.'],
    ['warehouse', 'Stock / entrepôt', false, ['empty_fuel_can'], ['hiking_backpack', 'tool_kit', 'water_bottle'], SHELF],
    ['office', 'Bureau technique', true, ['key'], ['flashlight', 'first_aid_kit']],
  ],
  Résidentiel: [
    ['living', 'Entrée / séjour', false, ['water_bottle'], ['flashlight', 'canned_food', 'waist_bag'], undefined, 'Des objets personnels sont restés en place ; aucun départ ne semble avoir été préparé.'],
    ['kitchen', 'Cuisine', false, ['apple'], ['water_bottle', 'canned_food', 'towel'], GLASS],
    ['bedroom', 'Chambre', true, ['wristwatch'], ['backpack', 'key', 'first_aid_kit']],
  ],
});

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildPoiBlueprint(poi: MapPoi): PoiBlueprint {
  const entranceLocked = poi.category === 'Santé' || poi.category === 'Services publics' || poi.category === 'Industrie'
    || (poi.category === 'Résidentiel' && stableHash(poi.id) % 2 === 0);
  return [entranceLocked, PROFILES[poi.category]];
}