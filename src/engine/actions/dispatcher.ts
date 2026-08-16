import { assertValidState } from '../invariants';
import type { ActionId, EngineTransition, GameAction, GameState } from '../model';
import { openContainer } from './containers';
import { travelToMapPoi } from './exploration';
import { chargeItem, drinkItem, eatItem, examineItem, fillLiquidContainer, takeItem, useItem } from './items';
import { move, openConnection } from './movement';
import { callContact, sendSmsContact } from './phone';
import { douseEffect, drinkTap, mopEffect, shoutForWife, silenceEffect, stopLeak, ventilateEffect, wait } from './world';

function assertNever(value: never): never {
  throw new Error(`Unhandled ABSENCE action: ${String(value)}`);
}

function dispatch(state: GameState, action: GameAction): EngineTransition {
  const id: ActionId = action.id;
  switch (id) {
    case 'MOVE': return move(state, action.targetId);
    case 'TRAVEL_TO_MAP_POI': return travelToMapPoi(state, action.targetId);
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
    case 'CALL_CONTACT': return callContact(state, action.targetId);
    case 'SEND_SMS_CONTACT': return sendSmsContact(state, action.targetId);
    case 'MOP_EFFECT': return mopEffect(state, action.targetId, action.sourceId);
    case 'VENTILATE_EFFECT': return ventilateEffect(state, action.targetId);
    case 'DOUSE_EFFECT': return douseEffect(state, action.targetId, action.sourceId);
    case 'SILENCE_EFFECT': return silenceEffect(state, action.targetId);
    case 'STOP_LEAK': return stopLeak(state);
    case 'SHOUT_FOR_WIFE': return shoutForWife(state);
    case 'WAIT': return wait(state, action.seconds);
    default: return assertNever(id);
  }
}

export function performAction(state: GameState, action: GameAction): EngineTransition {
  assertValidState(state);
  const transition = dispatch(state, action);

  if (!transition.result.success) {
    if (transition.state !== state) throw new Error(`Failed action ${action.id} violated transaction contract by returning a different state.`);
    return transition;
  }

  if (transition.state === state) throw new Error(`Successful action ${action.id} violated transaction contract by reusing the input state.`);
  assertValidState(transition.state);
  return transition;
}
