import type { SAVE_SCHEMA_VERSION } from '../version';

export type LocationId = string;
export type ConnectionId = string;
export type ContainerId = string;
export type ItemId = string;

export interface NeedsState {
  hunger: number;
  thirst: number;
  fatigue: number;
  stress: number;
  pain: number;
}

export interface PlayerState {
  locationId: LocationId;
  healthPv: number;
  needs: NeedsState;
  inventoryIds: ItemId[];
  alive: boolean;
}

export interface WorldClock {
  day: number;
  secondOfDay: number;
}

export interface EngineSimulationState {
  damageBudgetPv: number;
  elapsedSeconds: number;
  nextEffectId: number;
  infrastructureSeed?: number;
  infrastructureSimulationEnabled?: boolean;
  worldEventSeed?: number;
  worldEventSimulationEnabled?: boolean;
}

export interface LocationFeatures {
  tap?: boolean;
  powerOutlet?: boolean;
}

export type WorldPosition =
  | { x: number; y: number }
  | { lat: number; lon: number };

export interface LocationState {
  id: LocationId;
  name: string;
  ambientTemperatureC: number;
  ambientHumidityPercent: number;
  ventilation: number;
  features: LocationFeatures;
  position?: WorldPosition;
}

export interface ConnectionState {
  id: ConnectionId;
  a: LocationId;
  b: LocationId;
  type: 'door' | 'passage';
  open: boolean;
  locked: boolean;
  openSeconds: number;
  travelSeconds: number;
}

export interface ContainerState {
  id: ContainerId;
  definitionId: string;
  name: string;
  locationId: LocationId;
  open: boolean;
  locked: boolean;
  contentIds: ItemId[];
}

export type ItemLocation =
  | { kind: 'location'; id: LocationId }
  | { kind: 'container'; id: ContainerId }
  | { kind: 'inventory' }
  | { kind: 'consumed' };

export interface ItemState {
  id: ItemId;
  definitionId: string;
  name: string;
  location: ItemLocation;
  examined: boolean;
  liquidMl?: number;
  capacityMl?: number;
  batteryPercent?: number;
  freshnessPercent?: number;
  enabled?: boolean;
  condition?: string;
}

export type InfrastructureTransitionState =
  | { id: string; network: 'electricity'; atSeconds: number; processed: boolean; available: boolean; voltagePercent?: number }
  | { id: string; network: 'water'; atSeconds: number; processed: boolean; available: boolean; pressure?: number }
  | { id: string; network: 'mobile'; atSeconds: number; processed: boolean; available: boolean; signal?: number; signalPercent?: number };

export interface InfrastructureState {
  water: { available: boolean; pressure: number };
  electricity: { available: boolean; voltagePercent: number };
  mobile: { available: boolean; signal: number; signalPercent?: number };
  transitions?: InfrastructureTransitionState[];
}

export type PersistentEffectType = 'water_puddle' | 'smoke' | 'fire' | 'persistent_noise';

export interface PersistentEffect {
  id: string;
  type: PersistentEffectType;
  locationId: LocationId;
  intensity: number;
  active: boolean;
  source?: string;
  spreading: boolean;
  createdAtSeconds: number;
  updatedAtSeconds: number;
  resolvedAtSeconds?: number;
  resolutionReason?: string;
}

export type ScheduledWorldEventType = 'noise_source' | 'water_leak' | 'smoke';

export interface ScheduledWorldEvent {
  id: string;
  atSeconds: number;
  type: ScheduledWorldEventType;
  locationId: LocationId;
  processed: boolean;
}

export interface WorldEventRecord {
  id: string;
  type: 'WORLD_PERSISTENT_NOISE' | 'WORLD_WATER_LEAK' | 'WORLD_SMOKE';
  locationId: LocationId;
  atSeconds: number;
}

export type WorldEventDefinitionId = 'water_leak' | 'security_alarm' | 'smoke_plume' | 'animal_noise' | 'unattended_noise';
export type WorldEventCategory = 'hazard' | 'signal' | 'life' | 'ambient';

export interface SensoryProfile {
  audibleRangeM: number;
  visibleRangeM: number;
  smellRangeM: number;
}

export type WorldEventSourceCondition =
  | { type: 'infrastructure_available'; systemType: 'water' | 'electricity' | 'mobile'; zoneId?: string; minimumLevelPct?: number }
  | { type: 'infrastructure_status'; systemType: 'water' | 'electricity' | 'mobile'; zoneId?: string; status?: 'on' | 'unstable' | 'off'; statuses?: Array<'on' | 'unstable' | 'off'> }
  | { type: 'location_exists'; locationId?: LocationId };

export interface WorldEventSourceState {
  id: string;
  definitionId: WorldEventDefinitionId;
  locationId: LocationId | null;
  position: WorldPosition | null;
  enabled: boolean;
  autonomous: boolean;
  probability: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  cooldownMinSeconds: number;
  cooldownMaxSeconds: number;
  durationSeconds: number;
  maxOccurrences: number;
  maxAttempts: number;
  attemptIndex: number;
  occurrenceCount: number;
  scheduleBaseAtSeconds: number | null;
  nextTriggerAtSeconds: number | null;
  conditions: WorldEventSourceCondition[] | null;
  sensory: Partial<SensoryProfile> | null;
  metadata: Record<string, unknown>;
  infrastructureZoneId?: string;
}

export interface WorldEventState {
  id: string;
  definitionId: WorldEventDefinitionId;
  sourceId?: string;
  category?: WorldEventCategory;
  status: 'active' | 'resolved';
  locationId?: LocationId;
  position?: WorldPosition;
  sensory?: SensoryProfile;
  narrativeEvent: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  discoveredByPlayer: boolean;
  startedAtSeconds: number;
  endsAtSeconds?: number;
  resolvedAtSeconds?: number;
}

export type ProceduralWorldEventTransition =
  | { type: 'skipped'; sourceId: string; definitionId: WorldEventDefinitionId; worldElapsedSeconds: number; reason: 'PROBABILITY' | 'CONDITIONS'; probabilityRoll: number }
  | { type: 'started'; eventId: string; event: WorldEventState; worldElapsedSeconds: number }
  | { type: 'resolved'; eventId: string; definitionId: WorldEventDefinitionId; sourceId: string; worldElapsedSeconds: number };

export type WorldHistoryRecord = WorldEventRecord | ProceduralWorldEventTransition;

export interface WorldState {
  effects: PersistentEffect[];
  windowsOpen: Record<LocationId, boolean>;
  leakActive: boolean;
  scheduledEvents: ScheduledWorldEvent[];
  eventHistory: WorldHistoryRecord[];
  eventSources?: Record<string, WorldEventSourceState>;
  events?: WorldEventState[];
}

export interface PhoneCallRecord {
  id: string;
  contactName: string;
  displayTime: string;
  direction: 'incoming' | 'outgoing' | 'missed';
}

export interface PhoneMessageRecord {
  id: string;
  contactName: string;
  preview: string;
  displayTime: string;
  kind: 'text' | 'photo';
}

export interface PhoneState {
  deviceItemId: ItemId;
  calls: PhoneCallRecord[];
  messages: PhoneMessageRecord[];
}

export interface MemoryState {
  shoutedForWife: boolean;
  visitedLocationIds: LocationId[];
}

export interface GameState {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  gameVersion: string;
  clock: WorldClock;
  engine: EngineSimulationState;
  player: PlayerState;
  locations: Record<LocationId, LocationState>;
  connections: Record<ConnectionId, ConnectionState>;
  containers: Record<ContainerId, ContainerState>;
  items: Record<ItemId, ItemState>;
  infrastructure: InfrastructureState;
  world: WorldState;
  phone: PhoneState;
  memory: MemoryState;
}

export type ActionId =
  | 'MOVE'
  | 'TRAVEL_TO_MAP_POI'
  | 'OPEN_CONNECTION'
  | 'OPEN_CONTAINER'
  | 'TAKE_ITEM'
  | 'EAT_ITEM'
  | 'DRINK_ITEM'
  | 'DRINK_TAP'
  | 'FILL_LIQUID_CONTAINER'
  | 'USE_ITEM'
  | 'CHARGE_ITEM'
  | 'EXAMINE_ITEM'
  | 'CALL_CONTACT'
  | 'SEND_SMS_CONTACT'
  | 'MOP_EFFECT'
  | 'VENTILATE_EFFECT'
  | 'DOUSE_EFFECT'
  | 'SILENCE_EFFECT'
  | 'STOP_LEAK'
  | 'SHOUT_FOR_WIFE'
  | 'WAIT';

export interface GameAction {
  id: ActionId;
  targetId?: string;
  sourceId?: string;
  amountMl?: number;
  seconds?: number;
}

export interface ActionOption {
  id: ActionId;
  label: string;
  detail?: string;
  targetId?: string;
  sourceId?: string;
  amountMl?: number;
  seconds?: number;
}

export interface ActionResult {
  success: boolean;
  title: string;
  body: string;
  elapsedSeconds: number;
}

export interface EngineTransition {
  state: GameState;
  result: ActionResult;
}
