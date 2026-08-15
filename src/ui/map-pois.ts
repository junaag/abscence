export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
export const MAP_POI_MIN_ZOOM = 15;
export const MAP_POI_RADIUS_M = 1200;
export const MAP_POI_MAX_RESULTS = 45;
export const MAP_POI_MAX_HOME_DISTANCE_M = 1600;

export type MapPoiCategory = 'Industrie' | 'Commerce' | 'Services' | 'Services publics' | 'Résidentiel';

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

const PUBLIC_HEALTH = new Set(['hospital', 'clinic', 'doctors', 'pharmacy']);
const PUBLIC_SERVICES = new Set(['police', 'fire_station', 'townhall']);
const COMMERCE_AMENITIES = new Set(['restaurant', 'cafe', 'fast_food']);

const SHOP_LABELS: Record<string, string> = {
  supermarket: 'Supermarché',
  convenience: 'Épicerie',
  grocery: 'Épicerie',
  greengrocer: 'Primeur',
  bakery: 'Boulangerie',
  books: 'Librairie',
  mall: 'Centre commercial',
};

function named(tags: Record<string, string | undefined>): string {
  return tags.name ?? tags.brand ?? tags.operator ?? 'Lieu sans nom';
}

export function classifyMapPoi(tags: Record<string, string | undefined>): PoiClassification | null {
  const shop = tags.shop;
  const amenity = tags.amenity;
  const craft = tags.craft;
  const building = tags.building;

  // Must be checked before the generic shop branch.
  if (shop === 'car_repair' || craft === 'car_repair') return { category: 'Services', typeLabel: 'Garage / réparation auto' };
  if (amenity === 'fuel') return { category: 'Services', typeLabel: 'Station service' };

  if (amenity && PUBLIC_SERVICES.has(amenity)) {
    if (amenity === 'police') return { category: 'Services publics', typeLabel: 'Police' };
    if (amenity === 'fire_station') return { category: 'Services publics', typeLabel: 'Pompiers' };
    if (amenity === 'townhall') return { category: 'Services publics', typeLabel: 'Mairie' };
  }
  if (amenity && PUBLIC_HEALTH.has(amenity)) return { category: 'Services publics', typeLabel: 'Santé' };

  if (building === 'warehouse') return { category: 'Industrie', typeLabel: 'Entrepôt' };
  if (building === 'industrial' || tags.man_made === 'works') return { category: 'Industrie', typeLabel: 'Site industriel' };

  if (shop) return { category: 'Commerce', typeLabel: SHOP_LABELS[shop] ?? 'Commerce' };
  if (amenity && COMMERCE_AMENITIES.has(amenity)) {
    if (amenity === 'restaurant') return { category: 'Commerce', typeLabel: 'Restaurant' };
    if (amenity === 'cafe') return { category: 'Commerce', typeLabel: 'Café' };
    return { category: 'Commerce', typeLabel: 'Restauration rapide' };
  }

  if (building === 'residential' && tags.name) return { category: 'Résidentiel', typeLabel: 'Résidentiel' };
  return null;
}

export function buildOverpassPoiQuery(lat: number, lng: number, radiusM = MAP_POI_RADIUS_M): string {
  const radius = Math.max(100, Math.min(1500, Math.round(radiusM)));
  const center = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return `[out:json][timeout:4];(\n` +
    `nwr["shop"](around:${radius},${center});\n` +
    `nwr["amenity"~"^(fuel|police|fire_station|hospital|clinic|doctors|pharmacy|townhall|restaurant|cafe|fast_food)$"](around:${radius},${center});\n` +
    `nwr["building"~"^(industrial|warehouse)$"](around:${radius},${center});\n` +
    `nwr["man_made"="works"](around:${radius},${center});\n` +
    `nwr["craft"="car_repair"](around:${radius},${center});\n` +
    `nwr["building"="residential"]["name"](around:${radius},${center});\n` +
    `);out center tags;`;
}

function elementCoordinates(element: OverpassElement): { lat: number; lng: number } | null {
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function parseOverpassPois(elements: readonly OverpassElement[], maxResults = MAP_POI_MAX_RESULTS): MapPoi[] {
  const results: MapPoi[] = [];
  const seen = new Set<string>();
  for (const element of elements) {
    const tags = element.tags ?? {};
    const classification = classifyMapPoi(tags);
    const coordinates = elementCoordinates(element);
    if (!classification || !coordinates) continue;
    const id = `${element.type ?? 'element'}:${String(element.id ?? `${coordinates.lat},${coordinates.lng}`)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    results.push({
      id,
      ...coordinates,
      ...classification,
      name: named(tags),
    });
    if (results.length >= Math.max(1, maxResults)) break;
  }
  return results;
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
  return parseOverpassPois(Array.isArray(payload.elements) ? payload.elements : []);
}
