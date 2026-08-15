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
  condition?: string;
  liquidMl?: number;
  capacityMl?: number;
  batteryPercent?: number;
  enabled?: boolean;
  freshnessPercent?: number;
}

export interface InfrastructureTransitionState {
  id: string;
  network: 'electricity' | 'water' | 'mobile';
  atSeconds: number;
  processed: boolean;
  phase?: 'on' | 'unstable' | 'off';
  available?: boolean;
  voltagePercent?: number;
  pressurePercent?: number;
  signalPercent?: number;
}

export interface InfrastructureState {
  electricity: {
    phase?: 'on' | 'unstable' | 'off';
    available: boolean;
    voltagePercent: number;
  };
  water: {
    phase?: 'on' | 'unstable' | 'off';
    available: boolean;
    pressurePercent: number;
  };
  mobile: {
    phase?: 'on' | 'unstable' | 'off';
    available: boolean;
    signalBars: number;
    signalPercent?: number;
  };
  transitions: InfrastructureTransitionState[];
}

export type PersistentEffectType = 'water_puddle' | 'smoke' | 'fire' | 'persistent_noise';

export interface PersistentEffect {
  id: string;
  type: PersistentEffectType;
  locationId: LocationId;
  intensity: number;
  active: boolean;
  spreading: boolean;
  createdAtSeconds: number;
  updatedAtSeconds: number;
  sourceLocationId?: LocationId;
}

export type WorldEventDefinitionId = 'water_leak' | 'alarm' | 'smoke_plume' | 'animal_activity' | 'isolated_noise';

export interface SensoryProfile {
  audibleRangeMeters?: number;
  visibleRangeMeters?: number;
  smellRangeMeters?: number;
}

export interface ProceduralWorldEventTransition {
  id: string;
  sourceId: string;
  atSeconds: number;
  kind: 'attempt' | 'resolve';
  processed: boolean;
}

export interface WorldEventSourceState {
  id: string;
  definitionId: WorldEventDefinitionId;
  locationId: LocationId;
  enabled: boolean;
  probability: number;
  minIntervalSeconds: number;
  maxIntervalSeconds: number;
  durationSeconds: number;
  maxOccurrences?: number;
  attempts: number;
  occurrences: number;
  nextAttemptAtSeconds?: number;
  conditions?: {
    requireElectricity?: boolean;
    requireWater?: boolean;
    requireMobile?: boolean;
  };
}

export interface WorldEventState {
  id: string;
  sourceId: string;
  definitionId: WorldEventDefinitionId;
  locationId: LocationId;
  startedAtSeconds: number;
  endsAtSeconds: number;
  active: boolean;
  discovered: boolean;
  resolvedAtSeconds?: number;
}

export interface WorldState {
  leakActive: boolean;
  windowOpenByLocation: Record<LocationId, boolean>;
  effects: PersistentEffect[];
  eventSources?: Record<string, WorldEventSourceState>;
  events?: WorldEventState[];
  eventTransitions?: ProceduralWorldEventTransition[];
  eventHistory?: Array<{
    eventId: string;
    sourceId: string;
    definitionId: WorldEventDefinitionId;
    locationId: LocationId;
    startedAtSeconds: number;
    resolvedAtSeconds?: number;
  }>;
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
