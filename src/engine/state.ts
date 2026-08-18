import { INITIAL_STATE } from '../content/world';
import { ensureAutonomousInfrastructureTransitions } from './infrastructure';
import { ensureLocationEnvironmentState } from './location-environment';
import type { GameState, LocationId } from './model';
import { ensureWeatherState } from './weather';
import { ensureWorldEventSimulationState } from './world-events';

export function createInitialState(): GameState {
  const state = structuredClone(INITIAL_STATE);
  ensureAutonomousInfrastructureTransitions(state);
  ensureWorldEventSimulationState(state);
  ensureWeatherState(state);
  ensureLocationEnvironmentState(state);
  return state;
}

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

export function recordLocationVisit(state: GameState, locationId: LocationId): void {
  if (!state.memory.visitedLocationIds.includes(locationId)) state.memory.visitedLocationIds.push(locationId);
  const visits = state.memory.locationVisitCounts ?? {};
  visits[locationId] = (visits[locationId] ?? 0) + 1;
  state.memory.locationVisitCounts = visits;
}

export function clampNeeds(state: GameState): void {
  const needs = state.player.needs;
  for (const key of Object.keys(needs) as Array<keyof typeof needs>) {
    needs[key] = Math.min(100, Math.max(0, needs[key]));
  }
  state.player.healthPv = Math.min(100, Math.max(0, state.player.healthPv));
  state.player.alive = state.player.healthPv > 0;
}
