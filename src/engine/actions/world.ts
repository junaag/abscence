import { activeEffectsAt, reducePersistentEffect } from '../effects';
import type { EngineTransition, GameState, PersistentEffect, PersistentEffectType } from '../model';
import { WATER_RULES } from '../rules';
import { hasRunningTap } from '../selectors';
import { cloneState, clampNeeds } from '../state';
import { advanceTime } from '../time';
import { failure, success } from './result';

function localEffect(state: GameState, effectId: string | undefined, type: PersistentEffectType): PersistentEffect | undefined {
  if (!effectId) return undefined;
  return activeEffectsAt(state, state.player.locationId).find((effect) => effect.id === effectId && effect.type === type);
}

function carriedItem(state: GameState, itemId: string | undefined, definitionId: string) {
  if (!itemId) return undefined;
  const item = state.items[itemId];
  return item?.location.kind === 'inventory' && item.definitionId === definitionId ? item : undefined;
}

export function drinkTap(state: GameState): EngineTransition {
  if (!hasRunningTap(state)) return failure(state, 'Pas d’eau', 'Aucune eau courante n’est disponible ici.');
  const next = cloneState(state);
  next.player.needs.thirst += WATER_RULES.thirstEffectPerServing;
  clampNeeds(next);
  advanceTime(next, WATER_RULES.tapDrinkSeconds);
  return success(next, 'Vous buvez au robinet.', 'L’eau coule encore normalement.', WATER_RULES.tapDrinkSeconds);
}

export function mopEffect(state: GameState, effectId: string | undefined, towelId: string | undefined): EngineTransition {
  if (!localEffect(state, effectId, 'water_puddle')) return failure(state, 'Impossible', 'Aucune eau au sol à éponger ici.');
  if (!carriedItem(state, towelId, 'towel')) return failure(state, 'Il faut un torchon', 'Vous devez avoir de quoi éponger dans votre inventaire.');
  const next = cloneState(state);
  const reduced = reducePersistentEffect(next, effectId ?? '', 38);
  if (!reduced) return failure(state, 'Impossible', 'La flaque n’est plus active.');
  advanceTime(next, 150);
  return success(next, 'Vous épongez le sol.', 'Vous retirez une grande partie de l’eau, mais une fuite active peut continuer à alimenter la flaque.', 150);
}

export function ventilateEffect(state: GameState, effectId: string | undefined): EngineTransition {
  if (!localEffect(state, effectId, 'smoke')) return failure(state, 'Impossible', 'Aucune fumée à ventiler ici.');
  const next = cloneState(state);
  next.world.windowsOpen[next.player.locationId] = true;
  const reduced = reducePersistentEffect(next, effectId ?? '', 18);
  if (!reduced) return failure(state, 'Impossible', 'La fumée n’est plus active.');
  advanceTime(next, 20);
  return success(next, 'Vous aérez la pièce.', 'L’air se renouvelle et la fumée se dissipe plus vite.', 20);
}

export function douseEffect(state: GameState, effectId: string | undefined, waterId: string | undefined): EngineTransition {
  if (!localEffect(state, effectId, 'fire')) return failure(state, 'Impossible', 'Aucun départ de feu à éteindre ici.');
  const water = carriedItem(state, waterId, 'water_bottle');
  if (!water || (water.liquidMl ?? 0) < 250) return failure(state, 'Pas assez d’eau', 'Il faut au moins 250 ml d’eau transportée pour tenter d’éteindre le feu.');
  const next = cloneState(state);
  const nextWater = next.items[water.id];
  if (!nextWater) return failure(state, 'Impossible', 'La bouteille n’est plus disponible.');
  nextWater.liquidMl = Math.max(0, (nextWater.liquidMl ?? 0) - 250);
  const reduced = reducePersistentEffect(next, effectId ?? '', 48);
  if (!reduced) return failure(state, 'Impossible', 'Le feu n’est plus actif.');
  advanceTime(next, 15);
  return success(next, 'Vous versez de l’eau sur le feu.', '250 ml sont utilisés. Les flammes reculent nettement.', 15);
}

export function silenceEffect(state: GameState, effectId: string | undefined): EngineTransition {
  if (!localEffect(state, effectId, 'persistent_noise')) return failure(state, 'Impossible', 'Aucune source de bruit continu à couper ici.');
  const next = cloneState(state);
  const reduced = reducePersistentEffect(next, effectId ?? '', 100);
  if (!reduced) return failure(state, 'Impossible', 'La source sonore n’est plus active.');
  advanceTime(next, 25);
  return success(next, 'Vous coupez la source du bruit.', 'Le bruit mécanique cesse enfin.', 25);
}

export function stopLeak(state: GameState): EngineTransition {
  if (state.player.locationId !== 'kitchen' || !state.world.leakActive) return failure(state, 'Impossible', 'Aucune fuite active ne peut être arrêtée ici.');
  const next = cloneState(state);
  next.world.leakActive = false;
  advanceTime(next, 18);
  return success(next, 'Vous arrêtez la fuite.', 'L’eau cesse d’alimenter la flaque. Celle déjà au sol reste à traiter.', 18);
}

export function shoutForWife(state: GameState): EngineTransition {
  if (state.player.locationId !== 'bedroom') return failure(state, 'Impossible', 'Ce contexte ne correspond plus à cette action.');
  const next = cloneState(state);
  next.memory.shoutedForWife = true;
  advanceTime(next, 8);
  return success(next, 'Vous appelez à haute voix.', 'Votre voix traverse la maison. Aucune réponse ne revient.', 8);
}

export function wait(state: GameState, seconds: number | undefined): EngineTransition {
  const elapsed = Math.max(1, Math.floor(seconds ?? 60));
  const next = cloneState(state);
  advanceTime(next, elapsed);
  return success(next, 'Vous attendez.', 'Le temps continue de passer.', elapsed);
}
