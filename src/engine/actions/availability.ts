import { getItemDefinition } from '../../content/items';
import { scalePhysicalDuration } from '../encumbrance';
import { activeEffectsAt } from '../effects';
import type { ActionOption, GameState, ItemState } from '../model';
import { getActivePoiZone, poiZones } from '../poi-sites';
import { WATER_RULES } from '../rules';
import {
  connectedDestinations,
  hasRunningTap,
  inventoryItems,
  isElectricityAvailable,
  isItemAccessible,
  isItemEquipped,
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

function durationLabel(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}

function carriesCrowbar(state: GameState): boolean {
  return inventoryItems(state).some((item) => item.definitionId === 'crowbar');
}

export function getContextActions(state: GameState): ActionOption[] {
  const actions: ActionOption[] = [];
  for (const { connection, location } of connectedDestinations(state)) {
    if (connection.locked) continue;
    if (connection.open) {
      const seconds = scalePhysicalDuration(state, connection.travelSeconds, 'movement');
      actions.push({ id: 'MOVE', targetId: location.id, label: `Aller vers ${location.name}`, detail: durationLabel(seconds) });
    } else {
      const seconds = scalePhysicalDuration(state, connection.openSeconds, 'action');
      actions.push({ id: 'OPEN_CONNECTION', targetId: connection.id, label: `Ouvrir vers ${location.name}`, detail: durationLabel(seconds) });
    }
  }

  const site = state.locations[state.player.locationId]?.poiSite;
  if (site) {
    if (site.phase === 'outside') {
      if (!site.observed) actions.push({ id: 'OBSERVE_LOCATION', label: 'Observer les lieux', detail: '25 s' });
      else if (site.entranceLocked) {
        const crowbar = carriesCrowbar(state);
        const seconds = scalePhysicalDuration(state, crowbar ? 108 : 240, 'action');
        actions.push({ id: 'FORCE_POI_ACCESS', label: 'Forcer l’accès', detail: `${crowbar ? 'Pied-de-biche · ' : ''}${durationLabel(seconds)}` });
      } else {
        actions.push({ id: 'ENTER_POI', label: 'Entrer', detail: durationLabel(scalePhysicalDuration(state, 12, 'action')) });
      }
    } else {
      const active = getActivePoiZone(site);
      if (active?.risk?.discovered && !active.risk.resolved) {
        actions.push({ id: 'SECURE_POI_RISK', label: 'Sécuriser la zone', detail: `${active.risk.label} · ${durationLabel(scalePhysicalDuration(state, active.risk.secureSeconds, 'action'))}` });
      }
      if (active && !active.searched) {
        actions.push({ id: 'SEARCH_LOCATION', label: `Fouiller ${active.name.toLowerCase()} méthodiquement`, detail: durationLabel(scalePhysicalDuration(state, 720, 'action')) });
      }
      const crowbar = carriesCrowbar(state);
      for (const zone of poiZones(site)) {
        if (zone.id === active?.id) continue;
        if (zone.locked) {
          actions.push({ id: 'FORCE_POI_ZONE', targetId: zone.id, label: `Forcer l’accès vers ${zone.name.toLowerCase()}`, detail: `${crowbar ? 'Pied-de-biche · ' : ''}${durationLabel(scalePhysicalDuration(state, crowbar ? 81 : 180, 'action'))}` });
        } else {
          actions.push({ id: 'MOVE_POI_ZONE', targetId: zone.id, label: `Explorer ${zone.name.toLowerCase()}`, detail: durationLabel(scalePhysicalDuration(state, 18, 'action')) });
        }
      }
      actions.push({ id: 'LEAVE_POI', label: 'Sortir', detail: durationLabel(scalePhysicalDuration(state, 8, 'action')) });
    }
  }

  if (hasRunningTap(state)) actions.push({ id: 'DRINK_TAP', label: 'Boire au robinet', detail: 'Boire directement à la source.' });

  const carried = inventoryItems(state);
  const towel = carried.find((item) => item.definitionId === 'towel');
  const water = carried.find((item) => item.definitionId === 'water_bottle' && (item.liquidMl ?? 0) >= 250);
  for (const effect of activeEffectsAt(state, state.player.locationId)) {
    if (effect.type === 'water_puddle' && towel) actions.push({ id: 'MOP_EFFECT', targetId: effect.id, sourceId: towel.id, label: 'Éponger l’eau', detail: 'Utiliser le torchon.' });
    else if (effect.type === 'smoke') actions.push({ id: 'VENTILATE_EFFECT', targetId: effect.id, label: 'Aérer la pièce', detail: 'Ouvrir pour renouveler l’air.' });
    else if (effect.type === 'fire' && water) actions.push({ id: 'DOUSE_EFFECT', targetId: effect.id, sourceId: water.id, label: 'Éteindre avec de l’eau', detail: 'Utiliser 250 ml.' });
    else if (effect.type === 'persistent_noise') actions.push({ id: 'SILENCE_EFFECT', targetId: effect.id, label: 'Couper la source du bruit', detail: 'Faire cesser le bruit continu.' });
  }
  if (state.player.locationId === 'kitchen' && state.world.leakActive) actions.push({ id: 'STOP_LEAK', label: 'Arrêter la fuite', detail: 'Couper la source d’eau.' });
  if (state.player.locationId === 'bedroom' && !state.memory.shoutedForWife) actions.push({ id: 'SHOUT_FOR_WIFE', label: 'Appeler à haute voix', detail: 'Lancer un appel dans la maison et écouter.' });
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
    const foodAction: ActionOption = { id: 'EAT_ITEM', targetId: itemId, label: 'Manger' };
    if (!inInventory) foodAction.detail = 'Manger directement sans ranger l’objet.';
    actions.push(foodAction);
  }

  if (kind === 'liquid-container') {
    const liquidMl = item.liquidMl ?? 0;
    const capacityMl = item.capacityMl ?? 0;
    const amount = Math.min(WATER_RULES.servingMl, liquidMl);
    if (liquidMl > 0) actions.push({ id: 'DRINK_ITEM', targetId: itemId, amountMl: amount, label: 'Boire', detail: `${amount} ml` });
    if (inInventory && hasRunningTap(state) && capacityMl > liquidMl) actions.push({ id: 'FILL_LIQUID_CONTAINER', targetId: itemId, label: 'Remplir au robinet', detail: `${liquidMl}/${capacityMl} ml` });
  }

  if (!inInventory && definition?.portable !== false) actions.push({ id: 'TAKE_ITEM', targetId: itemId, label: 'Prendre' });

  if (inInventory) {
    if (definition?.equipment) {
      actions.push(isItemEquipped(state, itemId)
        ? { id: 'UNEQUIP_ITEM', targetId: itemId, label: 'Retirer', detail: definition.equipment.slot === 'back' ? 'Retirer du dos.' : 'Retirer de la taille.' }
        : { id: 'EQUIP_ITEM', targetId: itemId, label: 'Équiper', detail: definition.equipment.slot === 'back' ? 'Porter sur le dos.' : 'Attacher à la taille.' });
    }

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
        if (powerSource && electricity.voltagePercent >= powerSource.minimumVoltagePct) actions.push({ id: 'CHARGE_ITEM', targetId: itemId, sourceId: source.id, label: 'Recharger', detail: `Via ${source.name.toLowerCase()}.` });
      }
    }
  }

  return actions;
}