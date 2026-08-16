import type { GameState, LocationId, LocationState } from './model';
import { getWeatherState, type WeatherCondition } from './weather';

export type LocationEnvironmentType = 'indoor' | 'outdoor';

export interface LocationEnvironmentState {
  type: LocationEnvironmentType;
  temperatureC?: number;
  indoorTemperatureOffsetC?: number;
}

export interface PlayerEnvironmentState {
  locationId: LocationId | null;
  temperatureC: number;
  humidityPct: number;
  condition: WeatherCondition;
  windKph: number;
}

type LocationWithEnvironment = LocationState & { environment?: LocationEnvironmentState };

const INITIAL_ENVIRONMENTS: Readonly<Record<string, LocationEnvironmentState>> = Object.freeze({
  bedroom: Object.freeze({ type: 'indoor' as const, indoorTemperatureOffsetC: -2 }),
  kitchen: Object.freeze({ type: 'indoor' as const, indoorTemperatureOffsetC: -2 }),
  garden: Object.freeze({ type: 'outdoor' as const }),
});

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function finite(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizedEnvironment(value: unknown, fallback: LocationEnvironmentState): LocationEnvironmentState {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<LocationEnvironmentState> : {};
  const type: LocationEnvironmentType = raw.type === 'outdoor' ? 'outdoor' : raw.type === 'indoor' ? 'indoor' : fallback.type;
  const temperatureC = finite(raw.temperatureC);
  const indoorTemperatureOffsetC = finite(raw.indoorTemperatureOffsetC ?? fallback.indoorTemperatureOffsetC);
  return {
    type,
    ...(temperatureC !== undefined ? { temperatureC: round(temperatureC) } : {}),
    ...(type === 'indoor' && indoorTemperatureOffsetC !== undefined ? { indoorTemperatureOffsetC: round(indoorTemperatureOffsetC) } : {}),
  };
}

function defaultEnvironment(locationId: LocationId): LocationEnvironmentState {
  return structuredClone(INITIAL_ENVIRONMENTS[locationId] ?? { type: 'indoor', indoorTemperatureOffsetC: -2 });
}

export function ensureLocationEnvironmentState(state: GameState): void {
  for (const location of Object.values(state.locations) as LocationWithEnvironment[]) {
    location.environment = normalizedEnvironment(location.environment, defaultEnvironment(location.id));
  }
}

export function getLocationEnvironment(state: GameState, locationId: LocationId): LocationEnvironmentState {
  ensureLocationEnvironmentState(state);
  const location = state.locations[locationId] as LocationWithEnvironment | undefined;
  return structuredClone(location?.environment ?? defaultEnvironment(locationId));
}

export function setLocationEnvironment(state: GameState, locationId: LocationId, patch: Partial<LocationEnvironmentState>): LocationEnvironmentState {
  const location = state.locations[locationId] as LocationWithEnvironment | undefined;
  if (!location) throw new Error(`Unknown location ${locationId}`);
  const current = getLocationEnvironment(state, locationId);
  location.environment = normalizedEnvironment({ ...current, ...structuredClone(patch) }, current);
  return structuredClone(location.environment);
}

/** Exact v0.1.8 rule: fixed local temperature wins; outdoor follows weather; indoor defaults to outdoor -2C. */
export function getLocationTemperatureC(state: GameState, locationId: LocationId = state.player.locationId): number {
  const weather = getWeatherState(state);
  const environment = getLocationEnvironment(state, locationId);
  if (environment.temperatureC !== undefined) return round(environment.temperatureC);
  if (environment.type === 'outdoor') return round(weather.temperatureC);
  return round(weather.temperatureC + (environment.indoorTemperatureOffsetC ?? -2));
}

/** Exact v0.1.8 player environment: local temperature, global weather humidity/condition/wind. */
export function getPlayerEnvironment(state: GameState): PlayerEnvironmentState {
  const weather = getWeatherState(state);
  return {
    locationId: state.locations[state.player.locationId] ? state.player.locationId : null,
    temperatureC: getLocationTemperatureC(state, state.player.locationId),
    humidityPct: weather.humidityPct,
    condition: weather.condition,
    windKph: weather.windKph,
  };
}
