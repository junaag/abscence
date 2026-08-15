import type { ConnectionState, ContainerState, GameState, ItemState, LocationState } from './model';

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

export function looseItemsAtCurrentLocation(state: GameState): ItemState[] {
  return Object.values(state.items).filter((item) => item.location.kind === 'location' && item.location.id === state.player.locationId);
}

export function inventoryItems(state: GameState): ItemState[] {
  return state.player.inventoryIds.map((id) => state.items[id]).filter((item): item is ItemState => Boolean(item));
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
  if (item.location.kind === 'location') return item.location.id === state.player.locationId;
  if (item.location.kind === 'container') {
    const container = state.containers[item.location.id];
    return Boolean(container && container.locationId === state.player.locationId && container.open);
  }
  return false;
}

export function isElectricityAvailable(state: GameState): boolean {
  return state.infrastructure.electricity.available && state.infrastructure.electricity.voltagePercent > 0;
}

export function hasRunningTap(state: GameState): boolean {
  return Boolean(currentLocation(state).features.tap && state.infrastructure.water.available);
}
