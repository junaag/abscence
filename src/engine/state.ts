import { INITIAL_STATE } from '../content/world';
import type { GameState } from './model';

export function createInitialState(): GameState {
  return structuredClone(INITIAL_STATE);
}

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

export function clampNeeds(state: GameState): void {
  const needs = state.player.needs;
  for (const key of Object.keys(needs) as Array<keyof typeof needs>) {
    needs[key] = Math.min(100, Math.max(0, needs[key]));
  }
  state.player.healthPv = Math.min(100, Math.max(0, state.player.healthPv));
  state.player.alive = state.player.healthPv > 0;
}
