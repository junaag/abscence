import { describe, expect, it } from 'vitest';
import { getContextActions, performAction } from '../../src/engine/actions';
import { looseItemsAtCurrentLocation } from '../../src/engine/selectors';
import { createInitialState } from '../../src/engine/state';
import type { MapPoi, MapPoiCategory } from '../../src/ui/map-pois';
import { buildPoiBlueprint } from '../../src/ui/poi-content';

function target(id: string, name: string, lat: number, lon: number, category: MapPoiCategory, typeLabel: string): string {
  const poi: MapPoi = { id, name, lat, lng: lon, category, typeLabel };
  return encodeURIComponent(JSON.stringify({ id, name, lat, lon, category, typeLabel, blueprint: buildPoiBlueprint(poi) }));
}

function reachGarden() {
  let state = createInitialState();
  state = performAction(state, { id: 'MOVE', targetId: 'kitchen' }).state;
  state = performAction(state, { id: 'MOVE', targetId: 'garden' }).state;
  return state;
}

function reachPoi(category: MapPoiCategory, typeLabel: string, name: string) {
  let state = reachGarden();
  state = performAction(state, {
    id: 'TRAVEL_TO_MAP_POI',
    targetId: target(`test:${category}:${typeLabel}`, name, 43.4055, 5.0549, category, typeLabel),
  }).state;
  return state;
}

describe('structured POI sites', () => {
  it('makes health sites locked and gives them medical-specific resources', () => {
    let state = reachPoi('Santé', 'Pharmacie', 'Pharmacie test');
    state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
    const site = state.locations[state.player.locationId]?.poiSite;
    expect(site?.category).toBe('Santé');
    expect(site?.entranceLocked).toBe(true);
    expect(getContextActions(state).map((action) => action.id)).toContain('FORCE_POI_ACCESS');
    expect(performAction(state, { id: 'ENTER_POI' }).result.success).toBe(false);

    state = performAction(state, { id: 'FORCE_POI_ACCESS' }).state;
    state = performAction(state, { id: 'ENTER_POI' }).state;
    expect(state.locations[state.player.locationId]?.poiSite?.activeZoneId).toBe('public');
    expect(looseItemsAtCurrentLocation(state).map((item) => item.definitionId)).toContain('bandage_pack');

    const search = performAction(state, { id: 'SEARCH_LOCATION' });
    expect(search.result.success).toBe(true);
    expect(search.result.elapsedSeconds).toBeGreaterThanOrEqual(12 * 60);
    expect(looseItemsAtCurrentLocation(search.state).map((item) => item.definitionId)).toContain('first_aid_kit');
    expect(search.result.body).toContain('Indice :');
    expect(search.state.locations[search.state.player.locationId]?.poiSite?.zones?.[0]?.clue?.discovered).toBe(true);
  });

  it('keeps loot scoped to the active interior zone and supports locked secondary areas', () => {
    let state = reachPoi('Automobile', 'Station service', 'Station test');
    state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
    state = performAction(state, { id: 'ENTER_POI' }).state;
    const frontItemIds = looseItemsAtCurrentLocation(state).map((item) => item.id);
    expect(frontItemIds.length).toBeGreaterThan(0);
    expect(getContextActions(state).some((action) => action.id === 'FORCE_POI_ZONE' && action.targetId === 'stock')).toBe(true);

    state = performAction(state, { id: 'FORCE_POI_ZONE', targetId: 'stock' }).state;
    expect(state.locations[state.player.locationId]?.poiSite?.activeZoneId).toBe('stock');
    expect(looseItemsAtCurrentLocation(state).some((item) => frontItemIds.includes(item.id))).toBe(false);

    state = performAction(state, { id: 'SEARCH_LOCATION' }).state;
    const stockLoot = looseItemsAtCurrentLocation(state).map((item) => item.definitionId);
    expect(stockLoot).toContain('tool_kit');
    expect(stockLoot).toContain('crowbar');
    expect(state.locations[state.player.locationId]?.poiSite?.zones?.find((zone) => zone.id === 'stock')?.searched).toBe(true);
    expect(state.locations[state.player.locationId]?.poiSite?.zones?.find((zone) => zone.id === 'shop')?.searched).toBe(false);
  });

  it('lets the player secure a discovered risk before searching', () => {
    let state = reachPoi('Commerce', 'Supermarché', 'Commerce test');
    state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
    state = performAction(state, { id: 'ENTER_POI' }).state;
    const zone = state.locations[state.player.locationId]?.poiSite?.zones?.[0];
    expect(zone?.risk?.discovered).toBe(true);
    expect(zone?.risk?.resolved).toBe(false);
    expect(getContextActions(state).map((action) => action.id)).toContain('SECURE_POI_RISK');

    const painBefore = state.player.needs.pain;
    state = performAction(state, { id: 'SECURE_POI_RISK' }).state;
    expect(state.locations[state.player.locationId]?.poiSite?.zones?.[0]?.risk?.resolved).toBe(true);
    state = performAction(state, { id: 'SEARCH_LOCATION' }).state;
    expect(state.player.needs.pain).toBe(painBefore);
  });

  it('applies consequences when a known risk is ignored during a methodical search', () => {
    let state = reachPoi('Automobile', 'Station service', 'Station risquée');
    state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
    state = performAction(state, { id: 'ENTER_POI' }).state;
    const painBefore = state.player.needs.pain;
    const stressBefore = state.player.needs.stress;
    const search = performAction(state, { id: 'SEARCH_LOCATION' });
    expect(search.result.body).toContain('sans sécuriser');
    expect(search.state.player.needs.pain).toBeGreaterThan(painBefore);
    expect(search.state.player.needs.stress).toBeGreaterThan(stressBefore);
    expect(search.state.locations[search.state.player.locationId]?.poiSite?.zones?.[0]?.risk?.triggered).toBe(true);
  });
});