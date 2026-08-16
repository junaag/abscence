import type { GameState } from './model';

export const WEATHER_CONDITIONS = ['clear', 'partly_cloudy', 'cloudy', 'rain', 'storm', 'fog'] as const;
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export interface WeatherState {
  condition: WeatherCondition;
  temperatureC: number;
  humidityPct: number;
  windKph: number;
  precipitationMmPerHour: number;
}

type WorldWithWeather = GameState['world'] & { weather?: WeatherState };

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizeWeatherCondition(value: unknown): WeatherCondition {
  return WEATHER_CONDITIONS.includes(value as WeatherCondition) ? value as WeatherCondition : 'clear';
}

/** Exact v0.1.8 weather defaults and normalization. */
export function createWeatherState(overrides: Partial<WeatherState> = {}): WeatherState {
  const condition = normalizeWeatherCondition(overrides.condition ?? 'clear');
  const rawTemperature = Number(overrides.temperatureC ?? 23);
  const rawHumidity = Number(overrides.humidityPct ?? 55);
  const rawWind = Number(overrides.windKph ?? 8);
  const rawPrecipitation = Number(overrides.precipitationMmPerHour ?? 0);
  return {
    condition,
    temperatureC: round(clamp(Number.isFinite(rawTemperature) ? rawTemperature : 0, -30, 55), 2),
    humidityPct: clamp(Number.isFinite(rawHumidity) ? rawHumidity : 55, 0, 100),
    windKph: Math.max(0, round(Number.isFinite(rawWind) ? rawWind : 0, 2)),
    precipitationMmPerHour: Math.max(0, round(Number.isFinite(rawPrecipitation) ? rawPrecipitation : 0, 3)),
  };
}

export function ensureWeatherState(state: GameState): WeatherState {
  const world = state.world as WorldWithWeather;
  world.weather = createWeatherState(world.weather ?? {});
  return world.weather;
}

export function getWeatherState(state: GameState): WeatherState {
  return ensureWeatherState(state);
}

export function setWeatherState(state: GameState, patch: Partial<WeatherState> = {}): WeatherState {
  const world = state.world as WorldWithWeather;
  world.weather = createWeatherState({ ...ensureWeatherState(state), ...structuredClone(patch) });
  return world.weather;
}
