import { getItemDefinition } from '../../content/items';
import { activeEffectsAt } from '../effects';
import type { ActionOption, GameState, ItemState } from '../model';
import { WATER_RULES } from '../rules';
import {
  connectedDestinations,
  hasRunningTap,
  inventoryItems,
  isElectricityAvailable,
  isItemAccessible,
  looseItemsAtCurrentLocation,
} from '../selectors';

function itemKind(item: ItemState): 'food' | 'liquid-container' | 'other' {
  if (item.definitionId === 'apple') return 'food';
  if (item.definitionId === 'water_bottle') return 'liquid-container';
  return 'other';
}

function localPowerSources(state: GameState): ItemState[] {
  return looseItemsAtCurrentLocation(state).filter((item) => getItemDefinition(item.definitionId)?.powerSource !== undefined);
}

export function getContextActions(state: GameState): ActionOption[] {
  const actions: ActionOption[] = [];
  for (const { connection, location } of connectedDestinations(state)) {
    if (connection.locked) continue;
    if (connection.open) actions.push({ id: 'MOVE', targetId: location.id, label: `Aller vers ${location.name}`, detail: `${connection.travelSeconds} s` });
    else actions.push({ id: 'OPEN_CONNECTION', targetId: connection.id, label: `Ouvrir vers ${location.name}`, detail: `${connection.openSeconds} s` });
  }

  if (hasRunningTap(state)) actions.push({ id: 'DRINK_TAP', label: 'Boire au robinet', detail: 'Boire directement à la source.' });

  const carried = inventoryItems(state);
  const towel = carried.find((item) => item.definitionId === 'towel');
  const water = carried.find((item) => item.definitionId === 'water_bottle' && (item.liquidMl ?? 0) >= 250);
  for (const effect of activeEffectsAt(state, state.player.locationId)) {
    if (effect.type === 'water_puddle' && towel) {
      actions.push({ id: 'MOP_EFFECT', targetId: effect.id, sourceId: towel.id, label: 'Éponger l’eau', detail: 'Utiliser le torchon.' });
    } else if (effect.type === 'smoke') {
      actions.push({ id: 'VENTILATE_EFFECT', targetId: effect.id, label: 'Aérer la pièce', detail: 'Ouvrir pour renouveler l’air.' });
    } else if (effect.type === 'fire' && water) {
      actions.push({ id: 'DOUSE_EFFECT', targetId: effect.id, sourceId: water.id, label: 'Éteindre avec de l’eau', detail: 'Utiliser 250 ml.' });
    } else if (effect.type === 'persistent_noise') {
      actions.push({ id: 'SILENCE_EFFECT', targetId: effect.id, label: 'Couper la source du bruit', detail: 'Faire cesser le bruit continu.' });
    }
  }
  if (state.player.locationId === 'kitchen' && state.world.leakActive) {
    actions.push({ id: 'STOP_LEAK', label: 'Arrêter la fuite', detail: 'Couper la source d’eau.' });
  }

  if (state.player.locationId === 'bedroom' && !state.memory.shoutedForWife) {
    actions.push({ id: 'SHOUT_FOR_WIFE', label: 'Appeler votre épouse à haute voix', detail: 'Écouter si quelqu’un répond.' });
  }
  actions.push({ id: 'WAIT', label: 'Attendre une minute', seconds: 60 });
  return actions;
}

export function getContainerActions(state: GameState, containerId: string): ActionOption[] {
  const container = state.containers[containerId];
  if (!container || container.locationId !== state.player.locationId || container.locked || container.open) return [];
  return [{ id: 'OPEN_CONTAINER', targetId: containerId, label: 'Ouvrir', detail: 'Le contenu devient immédiatement visible.' }];
}

export function getItemActions(state: GameState, itemId: string): ActionOption[] {
  const item = state.items[itemId];
  if (!item || !isItemAccessible(state, itemId)) return [];

  const actions: ActionOption[] = [];
  const inInventory = item.location.kind === 'inventory';
  const definition = getItemDefinition(item.definitionId);
  const kind = itemKind(item);

  if (kind === 'food') {
    actions.push({ id: 'EAT_ITEM', targetId: itemId, label: 'Manger', detail: inInventory ? undefined : 'Manger directement sans ranger l’objet.' });
  }

  if (kind === 'liquid-container') {
    const liquidMl = item.liquidMl ?? 0;
    const capacityMl = item.capacityMl ?? 0;
    const amount = Math.min(WATER_RULES.servingMl, liquidMl);
    if (liquidMl > 0) actions.push({ id: 'DRINK_ITEM', targetId: itemId, amountMl: amount, label: 'Boire', detail: `${amount} ml` });
    if (inInventory && hasRunningTap(state) && capacityMl > liquidMl) {
      actions.push({ id: 'FILL_LIQUID_CONTAINER', targetId: itemId, label: 'Remplir au robinet', detail: `${liquidMl}/${capacityMl} ml` });
    }
  }

  if (!inInventory && definition?.portable !== false) actions.push({ id: 'TAKE_ITEM', targetId: itemId, label: 'Prendre' });

  if (inInventory) {
    if (definition?.usable && (!definition.battery || (item.batteryPercent ?? definition.battery.initialChargePct) > 0)) {
      const label = definition.usable.toggleEnabled ? (item.enabled ? 'Éteindre' : 'Allumer') : 'Utiliser';
      const option: ActionOption = { id: 'USE_ITEM', targetId: itemId, label };
      if (definition.usable.uiIntent === 'OPEN_PHONE') option.detail = 'Ouvrir les fonctions du téléphone.';
      actions.push(option);
    }

    const electricity = state.infrastructure.electricity;
    if (definition?.battery?.rechargeable && (item.batteryPercent ?? definition.battery.initialChargePct) < 100 && isElectricityAvailable(state)) {
      for (const source of localPowerSources(state)) {
        const powerSource = getItemDefinition(source.definitionId)?.powerSource;
        if (powerSource && electricity.voltagePercent >= powerSource.minimumVoltagePct) {
          actions.push({ id: 'CHARGE_ITEM', targetId: itemId, sourceId: source.id, label: 'Recharger', detail: `Via ${source.name.toLowerCase()}.` });
        }
      }
    }
  }

  actions.push({ id: 'EXAMINE_ITEM', targetId: itemId, label: 'Examiner', detail: 'Observer son rôle, son fonctionnement et son état.' });
  return actions;
}
