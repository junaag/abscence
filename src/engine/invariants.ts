import { getContainerDefinition } from '../content/containers';
import { getItemDefinition } from '../content/items';
import { WORLD_EVENT_DEFINITIONS } from '../content/world-events';
import type { GameState, NeedsState, WorldEventRecord } from './model';

export interface InvariantViolation { code: string; message: string; }
function violation(code: string, message: string): InvariantViolation { return { code, message }; }
function isPercent(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 100; }
function isFixedWorldRecord(value: GameState['world']['eventHistory'][number]): value is WorldEventRecord { return 'id' in value && 'atSeconds' in value; }

export function validateState(state: GameState): InvariantViolation[] {
  const errors: InvariantViolation[] = [];
  if (!state.locations[state.player.locationId]) errors.push(violation('PLAYER_LOCATION_MISSING', `Player location ${state.player.locationId} does not exist.`));
  if (!isPercent(state.player.healthPv)) errors.push(violation('HEALTH_OUT_OF_RANGE', `Health must stay between 0 and 100 PV, got ${state.player.healthPv}.`));
  if (!Number.isFinite(state.engine.damageBudgetPv) || state.engine.damageBudgetPv < 0 || state.engine.damageBudgetPv >= 1) errors.push(violation('DAMAGE_BUDGET_INVALID', `Fractional PV damage budget must stay in [0, 1), got ${state.engine.damageBudgetPv}.`));
  if (!Number.isFinite(state.engine.elapsedSeconds) || state.engine.elapsedSeconds < 0) errors.push(violation('ENGINE_TIME_INVALID', `Engine elapsed time must be non-negative, got ${state.engine.elapsedSeconds}.`));
  if (!Number.isInteger(state.engine.nextEffectId) || state.engine.nextEffectId < 1) errors.push(violation('NEXT_EFFECT_ID_INVALID', `nextEffectId must be a positive integer, got ${state.engine.nextEffectId}.`));
  if (state.engine.worldEventSeed !== undefined && !Number.isFinite(state.engine.worldEventSeed)) errors.push(violation('WORLD_EVENT_SEED_INVALID', 'World event seed must be finite.'));
  for (const [key, value] of Object.entries(state.player.needs) as Array<[keyof NeedsState, number]>) if (!isPercent(value)) errors.push(violation('NEED_OUT_OF_RANGE', `${key} must stay between 0 and 100, got ${value}.`));
  if (!isPercent(state.infrastructure.water.pressure * 100)) errors.push(violation('WATER_PRESSURE_INVALID', 'Water pressure must stay between 0 and 1.'));
  if (!isPercent(state.infrastructure.electricity.voltagePercent)) errors.push(violation('VOLTAGE_INVALID', 'Electricity voltage must stay between 0 and 100 %.'));
  if (!Number.isFinite(state.infrastructure.mobile.signal) || state.infrastructure.mobile.signal < 0 || state.infrastructure.mobile.signal > 4) errors.push(violation('MOBILE_SIGNAL_INVALID', 'Mobile signal must stay between 0 and 4.'));

  const infrastructureTransitionIds = new Set<string>();
  for (const transition of state.infrastructure.transitions ?? []) {
    if (infrastructureTransitionIds.has(transition.id)) errors.push(violation('INFRA_TRANSITION_DUPLICATE_ID', `Infrastructure transition id ${transition.id} is duplicated.`));
    infrastructureTransitionIds.add(transition.id);
    if (!Number.isFinite(transition.atSeconds) || transition.atSeconds < 0) errors.push(violation('INFRA_TRANSITION_TIME_INVALID', `${transition.id} has invalid atSeconds.`));
    if (typeof transition.available !== 'boolean') errors.push(violation('INFRA_TRANSITION_AVAILABLE_INVALID', `${transition.id} has invalid availability.`));
    if (transition.processed && transition.atSeconds > state.engine.elapsedSeconds) errors.push(violation('INFRA_TRANSITION_PROCESSED_EARLY', `${transition.id} is marked processed before its scheduled time.`));
    if (transition.network === 'electricity' && transition.voltagePercent !== undefined && !isPercent(transition.voltagePercent)) errors.push(violation('INFRA_TRANSITION_VOLTAGE_INVALID', `${transition.id} has invalid voltage.`));
    if (transition.network === 'water' && transition.pressure !== undefined && (!Number.isFinite(transition.pressure) || transition.pressure < 0 || transition.pressure > 1)) errors.push(violation('INFRA_TRANSITION_PRESSURE_INVALID', `${transition.id} has invalid pressure.`));
    if (transition.network === 'mobile' && transition.signal !== undefined && (!Number.isFinite(transition.signal) || transition.signal < 0 || transition.signal > 4)) errors.push(violation('INFRA_TRANSITION_SIGNAL_INVALID', `${transition.id} has invalid signal.`));
  }

  for (const location of Object.values(state.locations)) {
    if (!Number.isFinite(location.ambientTemperatureC)) errors.push(violation('LOCATION_TEMPERATURE_INVALID', `${location.id} has an invalid ambient temperature.`));
    if (!isPercent(location.ambientHumidityPercent)) errors.push(violation('LOCATION_HUMIDITY_INVALID', `${location.id} has invalid humidity ${location.ambientHumidityPercent}.`));
    if (!Number.isFinite(location.ventilation) || location.ventilation < 0) errors.push(violation('LOCATION_VENTILATION_INVALID', `${location.id} has invalid ventilation ${location.ventilation}.`));
  }

  for (const connection of Object.values(state.connections)) {
    if (!state.locations[connection.a]) errors.push(violation('CONNECTION_ENDPOINT_MISSING', `${connection.id}.a points to missing location ${connection.a}.`));
    if (!state.locations[connection.b]) errors.push(violation('CONNECTION_ENDPOINT_MISSING', `${connection.id}.b points to missing location ${connection.b}.`));
    if (connection.a === connection.b) errors.push(violation('CONNECTION_SELF_LOOP', `${connection.id} connects a location to itself.`));
    if (!Number.isFinite(connection.openSeconds) || connection.openSeconds < 0) errors.push(violation('CONNECTION_OPEN_DURATION_INVALID', `${connection.id} has invalid openSeconds.`));
    if (!Number.isFinite(connection.travelSeconds) || connection.travelSeconds < 0) errors.push(violation('CONNECTION_TRAVEL_DURATION_INVALID', `${connection.id} has invalid travelSeconds.`));
  }

  const effectIds = new Set<string>();
  for (const effect of state.world.effects) {
    if (effectIds.has(effect.id)) errors.push(violation('EFFECT_DUPLICATE_ID', `Persistent effect id ${effect.id} is duplicated.`));
    effectIds.add(effect.id);
    if (!state.locations[effect.locationId]) errors.push(violation('EFFECT_LOCATION_MISSING', `${effect.id} points to missing location ${effect.locationId}.`));
    if (!isPercent(effect.intensity)) errors.push(violation('EFFECT_INTENSITY_INVALID', `${effect.id} has invalid intensity ${effect.intensity}.`));
    if (!Number.isFinite(effect.createdAtSeconds) || effect.createdAtSeconds < 0) errors.push(violation('EFFECT_CREATED_AT_INVALID', `${effect.id} has invalid createdAtSeconds.`));
    if (!Number.isFinite(effect.updatedAtSeconds) || effect.updatedAtSeconds < effect.createdAtSeconds) errors.push(violation('EFFECT_UPDATED_AT_INVALID', `${effect.id} has invalid updatedAtSeconds.`));
    if (!effect.active && effect.intensity !== 0) errors.push(violation('RESOLVED_EFFECT_NONZERO', `${effect.id} is inactive but still has non-zero intensity.`));
  }

  const scheduledIds = new Set<string>();
  for (const event of state.world.scheduledEvents) {
    if (scheduledIds.has(event.id)) errors.push(violation('SCHEDULED_EVENT_DUPLICATE_ID', `Scheduled event id ${event.id} is duplicated.`));
    scheduledIds.add(event.id);
    if (!state.locations[event.locationId]) errors.push(violation('SCHEDULED_EVENT_LOCATION_MISSING', `${event.id} points to missing location ${event.locationId}.`));
    if (!Number.isFinite(event.atSeconds) || event.atSeconds < 0) errors.push(violation('SCHEDULED_EVENT_TIME_INVALID', `${event.id} has invalid atSeconds.`));
    if (event.processed && event.atSeconds > state.engine.elapsedSeconds) errors.push(violation('SCHEDULED_EVENT_PROCESSED_EARLY', `${event.id} is marked processed before its scheduled time.`));
  }

  for (const [sourceKey, source] of Object.entries(state.world.eventSources ?? {})) {
    if (sourceKey !== source.id) errors.push(violation('WORLD_EVENT_SOURCE_KEY_MISMATCH', `${sourceKey} contains source ${source.id}.`));
    if (!WORLD_EVENT_DEFINITIONS[source.definitionId]) errors.push(violation('WORLD_EVENT_SOURCE_DEFINITION_INVALID', `${source.id} uses unknown definition ${source.definitionId}.`));
    if (source.locationId && !state.locations[source.locationId]) errors.push(violation('WORLD_EVENT_SOURCE_LOCATION_MISSING', `${source.id} points to missing location ${source.locationId}.`));
    if (!Number.isFinite(source.probability) || source.probability < 0 || source.probability > 1) errors.push(violation('WORLD_EVENT_SOURCE_PROBABILITY_INVALID', `${source.id} has invalid probability.`));
    for (const [field, value] of [['minDelaySeconds', source.minDelaySeconds], ['maxDelaySeconds', source.maxDelaySeconds], ['cooldownMinSeconds', source.cooldownMinSeconds], ['cooldownMaxSeconds', source.cooldownMaxSeconds], ['durationSeconds', source.durationSeconds]] as const) {
      if (!Number.isFinite(value) || value < 0) errors.push(violation('WORLD_EVENT_SOURCE_DURATION_INVALID', `${source.id}.${field} must be non-negative.`));
    }
    if (!Number.isInteger(source.maxOccurrences) || source.maxOccurrences < 1) errors.push(violation('WORLD_EVENT_SOURCE_OCCURRENCES_INVALID', `${source.id} has invalid maxOccurrences.`));
    if (!Number.isInteger(source.maxAttempts) || source.maxAttempts < source.maxOccurrences) errors.push(violation('WORLD_EVENT_SOURCE_ATTEMPTS_INVALID', `${source.id} has invalid maxAttempts.`));
    if (!Number.isInteger(source.attemptIndex) || source.attemptIndex < 0 || source.attemptIndex > source.maxAttempts) errors.push(violation('WORLD_EVENT_SOURCE_ATTEMPT_INDEX_INVALID', `${source.id} has invalid attemptIndex.`));
    if (!Number.isInteger(source.occurrenceCount) || source.occurrenceCount < 0 || source.occurrenceCount > source.maxOccurrences) errors.push(violation('WORLD_EVENT_SOURCE_OCCURRENCE_COUNT_INVALID', `${source.id} has invalid occurrenceCount.`));
    if (source.scheduleBaseAtSeconds !== null && (!Number.isFinite(source.scheduleBaseAtSeconds) || source.scheduleBaseAtSeconds < 0)) errors.push(violation('WORLD_EVENT_SOURCE_BASE_TIME_INVALID', `${source.id} has invalid schedule base.`));
    if (source.nextTriggerAtSeconds !== null && (!Number.isFinite(source.nextTriggerAtSeconds) || source.nextTriggerAtSeconds < 0)) errors.push(violation('WORLD_EVENT_SOURCE_TRIGGER_TIME_INVALID', `${source.id} has invalid next trigger.`));
  }

  const autonomousEventIds = new Set<string>();
  for (const event of state.world.events ?? []) {
    if (autonomousEventIds.has(event.id)) errors.push(violation('AUTONOMOUS_EVENT_DUPLICATE_ID', `Autonomous event id ${event.id} is duplicated.`));
    autonomousEventIds.add(event.id);
    if (!WORLD_EVENT_DEFINITIONS[event.definitionId]) errors.push(violation('AUTONOMOUS_EVENT_DEFINITION_INVALID', `${event.id} uses unknown definition ${event.definitionId}.`));
    if (event.locationId && !state.locations[event.locationId]) errors.push(violation('AUTONOMOUS_EVENT_LOCATION_MISSING', `${event.id} points to missing location ${event.locationId}.`));
    if (!Number.isFinite(event.startedAtSeconds) || event.startedAtSeconds < 0 || event.startedAtSeconds > state.engine.elapsedSeconds) errors.push(violation('AUTONOMOUS_EVENT_START_INVALID', `${event.id} has invalid start time.`));
    if (event.endsAtSeconds !== undefined && (!Number.isFinite(event.endsAtSeconds) || event.endsAtSeconds < event.startedAtSeconds)) errors.push(violation('AUTONOMOUS_EVENT_END_INVALID', `${event.id} has invalid end time.`));
    if (event.status === 'resolved' && (event.resolvedAtSeconds === undefined || !Number.isFinite(event.resolvedAtSeconds) || event.resolvedAtSeconds < event.startedAtSeconds || event.resolvedAtSeconds > state.engine.elapsedSeconds)) errors.push(violation('AUTONOMOUS_EVENT_RESOLUTION_INVALID', `${event.id} has invalid resolution time.`));
  }

  const fixedWorldEventIds = new Set<string>();
  for (const event of state.world.eventHistory) {
    if (isFixedWorldRecord(event)) {
      if (fixedWorldEventIds.has(event.id)) errors.push(violation('WORLD_EVENT_DUPLICATE_ID', `World event id ${event.id} is duplicated.`));
      fixedWorldEventIds.add(event.id);
      if (!state.locations[event.locationId]) errors.push(violation('WORLD_EVENT_LOCATION_MISSING', `${event.id} points to missing location ${event.locationId}.`));
      if (!Number.isFinite(event.atSeconds) || event.atSeconds < 0 || event.atSeconds > state.engine.elapsedSeconds) errors.push(violation('WORLD_EVENT_TIME_INVALID', `${event.id} has invalid atSeconds.`));
      continue;
    }
    if (!Number.isFinite(event.worldElapsedSeconds) || event.worldElapsedSeconds < 0 || event.worldElapsedSeconds > state.engine.elapsedSeconds) errors.push(violation('PROCEDURAL_EVENT_HISTORY_TIME_INVALID', `Procedural event history has invalid time ${event.worldElapsedSeconds}.`));
    if (event.type === 'started' && event.event.id !== event.eventId) errors.push(violation('PROCEDURAL_EVENT_HISTORY_ID_MISMATCH', `Started event ${event.eventId} contains mismatched event data.`));
  }

  for (const locationId of Object.keys(state.world.windowsOpen)) if (!state.locations[locationId]) errors.push(violation('WINDOW_LOCATION_MISSING', `Window state points to missing location ${locationId}.`));

  const inventorySeen = new Set<string>();
  for (const itemId of state.player.inventoryIds) {
    if (inventorySeen.has(itemId)) errors.push(violation('INVENTORY_DUPLICATE', `${itemId} appears more than once in inventory.`));
    inventorySeen.add(itemId);
    const item = state.items[itemId];
    if (!item) errors.push(violation('INVENTORY_ITEM_MISSING', `Inventory references missing item ${itemId}.`));
    else if (item.location.kind !== 'inventory') errors.push(violation('INVENTORY_LOCATION_MISMATCH', `${itemId} is listed in inventory but its location is ${item.location.kind}.`));
  }

  const containerMembership = new Map<string, string>();
  for (const container of Object.values(state.containers)) {
    if (!getContainerDefinition(container.definitionId)) errors.push(violation('CONTAINER_DEFINITION_MISSING', `${container.id} uses unknown definition ${container.definitionId}.`));
    if (!state.locations[container.locationId]) errors.push(violation('CONTAINER_LOCATION_MISSING', `${container.id} points to missing location ${container.locationId}.`));
    const seen = new Set<string>();
    for (const itemId of container.contentIds) {
      if (seen.has(itemId)) errors.push(violation('CONTAINER_DUPLICATE_ITEM', `${itemId} appears twice in ${container.id}.`));
      seen.add(itemId);
      const previous = containerMembership.get(itemId);
      if (previous && previous !== container.id) errors.push(violation('ITEM_IN_MULTIPLE_CONTAINERS', `${itemId} appears in ${previous} and ${container.id}.`));
      containerMembership.set(itemId, container.id);
      const item = state.items[itemId];
      if (!item) errors.push(violation('CONTAINER_ITEM_MISSING', `${container.id} references missing item ${itemId}.`));
      else if (item.location.kind !== 'container' || item.location.id !== container.id) errors.push(violation('CONTAINER_LOCATION_MISMATCH', `${itemId} is listed in ${container.id} but its item location disagrees.`));
    }
  }

  for (const item of Object.values(state.items)) {
    const definition = getItemDefinition(item.definitionId);
    const battery = definition?.battery;
    const perishable = definition?.perishable;
    if (battery && !isPercent(item.batteryPercent ?? battery.initialChargePct)) errors.push(violation('BATTERY_INVALID', `${item.id} has invalid battery charge.`));
    if (perishable && item.freshnessPercent === undefined) errors.push(violation('FRESHNESS_MISSING', `${item.id} is perishable but has no persistent freshness.`));
    if (item.freshnessPercent !== undefined && !isPercent(item.freshnessPercent)) errors.push(violation('FRESHNESS_INVALID', `${item.id} has invalid freshness ${item.freshnessPercent}.`));
    switch (item.location.kind) {
      case 'inventory':
        if (!inventorySeen.has(item.id)) errors.push(violation('ITEM_INVENTORY_MISMATCH', `${item.id} says inventory but is absent from inventoryIds.`));
        if (containerMembership.has(item.id)) errors.push(violation('ITEM_MULTIPLE_LOCATIONS', `${item.id} is both inventory and in a container.`));
        break;
      case 'location':
        if (!state.locations[item.location.id]) errors.push(violation('ITEM_LOCATION_MISSING', `${item.id} points to missing location ${item.location.id}.`));
        if (inventorySeen.has(item.id) || containerMembership.has(item.id)) errors.push(violation('ITEM_MULTIPLE_LOCATIONS', `${item.id} has conflicting location references.`));
        break;
      case 'container': {
        const container = state.containers[item.location.id];
        if (!container) errors.push(violation('ITEM_CONTAINER_MISSING', `${item.id} points to missing container ${item.location.id}.`));
        else if (!container.contentIds.includes(item.id)) errors.push(violation('ITEM_CONTAINER_MISMATCH', `${item.id} points to ${container.id} but is absent from contentIds.`));
        if (inventorySeen.has(item.id)) errors.push(violation('ITEM_MULTIPLE_LOCATIONS', `${item.id} is both in inventory and a container.`));
        break;
      }
      case 'consumed':
        if (inventorySeen.has(item.id) || containerMembership.has(item.id)) errors.push(violation('CONSUMED_ITEM_REFERENCED', `${item.id} is consumed but still referenced as accessible.`));
        break;
    }
  }
  return errors;
}

export function assertValidState(state: GameState): void {
  const errors = validateState(state);
  if (errors.length === 0) return;
  const summary = errors.map((error) => `${error.code}: ${error.message}`).join('\n');
  throw new Error(`Invalid ABSENCE game state:\n${summary}`);
}
