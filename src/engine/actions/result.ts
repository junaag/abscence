import type { EngineTransition, GameState } from '../model';

export function success(state: GameState, title: string, body: string, elapsedSeconds: number): EngineTransition {
  return { state, result: { success: true, title, body, elapsedSeconds } };
}

export function failure(state: GameState, title: string, body: string): EngineTransition {
  return { state, result: { success: false, title, body, elapsedSeconds: 0 } };
}
