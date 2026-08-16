import { getItemDefinition } from '../content/items';
import type { EngineTransition, GameState, ItemState } from './model';
import { cloneState } from './state';
import { advanceTime } from './time';
import { failure, success } from './actions/result';

interface LockTarget {
  kind: 'connection' | 'container';
  id: string;
  name: string;
  lockCode?: string;
  locked: boolean;
}

function targetAtPlayerLocation(state: GameState, targetId: string): LockTarget | null {
  const connection = state.connections[targetId];
  if (connection) {
    if (connection.a !== state.player.locationId && connection.b !== state.player.locationId) return null;
    const otherId = connection.a === state.player.locationId ? connection.b : connection.a;
    return {
      kind: 'connection',
      id: connection.id,
      name: state.locations[otherId]?.name ?? 'passage',
      lockCode: connection.lockCode,
      locked: connection.locked,
    };
  }

  const container = state.containers[targetId];
  if (!container || container.locationId !== state.player.locationId) return null;
  return {
    kind: 'container',
    id: container.id,
    name: container.name,
    lockCode: container.lockCode,
    locked: container.locked,
  };
}

export function compatibleKeyForLock(state: GameState, lockCode: string | undefined): ItemState | null {
  if (!lockCode) return null;
  for (const itemId of state.player.inventoryIds) {
    const item = state.items[itemId];
    if (!item || item.location.kind !== 'inventory' || item.keyCode !== lockCode) continue;
    if (getItemDefinition(item.definitionId)?.key) return item;
  }
  return null;
}

export function unlockTarget(state: GameState, targetId: string | undefined, keyItemId: string | undefined): EngineTransition {
  if (!targetId) return failure(state, 'Déverrouillage impossible', 'Aucune serrure ciblée.');
  const target = targetAtPlayerLocation(state, targetId);
  if (!target) return failure(state, 'Déverrouillage impossible', 'Cette serrure n’est pas accessible ici.');
  if (!target.locked) return failure(state, 'Déjà déverrouillé', 'Cette serrure est déjà déverrouillée.');
  if (!target.lockCode) return failure(state, 'Serrure inconnue', 'Cette serrure ne peut pas être ouverte avec une clé connue.');
  if (!keyItemId) return failure(state, 'Clé nécessaire', 'Aucune clé n’a été sélectionnée.');

  const key = state.items[keyItemId];
  const definition = key ? getItemDefinition(key.definitionId) : undefined;
  if (!key || key.location.kind !== 'inventory' || !state.player.inventoryIds.includes(key.id) || !definition?.key) {
    return failure(state, 'Clé nécessaire', 'Cette clé n’est pas disponible dans votre inventaire.');
  }
  if (key.keyCode !== target.lockCode) return failure(state, 'Mauvaise clé', 'La clé ne correspond pas à cette serrure.');

  const next = cloneState(state);
  const nextConnection = next.connections[targetId];
  const nextContainer = next.containers[targetId];
  if (nextConnection) nextConnection.locked = false;
  else if (nextContainer) nextContainer.locked = false;
  else return failure(state, 'Déverrouillage impossible', 'La cible a disparu.');

  advanceTime(next, definition.key.unlockSeconds);
  return success(
    next,
    'Serrure déverrouillée',
    `La clé fonctionne. ${target.kind === 'connection' ? 'Le passage' : target.name} est maintenant déverrouillé.`,
    definition.key.unlockSeconds,
  );
}
