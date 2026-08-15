import { getWorldEventDefinition } from '../content/world-events';
import { getMobileNetworkState } from './infrastructure';
import type {
  GameState,
  ProceduralWorldEventTransition,
  SensoryProfile,
  WorldEventDefinitionId,
  WorldEventSourceCondition,
  WorldEventSourceState,
  WorldEventState,
  WorldPosition,
} from './model';

export const WORLD_EVENT_SEED = 1801;

function clamp(value: number, min = 0, max = 100): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function hashString32(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function deterministicWorldEventUnit(seed: number, key: string): number {
  let value = (hashString32(`${seed}:${key}`) || 1) >>> 0;
  value ^= value << 13; value >>>= 0;
  value ^= value >>> 17; value >>>= 0;
  value ^= value << 5; value >>>= 0;
  return (value >>> 0) / 4294967296;
}

function normalizePosition(position: WorldPosition | null | undefined): WorldPosition | null {
  if (!position || typeof position !== 'object') return null;
  if ('x' in position && 'y' in position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
    return { x: Number(position.x), y: Number(position.y) };
  }
  if ('lat' in position && 'lon' in position && Number.isFinite(position.lat) && Number.isFinite(position.lon)) {
    return { lat: Number(position.lat), lon: Number(position.lon) };
  }
  return null;
}

export function createWorldEventSource(
  id: string,
  definitionId: WorldEventDefinitionId,
  overrides: Partial<WorldEventSourceState> = {},
): WorldEventSourceState {
  const definition = getWorldEventDefinition(definitionId);
  const source: WorldEventSourceState = {
    id,
    definitionId,
    locationId: null,
    position: null,
    enabled: true,
    autonomous: true,
    probability: definition.defaultProbability,
    minDelaySeconds: definition.defaultMinDelaySeconds,
    maxDelaySeconds: definition.defaultMaxDelaySeconds,
    cooldownMinSeconds: definition.defaultMinDelaySeconds,
    cooldownMaxSeconds: definition.defaultMaxDelaySeconds,
    durationSeconds: definition.defaultDurationSeconds,
    maxOccurrences: 1,
    maxAttempts: 1,
    attemptIndex: 0,
    occurrenceCount: 0,
    scheduleBaseAtSeconds: null,
    nextTriggerAtSeconds: null,
    conditions: null,
    sensory: null,
    metadata: {},
    ...structuredClone(overrides),
    id,
    definitionId,
  };

  source.position = normalizePosition(source.position);
  source.probability = clamp(source.probability, 0, 1);
  source.minDelaySeconds = Math.max(0, Number(source.minDelaySeconds) || 0);
  source.maxDelaySeconds = Math.max(source.minDelaySeconds, Number(source.maxDelaySeconds) || source.minDelaySeconds);
  source.cooldownMinSeconds = Math.max(0, Number(source.cooldownMinSeconds) || 0);
  source.cooldownMaxSeconds = Math.max(source.cooldownMinSeconds, Number(source.cooldownMaxSeconds) || source.cooldownMinSeconds);
  source.durationSeconds = Math.max(0, Number(source.durationSeconds) || 0);
  source.maxOccurrences = Math.max(1, Math.floor(Number(source.maxOccurrences) || 1));
  source.maxAttempts = Math.max(source.maxOccurrences, Math.floor(Number(source.maxAttempts) || source.maxOccurrences));
  source.attemptIndex = Math.max(0, Math.floor(Number(source.attemptIndex) || 0));
  source.occurrenceCount = Math.max(0, Math.floor(Number(source.occurrenceCount) || 0));
  source.scheduleBaseAtSeconds = Number.isFinite(source.scheduleBaseAtSeconds) ? Number(source.scheduleBaseAtSeconds) : null;
  source.nextTriggerAtSeconds = Number.isFinite(source.nextTriggerAtSeconds) ? Number(source.nextTriggerAtSeconds) : null;
  source.conditions = Array.isArray(source.conditions) ? structuredClone(source.conditions) : null;
  source.sensory = source.sensory && typeof source.sensory === 'object' ? structuredClone(source.sensory) : null;
  source.metadata = source.metadata && typeof source.metadata === 'object' ? structuredClone(source.metadata) : {};
  return source;
}

function infrastructureLevelPercent(state: GameState, systemType: 'water' | 'electricity' | 'mobile'): number {
  if (systemType === 'electricity') return state.infrastructure.electricity.available ? clamp(state.infrastructure.electricity.voltagePercent) : 0;
  if (systemType === 'water') return state.infrastructure.water.available ? clamp(state.infrastructure.water.pressure * 100) : 0;
  return getMobileNetworkState(state).signalPercent;
}

function infrastructureStatus(state: GameState, systemType: 'water' | 'electricity' | 'mobile'): 'on' | 'unstable' | 'off' {
  const level = infrastructureLevelPercent(state, systemType);
  if (level <= 0) return 'off';
  return level >= 99.999 ? 'on' : 'unstable';
}

function conditionMet(state: GameState, condition: WorldEventSourceCondition, source: WorldEventSourceState): boolean {
  if (condition.type === 'infrastructure_available') {
    const level = infrastructureLevelPercent(state, condition.systemType);
    return level > 0 && level >= Math.max(0, Number(condition.minimumLevelPct) || 0);
  }
  if (condition.type === 'infrastructure_status') {
    const status = infrastructureStatus(state, condition.systemType);
    const statuses = Array.isArray(condition.statuses) ? condition.statuses : condition.status ? [condition.status] : [];
    return statuses.includes(status);
  }
  if (condition.type === 'location_exists') {
    const locationId = condition.locationId ?? source.locationId;
    return Boolean(locationId && state.locations[locationId]);
  }
  return true;
}

function conditionsMet(state: GameState, source: WorldEventSourceState): boolean {
  const definition = getWorldEventDefinition(source.definitionId);
  const conditions = source.conditions ?? [...definition.conditions];
  return conditions.every((condition) => conditionMet(state, condition, source));
}

export function ensureWorldEventSimulationState(state: GameState): void {
  if (!Number.isFinite(state.engine.worldEventSeed)) state.engine.worldEventSeed = WORLD_EVENT_SEED;
  if (typeof state.engine.worldEventSimulationEnabled !== 'boolean') state.engine.worldEventSimulationEnabled = true;
  if (!state.world.eventSources || typeof state.world.eventSources !== 'object') state.world.eventSources = {};
  if (!Array.isArray(state.world.events)) state.world.events = [];
  for (const source of Object.values(state.world.eventSources)) synchronizeWorldEventSourceSchedule(state, source.id, false);
}

export function synchronizeWorldEventSourceSchedule(state: GameState, sourceId: string, reset = false): WorldEventSourceState | null {
  ensureWorldEventCollections(state);
  const source = state.world.eventSources?.[sourceId];
  if (!source) return null;
  const elapsed = Math.max(0, Number(state.engine.elapsedSeconds) || 0);
  if (reset || !Number.isFinite(source.scheduleBaseAtSeconds)) source.scheduleBaseAtSeconds = elapsed;
  source.attemptIndex = Math.max(0, Math.floor(Number(source.attemptIndex) || 0));
  source.occurrenceCount = Math.max(0, Math.floor(Number(source.occurrenceCount) || 0));
  source.maxOccurrences = Math.max(1, Math.floor(Number(source.maxOccurrences) || 1));
  source.maxAttempts = Math.max(source.maxOccurrences, Math.floor(Number(source.maxAttempts) || source.maxOccurrences));
  if (reset) source.nextTriggerAtSeconds = null;

  if (!source.enabled || !source.autonomous || source.occurrenceCount >= source.maxOccurrences || source.attemptIndex >= source.maxAttempts) {
    source.nextTriggerAtSeconds = null;
    return source;
  }

  if (!Number.isFinite(source.nextTriggerAtSeconds)) {
    const firstAttempt = source.attemptIndex === 0;
    const minDelay = firstAttempt ? source.minDelaySeconds : source.cooldownMinSeconds;
    const maxDelay = firstAttempt ? source.maxDelaySeconds : source.cooldownMaxSeconds;
    const seed = Math.floor(state.engine.worldEventSeed ?? WORLD_EVENT_SEED);
    const unit = deterministicWorldEventUnit(seed, `world-event:${source.id}:time:${source.attemptIndex}`);
    source.nextTriggerAtSeconds = Math.round((source.scheduleBaseAtSeconds ?? elapsed) + minDelay + unit * Math.max(0, maxDelay - minDelay));
  }
  return source;
}

function ensureWorldEventCollections(state: GameState): void {
  if (!state.world.eventSources || typeof state.world.eventSources !== 'object') state.world.eventSources = {};
  if (!Array.isArray(state.world.events)) state.world.events = [];
}

export function addWorldEventSource(state: GameState, source: WorldEventSourceState): WorldEventSourceState {
  ensureWorldEventSimulationState(state);
  const normalized = createWorldEventSource(source.id, source.definitionId, source);
  state.world.eventSources![normalized.id] = normalized;
  synchronizeWorldEventSourceSchedule(state, normalized.id, true);
  return normalized;
}

export function setWorldEventSeed(state: GameState, seed: number | string, reschedule = true): number {
  ensureWorldEventSimulationState(state);
  const parsed = Number(seed);
  state.engine.worldEventSeed = Number.isFinite(parsed) ? Math.floor(parsed) : hashString32(String(seed));
  if (reschedule) {
    for (const source of Object.values(state.world.eventSources ?? {})) {
      source.attemptIndex = 0;
      source.occurrenceCount = 0;
      source.scheduleBaseAtSeconds = state.engine.elapsedSeconds;
      source.nextTriggerAtSeconds = null;
      synchronizeWorldEventSourceSchedule(state, source.id, false);
    }
  }
  return state.engine.worldEventSeed;
}

export interface WorldEventBoundary {
  kind: 'source' | 'event_end';
  atSeconds: number;
  sourceId?: string;
  eventId?: string;
}

export function getNextWorldEventBoundary(state: GameState): WorldEventBoundary | null {
  ensureWorldEventSimulationState(state);
  if (!state.engine.worldEventSimulationEnabled) return null;
  let next: WorldEventBoundary | null = null;

  for (const source of Object.values(state.world.eventSources ?? {})) {
    const atSeconds = source.nextTriggerAtSeconds;
    if (!source.enabled || !Number.isFinite(atSeconds)) continue;
    if (!next || Number(atSeconds) < next.atSeconds) next = { kind: 'source', sourceId: source.id, atSeconds: Number(atSeconds) };
  }
  for (const event of state.world.events ?? []) {
    if (event.status !== 'active' || !Number.isFinite(event.endsAtSeconds)) continue;
    if (!next || Number(event.endsAtSeconds) < next.atSeconds) next = { kind: 'event_end', eventId: event.id, atSeconds: Number(event.endsAtSeconds) };
  }
  return next;
}

export function secondsUntilNextWorldEventBoundary(state: GameState, maximumSeconds = Number.POSITIVE_INFINITY): number {
  const maximum = Number.isFinite(maximumSeconds) ? Math.max(0, maximumSeconds) : Number.POSITIVE_INFINITY;
  const next = getNextWorldEventBoundary(state);
  if (!next) return maximum;
  const delta = next.atSeconds - state.engine.elapsedSeconds;
  return delta <= 0 ? 0 : Math.min(maximum, delta);
}

function scheduleNextAttempt(state: GameState, source: WorldEventSourceState, attemptedAtSeconds: number): void {
  source.scheduleBaseAtSeconds = attemptedAtSeconds;
  source.nextTriggerAtSeconds = null;
  synchronizeWorldEventSourceSchedule(state, source.id, false);
}

function mergedSensory(definition: SensoryProfile, override: Partial<SensoryProfile> | null): SensoryProfile {
  return {
    audibleRangeM: override?.audibleRangeM ?? definition.audibleRangeM,
    visibleRangeM: override?.visibleRangeM ?? definition.visibleRangeM,
    smellRangeM: override?.smellRangeM ?? definition.smellRangeM,
  };
}

function startWorldEventFromSource(state: GameState, source: WorldEventSourceState, triggerAtSeconds: number): ProceduralWorldEventTransition {
  const definition = getWorldEventDefinition(source.definitionId);
  const attemptIndex = source.attemptIndex;
  const seed = Math.floor(state.engine.worldEventSeed ?? WORLD_EVENT_SEED);
  const probabilityRoll = deterministicWorldEventUnit(seed, `world-event:${source.id}:roll:${attemptIndex}`);
  source.attemptIndex += 1;
  const worldConditionsMet = conditionsMet(state, source);
  const succeeds = worldConditionsMet && probabilityRoll < source.probability;

  if (!succeeds) {
    const skipped: ProceduralWorldEventTransition = {
      type: 'skipped',
      sourceId: source.id,
      definitionId: source.definitionId,
      worldElapsedSeconds: triggerAtSeconds,
      reason: worldConditionsMet ? 'PROBABILITY' : 'CONDITIONS',
      probabilityRoll: round(probabilityRoll, 6),
    };
    state.world.eventHistory.push(skipped);
    scheduleNextAttempt(state, source, triggerAtSeconds);
    return skipped;
  }

  source.occurrenceCount += 1;
  const occurrence = source.occurrenceCount;
  const durationSeconds = Math.max(0, Number(source.durationSeconds ?? definition.defaultDurationSeconds) || 0);
  const event: WorldEventState = {
    id: `${source.id}_${String(occurrence).padStart(2, '0')}`,
    sourceId: source.id,
    definitionId: source.definitionId,
    category: definition.category,
    status: 'active',
    startedAtSeconds: triggerAtSeconds,
    endsAtSeconds: triggerAtSeconds + durationSeconds,
    sensory: mergedSensory(definition.sensory, source.sensory),
    narrativeEvent: definition.narrativeEvent,
    tags: [...definition.tags],
    metadata: structuredClone(source.metadata),
    discoveredByPlayer: false,
  };
  if (source.locationId) event.locationId = source.locationId;
  if (source.position) event.position = structuredClone(source.position);
  state.world.events!.push(event);

  const started: ProceduralWorldEventTransition = {
    type: 'started',
    eventId: event.id,
    event: structuredClone(event),
    worldElapsedSeconds: triggerAtSeconds,
  };
  state.world.eventHistory.push(started);
  scheduleNextAttempt(state, source, triggerAtSeconds);
  return started;
}

function resolveWorldEvent(state: GameState, event: WorldEventState, atSeconds: number): ProceduralWorldEventTransition {
  event.status = 'resolved';
  event.resolvedAtSeconds = atSeconds;
  const transition: ProceduralWorldEventTransition = {
    type: 'resolved',
    eventId: event.id,
    definitionId: event.definitionId,
    sourceId: event.sourceId ?? 'unknown',
    worldElapsedSeconds: atSeconds,
  };
  state.world.eventHistory.push(transition);
  return transition;
}

export function applyDueWorldEventTransitions(state: GameState): ProceduralWorldEventTransition[] {
  ensureWorldEventSimulationState(state);
  if (!state.engine.worldEventSimulationEnabled) return [];
  const now = Math.max(0, Number(state.engine.elapsedSeconds) || 0);
  const transitions: ProceduralWorldEventTransition[] = [];
  let guard = 0;
  let changed = true;

  while (changed && guard < 1000) {
    guard += 1;
    changed = false;
    for (const event of state.world.events ?? []) {
      if (event.status === 'active' && Number.isFinite(event.endsAtSeconds) && Number(event.endsAtSeconds) <= now + 1e-6) {
        transitions.push(resolveWorldEvent(state, event, Number(event.endsAtSeconds)));
        changed = true;
      }
    }
    for (const source of Object.values(state.world.eventSources ?? {})) {
      if (!Number.isFinite(source.nextTriggerAtSeconds) || Number(source.nextTriggerAtSeconds) > now + 1e-6) continue;
      const atSeconds = Number(source.nextTriggerAtSeconds);
      source.nextTriggerAtSeconds = null;
      transitions.push(startWorldEventFromSource(state, source, atSeconds));
      changed = true;
    }
  }

  if (state.world.eventHistory.length > 250) state.world.eventHistory.splice(0, state.world.eventHistory.length - 250);
  return transitions;
}
