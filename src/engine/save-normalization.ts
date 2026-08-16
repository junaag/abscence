import { GAME_VERSION, SAVE_SCHEMA_VERSION } from '../version';
import { ensureAutonomousInfrastructureTransitions } from './infrastructure';
import { validateState } from './invariants';
import { ensureLocationEnvironmentState } from './location-environment';
import { validateLocationEnvironmentState } from './location-environment-validation';
import type { GameState } from './model';
import { ensurePhoneState } from './phone';
import { validatePhoneState } from './phone-validation';
import { ensureWeatherState } from './weather';
import { ensureWorldEventSimulationState } from './world-events';

function hasCurrentSaveShape(value: unknown): value is GameState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Partial<GameState>;
  return state.schemaVersion === SAVE_SCHEMA_VERSION
    && typeof state.gameVersion === 'string'
    && Boolean(state.player)
    && Boolean(state.locations)
    && Boolean(state.connections)
    && Boolean(state.containers)
    && Boolean(state.items);
}

/**
 * Single compatibility boundary for persisted v0.2 saves.
 *
 * Future schema migrations must be added here before SAVE_SCHEMA_VERSION is
 * increased. Runtime subsystems should never contain ad-hoc save migrations.
 */
export function normalizePersistedGameState(value: unknown): GameState | null {
  if (!hasCurrentSaveShape(value)) return null;

  const state = structuredClone(value);

  // Missing location environment metadata is a supported older v0.2-dev shape,
  // but metadata that is already present and invalid is corruption. Validate
  // before normalization so defaults cannot silently hide an invalid value.
  if (validateLocationEnvironmentState(state).length > 0) return null;

  ensureAutonomousInfrastructureTransitions(state);
  ensureWorldEventSimulationState(state);
  ensureWeatherState(state);
  ensureLocationEnvironmentState(state);
  ensurePhoneState(state);

  if (validateState(state).length > 0
    || validateLocationEnvironmentState(state).length > 0
    || validatePhoneState(state).length > 0) return null;

  state.schemaVersion = SAVE_SCHEMA_VERSION;
  state.gameVersion = GAME_VERSION;
  return state;
}
