export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
export const MAP_POI_MIN_ZOOM = 15;
export const MAP_POI_RADIUS_M = 1200;
export const MAP_RESIDENTIAL_POI_RADIUS_M = 650;
export const MAP_POI_MAX_RESULTS = 17;
export const MAP_POI_MAX_HOME_DISTANCE_M = 1600;

export type MapPoiCategory = 'Industrie' | 'Commerce' | 'Santé' | 'Automobile' | 'Services publics' | 'Résidentiel';

export const MAP_POI_CATEGORY_LIMITS: Readonly<Record<MapPoiCategory, number>> = Object.freeze({
  Résidentiel: 7,
  Commerce: 3,
  Santé: 2,
  Automobile: 2,
  'Services publics': 2,
  Industrie: 1,
});

export interface MapPoi {
  id: string;
  lat: number;
  lng: number;
  category: MapPoiCategory;
  typeLabel: string;
  name: string;
}

export interface OverpassElement {
  type?: string;
  id?: number | string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string | undefined>;
}

interface PoiClassification {
  category: MapPoiCategory;
  typeLabel: string;
}

const HEALTH_AMENITIES = new Set(['hospital', 'clinic', 'doctors', 'pharmacy']);
const HEALTHCARE_VALUES = new Set(['hospital', 'clinic', 'doctor', 'pharmacy']);
const PUBLIC_SERVICES = new Set(['police', 'fire_station', 'townhall']);
const ALLOWED_SHOPS = new Set(['supermarket', 'convenience', 'grocery', 'greengrocer', 'bakery', 'books', 'mall']);
const RESIDENTIAL_BUILDINGS = new Set(['house', 'residential', 'apartments', 'detached', 'semidetached_house', 'terrace']);

const SHOP_LABELS: Record<string, string> = {
  supermarket: 'Supermarché',
  convenience: 'Épicerie',
  grocery: 'Épicerie',
  greengrocer: 'Primeur',
  bakery: 'Boulangerie',
  books: 'Librairie',
  mall: 'Centre commercial',
};

const TYPE_PRIORITY: Readonly<Record<MapPoiCategory, readonly string[]>> = Object.freeze({
  Résidentiel: ['Habitation'],
  Commerce: ['Supermarché', 'Épicerie', 'Boulangerie', 'Primeur', 'Librairie', 'Centre commercial'],
  Santé: ['Pharmacie', 'Hôpital', 'Clinique', 'Médecins'],
  Automobile: ['Station service', 'Garage / réparation auto'],
  'Services publics': ['Police', 'Pompiers', 'Mairie'],
  Industrie: ['Entrepôt', 'Site industriel'],
});

const TYPE_MIN_SPACING_M: Readonly<Record<MapPoiCategory, number>> = Object.freeze({
  Résidentiel: 80,
  Commerce: 120,
  Santé: 160,
  Automobile: 220,
  'Services publics': 220,
  Industrie: 250,
});

const CATEGORY_ORDER: readonly MapPoiCategory[] = ['Résidentiel', 'Commerce', 'Santé', 'Automobile', 'Services publics', 'Industrie'];

function named(tags: Record<string, string | undefined>, fallback = 'Lieu sans nom'): string {
  const explicit = tags.name ?? tags.brand ?? tags.operator;
  if (explicit) return explicit;
  const houseNumber = tags['addr:housenumber'];
  const street = tags['addr:street'];
  if (houseNumber && street) return `${houseNumber} ${street}`;
  if (street) return street;
  return fallback;
}

function healthType(value: string): string {
  if (value === 'pharmacy') return 'Pharmacie';
  if (value === 'hospital') return 'Hôpital';
  if (value === 'clinic') return 'Clinique';
  return 'Médecins';
}

export function classifyMapPoi(tags: Record<string, string | undefined>): PoiClassification | null {
  const shop = tags.shop;
  const amenity = tags.amenity;
  const healthcare = tags.healthcare;
  const craft = tags.craft;
  const building = tags.building;

  if (shop === 'car_repair' || craft === 'car_repair') return { category: 'Automobile', typeLabel: 'Garage / réparation auto' };
  if (amenity === 'fuel') return { category: 'Automobile', typeLabel: 'Station service' };

  if (amenity && PUBLIC_SERVICES.has(amenity)) {
    if (amenity === 'police') return { category: 'Services publics', typeLabel: 'Police' };
    if (amenity === 'fire_station') return { category: 'Services publics', typeLabel: 'Pompiers' };
    return { category: 'Services publics', typeLabel: 'Mairie' };
  }

  if (amenity && HEALTH_AMENITIES.has(amenity)) return { category: 'Santé', typeLabel: healthType(amenity) };
  if (healthcare && HEALTHCARE_VALUES.has(healthcare)) return { category: 'Santé', typeLabel: healthType(healthcare) };

  if (building === 'warehouse') return { category: 'Industrie', typeLabel: 'Entrepôt' };
  if (building === 'industrial' || tags.man_made === 'works') return { category: 'Industrie', typeLabel: 'Site industriel' };

  if (shop && ALLOWED_SHOPS.has(shop)) return { category: 'Commerce', typeLabel: SHOP_LABELS[shop] ?? 'Commerce' };

  if (building && RESIDENTIAL_BUILDINGS.has(building)) return { category: 'Résidentiel', typeLabel: 'Habitation' };
  return null;
}

export function buildOverpassPoiQuery(lat: number, lng: number, radiusM = MAP_POI_RADIUS_M): string {
  const radius = Math.max(100, Math.min(1500, Math.round(radiusM)));
  const residentialRadius = Math.min(radius, MAP_RESIDENTIAL_POI_RADIUS_M);
  const center = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return `[out:json][timeout:4];\n` +
    `(\n` +
    `nwr["shop"~"^(supermarket|convenience|grocery|greengrocer|bakery|books|mall|car_repair)$"](around:${radius},${center});\n` +
    `nwr["amenity"~"^(fuel|police|fire_station|hospital|clinic|doctors|pharmacy|townhall)$"](around:${radius},${center});\n` +
    `nwr["healthcare"~"^(hospital|clinic|doctor|pharmacy)$"](around:${radius},${center});\n` +
    `nwr["building"~"^(industrial|warehouse)$"](around:${radius},${center});\n` +
    `nwr["man_made"="works"](around:${radius},${center});\n` +
    `nwr["craft"="car_repair"](around:${radius},${center});\n` +
    `)->.core;\n` +
    `.core out center 70;\n` +
    `(\n` +
    `nwr["building"~"^(house|residential|apartments|detached|semidetached_house|terrace)$"](around:${residentialRadius},${center});\n` +
    `)->.residential;\n` +
    `.residential out center 70;`;
}

function elementCoordinates(element: OverpassElement): { lat: number; lng: number } | null {
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function typeRank(category: MapPoiCategory, typeLabel: string): number {
  const index = TYPE_PRIORITY[category].indexOf(typeLabel);
  return index < 0 ? TYPE_PRIORITY[category].length : index;
}

function tooCloseToSameType(candidate: MapPoi, selected: readonly MapPoi[]): boolean {
  const minSpacingM = TYPE_MIN_SPACING_M[candidate.category];
  return selected.some((poi) => poi.typeLabel === candidate.typeLabel && mapDistanceMeters(candidate, poi) < minSpacingM);
}

function selectCategoryPois(candidates: readonly MapPoi[], category: MapPoiCategory, center: { lat: number; lng: number }): MapPoi[] {
  const limit = MAP_POI_CATEGORY_LIMITS[category];
  const bucket = candidates
    .filter((poi) => poi.category === category)
    .sort((a, b) => typeRank(category, a.typeLabel) - typeRank(category, b.typeLabel)
      || mapDistanceMeters(center, a) - mapDistanceMeters(center, b)
      || a.id.localeCompare(b.id));

  const selected: MapPoi[] = [];
  for (const typeLabel of TYPE_PRIORITY[category]) {
    const candidate = bucket.find((poi) => poi.typeLabel === typeLabel && !tooCloseToSameType(poi, selected));
    if (candidate) selected.push(candidate);
    if (selected.length >= limit) return selected;
  }

  for (const candidate of bucket) {
    if (selected.some((poi) => poi.id === candidate.id) || tooCloseToSameType(candidate, selected)) continue;
    selected.push(candidate);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function parseOverpassPois(
  elements: readonly OverpassElement[],
  maxResults = MAP_POI_MAX_RESULTS,
  center?: { lat: number; lng: number },
): MapPoi[] {
  const candidates: MapPoi[] = [];
  const seen = new Set<string>();
  for (const element of elements) {
    const tags = element.tags ?? {};
    const classification = classifyMapPoi(tags);
    const coordinates = elementCoordinates(element);
    if (!classification || !coordinates) continue;
    const id = `${element.type ?? 'element'}:${String(element.id ?? `${coordinates.lat},${coordinates.lng}`)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    candidates.push({
      id,
      ...coordinates,
      ...classification,
      name: named(tags, classification.category === 'Résidentiel' ? 'Habitation' : classification.typeLabel),
    });
  }

  if (candidates.length === 0) return [];
  const selectionCenter = center ?? { lat: candidates[0]!.lat, lng: candidates[0]!.lng };
  const selected = CATEGORY_ORDER.flatMap((category) => selectCategoryPois(candidates, category, selectionCenter));
  return selected.slice(0, Math.max(1, Math.min(MAP_POI_MAX_RESULTS, maxResults)));
}

export function mapDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function mapPoiCacheKey(center: { lat: number; lng: number }): string {
  return `${Math.round(center.lat * 200)}:${Math.round(center.lng * 200)}`;
}

export async function fetchOverpassPois(
  center: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<MapPoi[]> {
  const body = new URLSearchParams({ data: buildOverpassPoiQuery(center.lat, center.lng) });
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`Overpass request failed: ${response.status}`);
  const payload = await response.json() as { elements?: OverpassElement[] };
  return parseOverpassPois(Array.isArray(payload.elements) ? payload.elements : [], MAP_POI_MAX_RESULTS, center);
}
