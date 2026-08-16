import { getItemDefinition } from '../content/items';
import { isWaterAvailable } from './infrastructure';
import type { ConnectionState, ContainerState, EquipmentState, GameState, ItemState, LocationState } from './model';

export { isElectricityAvailable, isMobileAvailable, isWaterAvailable } from './infrastructure';

export const DEFAULT_BASE_CARRY_CAPACITY = 4;

export function currentLocation(state: GameState): LocationState {
  const location = state.locations[state.player.locationId];
  if (!location) throw new Error(`Unknown player location: ${state.player.locationId}`);
  return location;
}

export function connectedDestinations(state: GameState): Array<{ connection: ConnectionState; location: LocationState }> {
  const currentId = state.player.locationId;
  const result: Array<{ connection: ConnectionState; location: LocationState }> = [];
  for (const connection of Object.values(state.connections)) {
    let destinationId: string | undefined;
    if (connection.a === currentId) destinationId = connection.b;
    if (connection.b === currentId) destinationId = connection.a;
    if (!destinationId) continue;
    const location = state.locations[destinationId];
    if (location) result.push({ connection, location });
  }
  return result;
}

export function containersAtCurrentLocation(state: GameState): ContainerState[] {
  return Object.values(state.containers).filter((container) => container.locationId === state.player.locationId);
}

function itemVisibleInActivePoiZone(state: GameState, item: ItemState): boolean {
  if (!item.poiZoneId) return true;
  const location = state.locations[state.player.locationId];
  const site = location?.poiSite;
  return Boolean(site?.phase === 'inside' && site.activeZoneId === item.poiZoneId);
}

export function looseItemsAtCurrentLocation(state: GameState): ItemState[] {
  return Object.values(state.items).filter((item) => item.location.kind === 'location'
    && item.location.id === state.player.locationId
    && itemVisibleInActivePoiZone(state, item));
}

export function inventoryItems(state: GameState): ItemState[] {
  return state.player.inventoryIds.map((id) => state.items[id]).filter((item): item is ItemState => Boolean(item));
}

export function equipmentState(state: GameState): EquipmentState {
  return state.player.equipment ?? { back: null, waist: null };
}

export function isItemEquipped(state: GameState, itemId: string): boolean {
  const equipment = equipmentState(state);
  return equipment.back === itemId || equipment.waist === itemId;
}

function carryCost(item: ItemState): number {
  const definition = getItemDefinition(item.definitionId);
  return Math.max(0, definition?.carryCost ?? (definition?.portable === false ? 0 : 1));
}

export function getCarryLoad(state: GameState): number {
  return inventoryItems(state).reduce((total, item) => total + carryCost(item), 0);
}

export function getCarryCapacity(state: GameState): number {
  let capacity = Math.max(0, state.player.baseCarryCapacity ?? DEFAULT_BASE_CARRY_CAPACITY);
  const equipment = equipmentState(state);
  for (const itemId of [equipment.back, equipment.waist]) {
    if (!itemId) continue;
    const item = state.items[itemId];
    if (!item || item.location.kind !== 'inventory') continue;
    capacity += Math.max(0, getItemDefinition(item.definitionId)?.equipment?.capacityBonus ?? 0);
  }
  return capacity;
}

export function canCarryItem(state: GameState, itemId: string): boolean {
  const item = state.items[itemId];
  if (!item) return false;
  if (item.location.kind === 'inventory') return true;
  return getCarryLoad(state) + carryCost(item) <= getCarryCapacity(state) + 0.000001;
}

export function containerContents(state: GameState, containerId: string): ItemState[] {
  const container = state.containers[containerId];
  if (!container || !container.open) return [];
  return container.contentIds.map((id) => state.items[id]).filter((item): item is ItemState => item !== undefined && item.location.kind !== 'consumed');
}

export function isItemAccessible(state: GameState, itemId: string): boolean {
  const item = state.items[itemId];
  if (!item) return false;
  if (item.location.kind === 'inventory') return true;
  if (item.location.kind === 'location') {
    return item.location.id === state.player.locationId && itemVisibleInActivePoiZone(state, item);
  }
  if (item.location.kind === 'container') {
    const container = state.containers[item.location.id];
    return Boolean(container && container.locationId === state.player.locationId && container.open);
  }
  return false;
}

export function hasRunningTap(state: GameState): boolean {
  return Boolean(currentLocation(state).features.tap && isWaterAvailable(state));
}