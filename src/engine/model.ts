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
  /** Fractional PV accumulated by critical needs, carried between time advances. */
  damageBudgetPv: number;
}

export interface LocationFeatures {
  tap?: boolean;
  powerOutlet?: boolean;
}

export interface LocationState {
  id: LocationId;
  name: string;
  features: LocationFeatures;
}

/**
 * Canonical world-graph edge. Mirrors the v0.1.8 connection contract:
 * a connection can be open/closed and locked/unlocked, with separate opening
 * and traversal durations.
 */
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
  condition?: string;
}

export interface InfrastructureState {
  water: {
    available: boolean;
    pressure: number;
  };
  electricity: {
    available: boolean;
  };
  mobile: {
    available: boolean;
    signal: number;
  };
}

export interface MemoryState {
  shoutedForWife: boolean;
  visitedLocationIds: LocationId[];
}

export interface GameState {
  schemaVersion: 1;
  gameVersion: '0.2.0-dev';
  clock: WorldClock;
  engine: EngineSimulationState;
  player: PlayerState;
  locations: Record<LocationId, LocationState>;
  connections: Record<ConnectionId, ConnectionState>;
  containers: Record<ContainerId, ContainerState>;
  items: Record<ItemId, ItemState>;
  infrastructure: InfrastructureState;
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
  | 'EXAMINE_ITEM'
  | 'SHOUT_FOR_WIFE'
  | 'WAIT';

export interface GameAction {
  id: ActionId;
  targetId?: string;
  amountMl?: number;
  seconds?: number;
}

export interface ActionOption {
  id: ActionId;
  label: string;
  detail?: string;
  targetId?: string;
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
