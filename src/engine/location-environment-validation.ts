import type { GameState, LocationState } from './model';
import type { LocationEnvironmentState } from './location-environment';

export interface LocationEnvironmentViolation {
  code: string;
  message: string;
}

type LocationWithEnvironment = LocationState & { environment?: LocationEnvironmentState };

function violation(code: string, message: string): LocationEnvironmentViolation {
  return { code, message };
}

export function validateLocationEnvironmentState(state: GameState): LocationEnvironmentViolation[] {
  const errors: LocationEnvironmentViolation[] = [];
  for (const location of Object.values(state.locations) as LocationWithEnvironment[]) {
    const environment = location.environment;
    if (!environment) continue;
    if (environment.type !== 'indoor' && environment.type !== 'outdoor') {
      errors.push(violation('LOCATION_ENVIRONMENT_TYPE_INVALID', `${location.id} has invalid environment type.`));
    }
    if (environment.temperatureC !== undefined && !Number.isFinite(environment.temperatureC)) {
      errors.push(violation('LOCATION_ENVIRONMENT_TEMPERATURE_INVALID', `${location.id} has invalid fixed temperature.`));
    }
    if (environment.indoorTemperatureOffsetC !== undefined && !Number.isFinite(environment.indoorTemperatureOffsetC)) {
      errors.push(violation('LOCATION_ENVIRONMENT_OFFSET_INVALID', `${location.id} has invalid indoor temperature offset.`));
    }
    if (environment.type === 'outdoor' && environment.indoorTemperatureOffsetC !== undefined) {
      errors.push(violation('LOCATION_ENVIRONMENT_OUTDOOR_OFFSET_INVALID', `${location.id} is outdoor but has an indoor temperature offset.`));
    }
  }
  return errors;
}

export function assertValidLocationEnvironmentState(state: GameState): void {
  const errors = validateLocationEnvironmentState(state);
  if (errors.length === 0) return;
  throw new Error(`Invalid ABSENCE location environment state:\n${errors.map((error) => `${error.code}: ${error.message}`).join('\n')}`);
}
