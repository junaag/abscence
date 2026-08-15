import type { ActionId, EngineTransition, GameAction, GameState } from '../model';
import { openContainer } from './containers';
import { chargeItem, drinkItem, eatItem, examineItem, fillLiquidContainer, takeItem, useItem } from './items';
import { move, openConnection } from './movement';
import { drinkTap, shoutForWife, wait } from './world';

function assertNever(value: never): never {
  throw new Error(`Unhandled ABSENCE action: ${String(value)}`);
}

export function performAction(state: GameState, action: GameAction): EngineTransition {
  const id: ActionId = action.id;
  switch (id) {
    case 'MOVE': return move(state, action.targetId);
    case 'OPEN_CONNECTION': return openConnection(state, action.targetId);
    case 'OPEN_CONTAINER': return openContainer(state, action.targetId);
    case 'TAKE_ITEM': return takeItem(state, action.targetId);
    case 'EAT_ITEM': return eatItem(state, action.targetId);
    case 'DRINK_ITEM': return drinkItem(state, action.targetId, action.amountMl);
    case 'DRINK_TAP': return drinkTap(state);
    case 'FILL_LIQUID_CONTAINER': return fillLiquidContainer(state, action.targetId);
    case 'USE_ITEM': return useItem(state, action.targetId);
    case 'CHARGE_ITEM': return chargeItem(state, action.targetId, action.sourceId, action.seconds);
    case 'EXAMINE_ITEM': return examineItem(state, action.targetId);
    case 'SHOUT_FOR_WIFE': return shoutForWife(state);
    case 'WAIT': return wait(state, action.seconds);
    default: return assertNever(id);
  }
}
