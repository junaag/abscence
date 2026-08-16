import { describe, expect, it } from 'vitest';
import { buildOverpassPoiQuery, classifyMapPoi, mapDistanceMeters, MAP_POI_MAX_RESULTS, parseOverpassPois } from '../../src/ui/map-pois';

describe('map POI adapter', () => {
  it('classifies car repair as Services before generic shop', () => {
    expect(classifyMapPoi({ shop: 'car_repair' })).toEqual({ category: 'Services', typeLabel: 'Garage / réparation auto' });
  });

  it('uses Station service instead of the old Carburant wording', () => {
    expect(classifyMapPoi({ amenity: 'fuel' })).toEqual({ category: 'Services', typeLabel: 'Station service' });
  });

  it('groups public services and health in Services publics', () => {
    expect(classifyMapPoi({ amenity: 'police' })).toEqual({ category: 'Services publics', typeLabel: 'Police' });
    expect(classifyMapPoi({ amenity: 'hospital' })).toEqual({ category: 'Services publics', typeLabel: 'Santé' });
  });

  it('keeps the requested simple French geographic categories', () => {
    expect(classifyMapPoi({ building: 'warehouse' })?.category).toBe('Industrie');
    expect(classifyMapPoi({ shop: 'books' })?.category).toBe('Commerce');
    expect(classifyMapPoi({ building: 'residential', name: 'Résidence des Pins' })?.category).toBe('Résidentiel');
    expect(classifyMapPoi({ building: 'residential' })).toBeNull();
  });

  it('builds a bounded Overpass query without bulk residential loading', () => {
    const query = buildOverpassPoiQuery(43.4053, 5.0548);
    expect(query).toContain('[timeout:4]');
    expect(query).toContain('around:1200,43.405300,5.054800');
    expect(query).toContain('["building"="residential"]["name"]');
    expect(query).not.toContain('["building"="residential"](around');
  });

  it('reads node or way-center coordinates and caps results at 45', () => {
    const elements = Array.from({ length: 60 }, (_, index) => ({
      type: index % 2 === 0 ? 'node' : 'way',
      id: index + 1,
      ...(index % 2 === 0 ? { lat: 43.405 + index / 100000, lon: 5.054 } : { center: { lat: 43.405 + index / 100000, lon: 5.054 } }),
      tags: { shop: 'convenience', name: `Commerce ${index + 1}` },
    }));
    const pois = parseOverpassPois(elements);
    expect(pois).toHaveLength(MAP_POI_MAX_RESULTS);
    expect(pois[0]).toMatchObject({ category: 'Commerce', typeLabel: 'Épicerie', name: 'Commerce 1' });
  });

  it('measures geographic distance for the home-area request guard', () => {
    expect(mapDistanceMeters({ lat: 43.4053, lng: 5.0548 }, { lat: 43.4053, lng: 5.0548 })).toBe(0);
    expect(mapDistanceMeters({ lat: 43.4053, lng: 5.0548 }, { lat: 43.4053, lng: 5.0748 })).toBeGreaterThan(1500);
  });
});
