import type { EngineTransition, GameState } from '../model';
import { WATER_RULES } from '../rules';
import { hasRunningTap } from '../selectors';
import { cloneState, clampNeeds } from '../state';
import { advanceTime } from '../time';
import { failure, success } from './result';

export function drinkTap(state: GameState): EngineTransition {
  if (!hasRunningTap(state)) return failure(state, 'Pas d’eau', 'Aucune eau courante n’est disponible ici.');
  const next = cloneState(state);
  next.player.needs.thirst += WATER_RULES.thirstEffectPerServing;
  clampNeeds(next);
  advanceTime(next, WATER_RULES.tapDrinkSeconds);
  return success(next, 'Vous buvez au robinet.', 'L’eau coule encore normalement.', WATER_RULES.tapDrinkSeconds);
}

export function shoutForWife(state: GameState): EngineTransition {
  if (state.player.locationId !== 'bedroom') return failure(state, 'Impossible', 'Ce contexte ne correspond plus à cette action.');
  const next = cloneState(state);
  next.memory.shoutedForWife = true;
  advanceTime(next, 8);
  return success(next, 'Votre voix traverse la maison.', 'Aucune réponse. Le silence qui suit paraît encore plus anormal.', 8);
}

export function wait(state: GameState, seconds: number | undefined): EngineTransition {
  const elapsed = Math.max(1, Math.floor(seconds ?? 60));
  const next = cloneState(state);
  advanceTime(next, elapsed);
  return success(next, 'Vous attendez.', 'Le temps continue de passer.', elapsed);
}
