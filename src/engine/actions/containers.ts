import type { EngineTransition, GameState } from '../model';
import { containerContents } from '../selectors';
import { cloneState } from '../state';
import { advanceTime } from '../time';
import { failure, success } from './result';

export function openContainer(state: GameState, containerId: string | undefined): EngineTransition {
  if (!containerId) return failure(state, 'Impossible', 'Aucun contenant ciblé.');
  const container = state.containers[containerId];
  if (!container || container.locationId !== state.player.locationId) return failure(state, 'Impossible', 'Ce contenant n’est pas accessible ici.');
  if (container.locked) return failure(state, 'Verrouillé', 'Le contenant est verrouillé.');

  const next = cloneState(state);
  const nextContainer = next.containers[containerId];
  if (!nextContainer) return failure(state, 'Impossible', 'Le contenant a disparu.');

  if (container.open) {
    nextContainer.open = false;
    advanceTime(next, 1);
    return success(next, `Vous refermez ${container.name.toLowerCase()}.`, 'Le contenant est maintenant fermé.', 1);
  }

  nextContainer.open = true;
  advanceTime(next, 2);
  const count = containerContents(next, containerId).length;
  return success(next, `Vous ouvrez ${container.name.toLowerCase()}.`, count > 0 ? `Vous voyez ${count} objet${count > 1 ? 's' : ''} à l’intérieur.` : 'Il est vide.', 2);
}
