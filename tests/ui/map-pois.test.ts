import { describe, expect, it } from 'vitest';
import {
  buildOverpassPoiQuery,
  classifyMapPoi,
  mapDistanceMeters,
  MAP_POI_CATEGORY_LIMITS,
  MAP_POI_MAX_RESULTS,
  parseOverpassPois,
  type MapPoiCategory,
  type OverpassElement,
} from '../../src/ui/map-pois';

describe('map POI adapter', () => {
  it('classifies automotive POIs separately from public services', () => {
    expect(classifyMapPoi({ shop: 'car_repair' })).toEqual({ category: 'Automobile', typeLabel: 'Garage / réparation auto' });
    expect(classifyMapPoi({ amenity: 'fuel' })).toEqual({ category: 'Automobile', typeLabel: 'Station service' });
    expect(classifyMapPoi({ amenity: 'police' })).toEqual({ category: 'Services publics', typeLabel: 'Police' });
  });

  it('puts pharmacies and medical facilities in the dedicated Santé category', () => {
    expect(classifyMapPoi({ amenity: 'pharmacy' })).toEqual({ category: 'Santé', typeLabel: 'Pharmacie' });
    expect(classifyMapPoi({ amenity: 'hospital' })).toEqual({ category: 'Santé', typeLabel: 'Hôpital' });
    expect(classifyMapPoi({ healthcare: 'clinic' })).toEqual({ category: 'Santé', typeLabel: 'Clinique' });
  });

  it('keeps only gameplay-relevant commerce types and accepts representative residential buildings', () => {
    expect(classifyMapPoi({ building: 'warehouse' })?.category).toBe('Industrie');
    expect(classifyMapPoi({ shop: 'books' })?.category).toBe('Commerce');
    expect(classifyMapPoi({ shop: 'clothes' })).toBeNull();
    expect(classifyMapPoi({ amenity: 'restaurant' })).toBeNull();
    expect(classifyMapPoi({ building: 'residential' })?.category).toBe('Résidentiel');
    expect(classifyMapPoi({ building: 'house' })?.category).toBe('Résidentiel');
  });

  it('builds a bounded Overpass query and gives residential POIs a smaller local radius', () => {
    const query = buildOverpassPoiQuery(43.4053, 5.0548);
    expect(query).toContain('[timeout:4]');
    expect(query).toContain('around:1200,43.405300,5.054800');
    expect(query).toContain('around:650,43.405300,5.054800');
    expect(query).toContain('supermarket|convenience|grocery|greengrocer|bakery|books|mall|car_repair');
    expect(query).not.toContain('restaurant|cafe|fast_food');
    expect(query).toContain('.core out center 70');
    expect(query).toContain('.residential out center 70');
  });

  it('caps and balances dense urban POIs by category', () => {
    const baseLat = 43.4053;
    const baseLng = 5.0548;
    let id = 1;
    const element = (tags: Record<string, string>, offset: number): OverpassElement => ({
      type: 'node',
      id: id++,
      lat: baseLat + offset * 0.0012,
      lon: baseLng + offset * 0.0012,
      tags,
    });

    const elements: OverpassElement[] = [];
    for (let index = 0; index < 12; index += 1) elements.push(element({ building: 'house', 'addr:housenumber': String(index + 1), 'addr:street': 'Rue Test' }, index));
    elements.push(element({ shop: 'supermarket', name: 'Supermarché A' }, 20));
    elements.push(element({ shop: 'convenience', name: 'Épicerie B' }, 22));
    elements.push(element({ shop: 'bakery', name: 'Boulangerie C' }, 24));
    elements.push(element({ shop: 'greengrocer', name: 'Primeur D' }, 26));
    elements.push(element({ amenity: 'pharmacy', name: 'Pharmacie A' }, 30));
    elements.push(element({ amenity: 'hospital', name: 'Hôpital B' }, 32));
    elements.push(element({ amenity: 'clinic', name: 'Clinique C' }, 34));
    elements.push(element({ amenity: 'fuel', name: 'Station A' }, 40));
    elements.push(element({ shop: 'car_repair', name: 'Garage B' }, 42));
    elements.push(element({ amenity: 'police', name: 'Police A' }, 50));
    elements.push(element({ amenity: 'fire_station', name: 'Pompiers B' }, 52));
    elements.push(element({ amenity: 'townhall', name: 'Mairie C' }, 54));
    elements.push(element({ building: 'warehouse', name: 'Entrepôt A' }, 60));
    elements.push(element({ building: 'industrial', name: 'Usine B' }, 62));

    const pois = parseOverpassPois(elements, MAP_POI_MAX_RESULTS, { lat: baseLat, lng: baseLng });
    const counts = new Map<MapPoiCategory, number>();
    for (const poi of pois) counts.set(poi.category, (counts.get(poi.category) ?? 0) + 1);

    expect(pois).toHaveLength(MAP_POI_MAX_RESULTS);
    for (const [category, limit] of Object.entries(MAP_POI_CATEGORY_LIMITS) as Array<[MapPoiCategory, number]>) {
      expect(counts.get(category) ?? 0).toBe(limit);
    }
    expect(pois.filter((poi) => poi.category === 'Santé').map((poi) => poi.typeLabel)).toEqual(['Pharmacie', 'Hôpital']);
    expect(pois.filter((poi) => poi.category === 'Résidentiel')[0]?.name).toContain('Rue Test');
  });

  it('spreads repeated POIs of the same type instead of drawing dense marker clusters', () => {
    const elements: OverpassElement[] = [
      { type: 'node', id: 1, lat: 43.4053, lon: 5.0548, tags: { shop: 'bakery', name: 'Boulangerie A' } },
      { type: 'node', id: 2, lat: 43.40531, lon: 5.05481, tags: { shop: 'bakery', name: 'Boulangerie B' } },
      { type: 'node', id: 3, lat: 43.407, lon: 5.0565, tags: { shop: 'bakery', name: 'Boulangerie C' } },
    ];
    const pois = parseOverpassPois(elements, MAP_POI_MAX_RESULTS, { lat: 43.4053, lng: 5.0548 });
    expect(pois.map((poi) => poi.name)).toEqual(['Boulangerie A', 'Boulangerie C']);
  });

  it('measures geographic distance for the home-area request guard', () => {
    expect(mapDistanceMeters({ lat: 43.4053, lng: 5.0548 }, { lat: 43.4053, lng: 5.0548 })).toBe(0);
    expect(mapDistanceMeters({ lat: 43.4053, lng: 5.0548 }, { lat: 43.4053, lng: 5.0748 })).toBeGreaterThan(1500);
  });
});
