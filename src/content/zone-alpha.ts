export type ZoneAlphaCategory = 'Résidentiel' | 'Commerce' | 'Santé' | 'Automobile' | 'Services publics' | 'Industrie';

export interface ZoneAlphaPoint {
  x: number;
  y: number;
}

export interface ZoneAlphaPoi extends ZoneAlphaPoint {
  id: string;
  name: string;
  category: ZoneAlphaCategory;
  typeLabel: string;
  widthM: number;
  heightM: number;
}

export interface ZoneAlphaRoad {
  id: string;
  x: number;
  y: number;
  widthM: number;
  heightM: number;
  kind: 'main' | 'local';
}

/**
 * Canonical local metric reference for the first playable district.
 * X increases eastward. Y increases northward. One unit equals one metre.
 * The map deliberately remains open at its edges so future districts can be
 * attached without changing existing coordinates.
 */
export const ZONE_ALPHA_BOUNDS = Object.freeze({ widthM: 520, heightM: 420 });
export const ZONE_ALPHA_HOME_POSITION = Object.freeze({ x: 72, y: 344 });
export const ZONE_ALPHA_STREET_POSITION = Object.freeze({ x: 142, y: 336 });
export const ZONE_ALPHA_GARDEN_POSITION = Object.freeze({ x: 98, y: 338 });

export const ZONE_ALPHA_ROADS: readonly ZoneAlphaRoad[] = Object.freeze([
  { id: 'west_spine', x: 132, y: 0, widthM: 26, heightM: 420, kind: 'main' },
  { id: 'east_spine', x: 350, y: 0, widthM: 26, heightM: 420, kind: 'main' },
  { id: 'north_cross', x: 0, y: 292, widthM: 520, heightM: 26, kind: 'main' },
  { id: 'south_cross', x: 0, y: 108, widthM: 520, heightM: 24, kind: 'main' },
  { id: 'central_access', x: 158, y: 196, widthM: 192, heightM: 18, kind: 'local' },
  { id: 'service_access', x: 158, y: 346, widthM: 192, heightM: 16, kind: 'local' },
]);

export const ZONE_ALPHA_POIS: readonly ZoneAlphaPoi[] = Object.freeze([
  { id: 'house_1', name: 'Maison 1', category: 'Résidentiel', typeLabel: 'Habitation', x: 72, y: 344, widthM: 54, heightM: 34 },
  { id: 'house_2', name: 'Maison 2', category: 'Résidentiel', typeLabel: 'Habitation', x: 70, y: 264, widthM: 56, heightM: 36 },
  { id: 'house_3', name: 'Maison 3', category: 'Résidentiel', typeLabel: 'Habitation', x: 70, y: 214, widthM: 54, heightM: 34 },
  { id: 'house_4', name: 'Maison 4', category: 'Résidentiel', typeLabel: 'Habitation', x: 70, y: 164, widthM: 52, heightM: 34 },
  { id: 'house_5', name: 'Maison 5', category: 'Résidentiel', typeLabel: 'Habitation', x: 70, y: 64, widthM: 58, heightM: 36 },
  { id: 'house_6', name: 'Maison 6', category: 'Résidentiel', typeLabel: 'Habitation', x: 238, y: 62, widthM: 60, heightM: 38 },
  { id: 'house_7', name: 'Maison 7', category: 'Résidentiel', typeLabel: 'Habitation', x: 405, y: 164, widthM: 52, heightM: 34 },
  { id: 'fire_station', name: 'Caserne de pompiers', category: 'Services publics', typeLabel: 'Caserne de pompiers', x: 252, y: 238, widthM: 108, heightM: 72 },
  { id: 'fuel_station', name: 'Station service', category: 'Automobile', typeLabel: 'Station service', x: 252, y: 362, widthM: 112, heightM: 54 },
  { id: 'pharmacy', name: 'Pharmacie', category: 'Santé', typeLabel: 'Pharmacie', x: 438, y: 270, widthM: 74, heightM: 42 },
  { id: 'bakery', name: 'Boulangerie', category: 'Commerce', typeLabel: 'Boulangerie', x: 438, y: 218, widthM: 74, heightM: 40 },
  { id: 'grocery', name: 'Alimentation', category: 'Commerce', typeLabel: 'Alimentation', x: 438, y: 70, widthM: 78, heightM: 44 },
]);

export function zoneAlphaPoiById(id: string): ZoneAlphaPoi | undefined {
  return ZONE_ALPHA_POIS.find((poi) => poi.id === id);
}
