import type { EngineTransition, GameState } from '../model';
import { connectedDestinations } from '../selectors';
import { cloneState, recordLocationVisit } from '../state';
import { advanceTime } from '../time';
import { failure, success } from './result';

export function move(state: GameState, targetId: string | undefined): EngineTransition {
  if (!targetId || !state.locations[targetId]) return failure(state, 'Déplacement impossible', 'Cette destination n’existe pas.');
  const candidate = connectedDestinations(state).find(({ location }) => location.id === targetId);
  if (!candidate) return failure(state, 'Déplacement impossible', 'Aucun passage ne mène directement là-bas.');
  if (candidate.connection.locked) return failure(state, 'Passage verrouillé', 'Le passage est verrouillé.');
  if (!candidate.connection.open) return failure(state, 'Passage fermé', 'Il faut d’abord ouvrir le passage.');

  const next = cloneState(state);
  next.player.locationId = targetId;
  recordLocationVisit(next, targetId);
  advanceTime(next, candidate.connection.travelSeconds);
  return success(next, next.locations[targetId]?.name ?? 'Déplacement', 'Vous rejoignez le lieu.', candidate.connection.travelSeconds);
}

export function openConnection(state: GameState, connectionId: string | undefined): EngineTransition {
  if (!connectionId) return failure(state, 'Impossible', 'Aucun passage ciblé.');
  const connection = state.connections[connectionId];
  if (!connection) return failure(state, 'Impossible', 'Ce passage n’existe pas.');
  if (connection.a !== state.player.locationId && connection.b !== state.player.locationId) return failure(state, 'Impossible', 'Ce passage n’est pas à portée.');
  if (connection.open) return failure(state, 'Déjà ouvert', 'Le passage est déjà ouvert.');
  if (connection.locked) return failure(state, 'Verrouillé', 'Le passage est verrouillé.');

  const next = cloneState(state);
  const nextConnection = next.connections[connectionId];
  if (!nextConnection) return failure(state, 'Impossible', 'Ce passage a disparu.');
  nextConnection.open = true;
  advanceTime(next, connection.openSeconds);
  return success(next, 'Vous ouvrez le passage.', 'Le chemin est maintenant libre.', connection.openSeconds);
}
