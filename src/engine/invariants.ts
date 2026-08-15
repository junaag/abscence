import { getContainerDefinition } from '../content/containers';
import { getItemDefinition } from '../content/items';
import type { GameState, NeedsState } from './model';
export interface InvariantViolation { code: string; message: string; }
function violation(code: string, message: string): InvariantViolation { return { code, message }; }
function isPercent(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 100; }
export function validateState(state: GameState): InvariantViolation[] {
  const errors: InvariantViolation[] = [];
  if (!state.locations[state.player.locationId]) errors.push(violation('PLAYER_LOCATION_MISSING', `Player location ${state.player.locationId} does not exist.`));
  if (!isPercent(state.player.healthPv)) errors.push(violation('HEALTH_OUT_OF_RANGE', `Health must stay between 0 and 100 PV, got ${state.player.healthPv}.`));
  if (!Number.isFinite(state.engine.damageBudgetPv) || state.engine.damageBudgetPv < 0 || state.engine.damageBudgetPv >= 1) errors.push(violation('DAMAGE_BUDGET_INVALID', `Fractional PV damage budget must stay in [0, 1), got ${state.engine.damageBudgetPv}.`));
  for (const [key, value] of Object.entries(state.player.needs) as Array<[keyof NeedsState, number]>) if (!isPercent(value)) errors.push(violation('NEED_OUT_OF_RANGE', `${key} must stay between 0 and 100, got ${value}.`));
  if (!isPercent(state.infrastructure.water.pressure * 100)) errors.push(violation('WATER_PRESSURE_INVALID', 'Water pressure must stay between 0 and 1.'));
  if (!isPercent(state.infrastructure.electricity.voltagePercent)) errors.push(violation('VOLTAGE_INVALID', 'Electricity voltage must stay between 0 and 100 %.'));
  for (const location of Object.values(state.locations)) if (!Number.isFinite(location.ambientTemperatureC)) errors.push(violation('LOCATION_TEMPERATURE_INVALID', `${location.id} has an invalid ambient temperature.`));
  for (const connection of Object.values(state.connections)) { if (!state.locations[connection.a]) errors.push(violation('CONNECTION_ENDPOINT_MISSING', `${connection.id}.a points to missing location ${connection.a}.`)); if (!state.locations[connection.b]) errors.push(violation('CONNECTION_ENDPOINT_MISSING', `${connection.id}.b points to missing location ${connection.b}.`)); if (connection.a === connection.b) errors.push(violation('CONNECTION_SELF_LOOP', `${connection.id} connects a location to itself.`)); if (!Number.isFinite(connection.openSeconds) || connection.openSeconds < 0) errors.push(violation('CONNECTION_OPEN_DURATION_INVALID', `${connection.id} has invalid openSeconds.`)); if (!Number.isFinite(connection.travelSeconds) || connection.travelSeconds < 0) errors.push(violation('CONNECTION_TRAVEL_DURATION_INVALID', `${connection.id} has invalid travelSeconds.`)); }
  const inventorySeen = new Set<string>();
  for (const itemId of state.player.inventoryIds) { if (inventorySeen.has(itemId)) errors.push(violation('INVENTORY_DUPLICATE', `${itemId} appears more than once in inventory.`)); inventorySeen.add(itemId); const item = state.items[itemId]; if (!item) errors.push(violation('INVENTORY_ITEM_MISSING', `Inventory references missing item ${itemId}.`)); else if (item.location.kind !== 'inventory') errors.push(violation('INVENTORY_LOCATION_MISMATCH', `${itemId} is listed in inventory but its location is ${item.location.kind}.`)); }
  const containerMembership = new Map<string, string>();
  for (const container of Object.values(state.containers)) { if (!getContainerDefinition(container.definitionId)) errors.push(violation('CONTAINER_DEFINITION_MISSING', `${container.id} uses unknown definition ${container.definitionId}.`)); if (!state.locations[container.locationId]) errors.push(violation('CONTAINER_LOCATION_MISSING', `${container.id} points to missing location ${container.locationId}.`)); const seen = new Set<string>(); for (const itemId of container.contentIds) { if (seen.has(itemId)) errors.push(violation('CONTAINER_DUPLICATE_ITEM', `${itemId} appears twice in ${container.id}.`)); seen.add(itemId); const previous = containerMembership.get(itemId); if (previous && previous !== container.id) errors.push(violation('ITEM_IN_MULTIPLE_CONTAINERS', `${itemId} appears in ${previous} and ${container.id}.`)); containerMembership.set(itemId, container.id); const item = state.items[itemId]; if (!item) errors.push(violation('CONTAINER_ITEM_MISSING', `${container.id} references missing item ${itemId}.`)); else if (item.location.kind !== 'container' || item.location.id !== container.id) errors.push(violation('CONTAINER_LOCATION_MISMATCH', `${itemId} is listed in ${container.id} but its item location disagrees.`)); } }
  for (const item of Object.values(state.items)) {
    const definition = getItemDefinition(item.definitionId);
    const battery = definition?.battery;
    const perishable = definition?.perishable;
    if (battery && !isPercent(item.batteryPercent ?? battery.initialChargePct)) errors.push(violation('BATTERY_INVALID', `${item.id} has invalid battery charge.`));
    if (perishable && item.freshnessPercent === undefined) errors.push(violation('FRESHNESS_MISSING', `${item.id} is perishable but has no persistent freshness.`));
    if (item.freshnessPercent !== undefined && !isPercent(item.freshnessPercent)) errors.push(violation('FRESHNESS_INVALID', `${item.id} has invalid freshness ${item.freshnessPercent}.`));
    switch (item.location.kind) {
      case 'inventory': if (!inventorySeen.has(item.id)) errors.push(violation('ITEM_INVENTORY_MISMATCH', `${item.id} says inventory but is absent from inventoryIds.`)); if (containerMembership.has(item.id)) errors.push(violation('ITEM_MULTIPLE_LOCATIONS', `${item.id} is both inventory and in a container.`)); break;
      case 'location': if (!state.locations[item.location.id]) errors.push(violation('ITEM_LOCATION_MISSING', `${item.id} points to missing location ${item.location.id}.`)); if (inventorySeen.has(item.id) || containerMembership.has(item.id)) errors.push(violation('ITEM_MULTIPLE_LOCATIONS', `${item.id} has conflicting location references.`)); break;
      case 'container': { const container = state.containers[item.location.id]; if (!container) errors.push(violation('ITEM_CONTAINER_MISSING', `${item.id} points to missing container ${item.location.id}.`)); else if (!container.contentIds.includes(item.id)) errors.push(violation('ITEM_CONTAINER_MISMATCH', `${item.id} points to ${container.id} but is absent from contentIds.`)); if (inventorySeen.has(item.id)) errors.push(violation('ITEM_MULTIPLE_LOCATIONS', `${item.id} is both in inventory and a container.`)); break; }
      case 'consumed': if (inventorySeen.has(item.id) || containerMembership.has(item.id)) errors.push(violation('CONSUMED_ITEM_REFERENCED', `${item.id} is consumed but still referenced as accessible.`)); break;
    }
  }
  return errors;
}
export function assertValidState(state: GameState): void { const errors = validateState(state); if (errors.length === 0) return; const summary = errors.map((error) => `${error.code}: ${error.message}`).join('\n'); throw new Error(`Invalid ABSENCE game state:\n${summary}`); }
