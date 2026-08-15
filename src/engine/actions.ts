export { getContainerActions, getContextActions, getItemActions } from './actions/availability';
export { performAction } from './actions/dispatcher';

import { inventoryItems } from './selectors';
import type { GameState } from './model';

export function inventoryHas(state: GameState, definitionId: string): boolean {
  return inventoryItems(state).some((item) => item.definitionId === definitionId);
}
