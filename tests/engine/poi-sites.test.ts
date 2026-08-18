import { describe, expect, it } from 'vitest';
import { getContextActions, performAction } from '../../src/engine/actions';
import { looseItemsAtCurrentLocation } from '../../src/engine/selectors';
import { createInitialState } from '../../src/engine/state';
import type { ZoneAlphaCategory, ZoneAlphaPoi } from '../../src/content/zone-alpha';
import { buildPoiBlueprint } from '../../src/ui/poi-content';

function target(id: string, name: string, category: ZoneAlphaCategory, typeLabel: string, x = 190, y = 336): string {
  const poi: ZoneAlphaPoi = { id, name, x, y, category, typeLabel, widthM: 50, heightM: 35 };
  return encodeURIComponent(JSON.stringify({ id, name, x, y, category, typeLabel, blueprint: buildPoiBlueprint(poi) }));
}

function reachGarden() {
  let state = createInitialState();
  state = performAction(state, { id: 'MOVE', targetId: 'kitchen' }).state;
  state = performAction(state, { id: 'MOVE', targetId: 'garden' }).state;
  return state;
}

function reachPoi(category: ZoneAlphaCategory, typeLabel: string, name: string, id = `test:${category}:${typeLabel}`) {
  let state = reachGarden();
  state = performAction(state, {
    id: 'TRAVEL_TO_MAP_POI',
    targetId: target(id, name, category, typeLabel),
  }).state;
  return state;
}

function enterObservedPoi(state: ReturnType<typeof createInitialState>) {
  state = performAction(state, { id: 'OBSERVE_LOCATION' }).state;
  if (getContextActions(state).some((action) => action.id === 'FORCE_POI_ACCESS')) {
    state = performAction(state, { id: 'FORCE_POI_ACCESS' }).state;
  }
  return performAction(state, { id: 'ENTER_POI' }).state;
}

function completeSearch(state: ReturnType<typeof createInitialState>, chunks: number) {
  for (let index = 0; index < chunks; index += 1) state = performAction(state, { id: 'SEARCH_LOCATION' }).state;
  return state;
}

describe('structured narrative POI sites', () => {
  it('makes health sites locked and reveals medical resources only after a long exhaustive search', () => {
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

    const first = performAction(state, { id: 'SEARCH_LOCATION' });
    expect(first.result.success).toBe(true);
    expect(first.result.elapsedSeconds).toBe(15 * 60);
    expect(looseItemsAtCurrentLocation(first.state).map((item) => item.definitionId)).not.toContain('first_aid_kit');
    expect(first.state.locations[first.state.player.locationId]?.poiSite?.zones?.[0]?.clue?.discovered).toBe(false);

    state = completeSearch(first.state, 2);
    expect(looseItemsAtCurrentLocation(state).map((item) => item.definitionId)).toContain('first_aid_kit');
    expect(state.locations[state.player.locationId]?.poiSite?.zones?.[0]?.clue?.discovered).toBe(true);
  });

  it('keeps loot scoped to the active significant space and supports locked secondary spaces', () => {
    let state = enterObservedPoi(reachPoi('Automobile', 'Station service', 'Station test'));
    const frontItemIds = looseItemsAtCurrentLocation(state).map((item) => item.id);
    expect(frontItemIds.length).toBeGreaterThan(0);
    expect(getContextActions(state).some((action) => action.id === 'FORCE_POI_ZONE' && action.targetId === 'stock')).toBe(true);

    state = performAction(state, { id: 'FORCE_POI_ZONE', targetId: 'stock' }).state;
    expect(state.locations[state.player.locationId]?.poiSite?.activeZoneId).toBe('stock');
    expect(looseItemsAtCurrentLocation(state).some((item) => frontItemIds.includes(item.id))).toBe(false);

    state = completeSearch(state, 4);
    const stockLoot = looseItemsAtCurrentLocation(state).map((item) => item.definitionId);
    expect(stockLoot).toContain('tool_kit');
    expect(stockLoot).toContain('crowbar');
    expect(state.locations[state.player.locationId]?.poiSite?.zones?.find((zone) => zone.id === 'stock')?.searched).toBe(true);
    expect(state.locations[state.player.locationId]?.poiSite?.zones?.find((zone) => zone.id === 'shop')?.searched).toBe(false);
  });

  it('keeps a residential annex hidden until exhaustive search reveals its access', () => {
    let state = enterObservedPoi(reachPoi('Résidentiel', 'Habitation', 'Maison 2', 'house_2'));
    const site = state.locations[state.player.locationId]?.poiSite;
    expect(site?.zones?.filter((zone) => zone.discovered).map((zone) => zone.id)).toEqual(['living', 'kitchen', 'night']);
    expect(site?.zones?.find((zone) => zone.id === 'annex')?.discovered).toBe(false);
    expect(getContextActions(state).some((action) => action.targetId === 'annex')).toBe(false);

    state = performAction(state, { id: 'MOVE_POI_ZONE', targetId: 'kitchen' }).state;
    state = completeSearch(state, 3);
    const annex = state.locations[state.player.locationId]?.poiSite?.zones?.find((zone) => zone.id === 'annex');
    expect(annex?.discovered).toBe(true);
    expect(['Cellier', 'Buanderie', 'Cave', 'Dépendance']).toContain(annex?.name);
    expect(getContextActions(state).some((action) => action.targetId === 'annex')).toBe(true);
  });

  it('lets the player secure a discovered risk before investing time in a search', () => {
    let state = enterObservedPoi(reachPoi('Commerce', 'Alimentation', 'Commerce test'));
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

  it('applies consequences once when a known risk is ignored during a long search', () => {
    const state = enterObservedPoi(reachPoi('Automobile', 'Station service', 'Station risquée'));
    const painBefore = state.player.needs.pain;
    const stressBefore = state.player.needs.stress;
    const search = performAction(state, { id: 'SEARCH_LOCATION' });
    expect(search.result.body).toContain('sans sécuriser');
    expect(search.state.player.needs.pain).toBeGreaterThan(painBefore);
    expect(search.state.player.needs.stress).toBeGreaterThan(stressBefore);
    expect(search.state.locations[search.state.player.locationId]?.poiSite?.zones?.[0]?.risk?.triggered).toBe(true);
  });
});
