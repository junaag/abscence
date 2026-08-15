import { getItemDefinition } from '../../content/items';
import type { EngineTransition, GameState } from '../model';
import { FOOD_RULES, WATER_RULES } from '../rules';
import { hasRunningTap, isItemAccessible } from '../selectors';
import { cloneState, clampNeeds } from '../state';
import { advanceTime } from '../time';
import { failure, success } from './result';

export function takeItem(state: GameState, itemId: string | undefined): EngineTransition {
  if (!itemId || !isItemAccessible(state, itemId)) return failure(state, 'Impossible', 'Cet objet n’est pas accessible.');
  const item = state.items[itemId];
  if (!item || item.location.kind === 'inventory') return failure(state, 'Impossible', 'Cet objet est déjà dans votre inventaire.');

  const next = cloneState(state);
  const nextItem = next.items[itemId];
  if (!nextItem) return failure(state, 'Impossible', 'Cet objet a disparu.');
  if (nextItem.location.kind === 'container') {
    const source = next.containers[nextItem.location.id];
    if (source) source.contentIds = source.contentIds.filter((id) => id !== itemId);
  }
  nextItem.location = { kind: 'inventory' };
  if (!next.player.inventoryIds.includes(itemId)) next.player.inventoryIds.push(itemId);
  advanceTime(next, 3);
  return success(next, `Vous prenez ${item.name.toLowerCase()}.`, 'L’objet rejoint votre inventaire.', 3);
}

export function eatItem(state: GameState, itemId: string | undefined): EngineTransition {
  if (!itemId) return failure(state, 'Impossible', 'Aucun aliment ciblé.');
  const item = state.items[itemId];
  if (!item || item.location.kind !== 'inventory' || item.definitionId !== 'apple') return failure(state, 'Impossible', 'Cet objet ne peut pas être mangé maintenant.');

  const next = cloneState(state);
  next.player.needs.hunger += FOOD_RULES.apple.hungerEffect;
  next.player.needs.thirst += FOOD_RULES.apple.thirstEffect;
  next.player.inventoryIds = next.player.inventoryIds.filter((id) => id !== itemId);
  const nextItem = next.items[itemId];
  if (nextItem) nextItem.location = { kind: 'consumed' };
  clampNeeds(next);
  advanceTime(next, FOOD_RULES.apple.consumptionSeconds);
  return success(next, 'Vous mangez la pomme.', 'Elle calme nettement la faim et apporte aussi un peu d’eau.', FOOD_RULES.apple.consumptionSeconds);
}

export function drinkItem(state: GameState, itemId: string | undefined, requestedMl: number | undefined): EngineTransition {
  if (!itemId) return failure(state, 'Impossible', 'Aucun contenant ciblé.');
  const item = state.items[itemId];
  if (!item || item.location.kind !== 'inventory' || item.definitionId !== 'water_bottle') return failure(state, 'Impossible', 'Vous ne pouvez pas boire depuis cet objet maintenant.');
  const available = item.liquidMl ?? 0;
  if (available <= 0) return failure(state, 'Bouteille vide', 'Il ne reste plus d’eau.');

  const amount = Math.max(1, Math.min(requestedMl ?? WATER_RULES.servingMl, available));
  const next = cloneState(state);
  const nextItem = next.items[itemId];
  if (!nextItem) return failure(state, 'Impossible', 'Le contenant a disparu.');
  nextItem.liquidMl = Math.max(0, (nextItem.liquidMl ?? 0) - amount);
  next.player.needs.thirst += WATER_RULES.thirstEffectPerServing * (amount / WATER_RULES.servingMl);
  clampNeeds(next);
  advanceTime(next, WATER_RULES.bottleDrinkSeconds);
  return success(next, 'Vous buvez.', `${amount} ml d’eau consommés.`, WATER_RULES.bottleDrinkSeconds);
}

export function fillLiquidContainer(state: GameState, itemId: string | undefined): EngineTransition {
  if (!itemId || !hasRunningTap(state)) return failure(state, 'Impossible', 'Aucune source d’eau utilisable ici.');
  const item = state.items[itemId];
  if (!item || item.location.kind !== 'inventory' || item.definitionId !== 'water_bottle') return failure(state, 'Impossible', 'Ce contenant doit être dans votre inventaire.');
  const current = item.liquidMl ?? 0;
  const capacity = item.capacityMl ?? 0;
  if (capacity <= current) return failure(state, 'Déjà pleine', 'La bouteille est déjà pleine.');

  const added = capacity - current;
  const elapsed = Math.max(8, Math.round(added / WATER_RULES.bottleFillMlPerSecond));
  const next = cloneState(state);
  const nextItem = next.items[itemId];
  if (!nextItem) return failure(state, 'Impossible', 'Le contenant a disparu.');
  nextItem.liquidMl = capacity;
  advanceTime(next, elapsed);
  return success(next, 'Vous remplissez la bouteille.', `${added} ml ajoutés.`, elapsed);
}

export function useItem(state: GameState, itemId: string | undefined): EngineTransition {
  if (!itemId) return failure(state, 'Impossible', 'Aucun objet ciblé.');
  const item = state.items[itemId];
  if (!item || item.location.kind !== 'inventory') return failure(state, 'Impossible', 'L’objet doit être transporté.');
  const definition = getItemDefinition(item.definitionId);
  if (!definition?.usable) return failure(state, 'Impossible', 'Cet objet n’a pas d’utilisation disponible.');
  const battery = definition.battery;
  const charge = item.batteryPercent ?? battery?.initialChargePct ?? 0;
  if (battery && charge <= 0) return failure(state, 'Batterie vide', 'L’appareil ne peut plus fonctionner.');

  const next = cloneState(state);
  const nextItem = next.items[itemId];
  if (!nextItem) return failure(state, 'Impossible', 'Cet objet a disparu.');
  if (battery) nextItem.batteryPercent = Math.max(0, charge - battery.useCostPct);
  if (definition.usable.toggleEnabled) nextItem.enabled = !nextItem.enabled;
  advanceTime(next, definition.usable.durationSeconds);
  const body = definition.usable.toggleEnabled ? (nextItem.enabled ? 'L’appareil est maintenant allumé.' : 'L’appareil est maintenant éteint.') : 'L’appareil répond normalement.';
  return success(next, `Vous utilisez ${item.name.toLowerCase()}.`, body, definition.usable.durationSeconds);
}

export function chargeItem(state: GameState, itemId: string | undefined, sourceId: string | undefined, requestedSeconds: number | undefined): EngineTransition {
  if (!itemId || !sourceId) return failure(state, 'Impossible', 'Cible ou source électrique manquante.');
  const item = state.items[itemId];
  const source = state.items[sourceId];
  if (!item || item.location.kind !== 'inventory') return failure(state, 'Impossible', 'L’appareil doit être dans votre inventaire.');
  if (!source || !isItemAccessible(state, sourceId)) return failure(state, 'Impossible', 'La source électrique n’est pas accessible.');

  const definition = getItemDefinition(item.definitionId);
  const battery = definition?.battery;
  const powerSource = getItemDefinition(source.definitionId)?.powerSource;
  if (!battery?.rechargeable || !battery.chargeRatePctPerMinute) return failure(state, 'Impossible', 'Cette batterie n’est pas rechargeable ici.');
  if (!powerSource) return failure(state, 'Impossible', 'Cet objet n’est pas une source électrique.');
  const electricity = state.infrastructure.electricity;
  if (!electricity.available || electricity.voltagePercent < powerSource.minimumVoltagePct) return failure(state, 'Pas de courant', 'La source électrique n’est pas alimentée.');

  const before = item.batteryPercent ?? battery.initialChargePct;
  if (before >= 100) return failure(state, 'Batterie pleine', 'Aucune recharge n’est nécessaire.');
  const effectiveRate = battery.chargeRatePctPerMinute * (electricity.voltagePercent / 100);
  const secondsToFull = ((100 - before) / effectiveRate) * 60;
  const requested = requestedSeconds === undefined ? Math.ceil(secondsToFull) : Math.max(1, requestedSeconds);
  const elapsed = Math.min(requested, Math.ceil(secondsToFull));

  const next = cloneState(state);
  advanceTime(next, elapsed);
  const nextItem = next.items[itemId];
  if (!nextItem) return failure(state, 'Impossible', 'L’appareil a disparu.');
  const afterPassiveDrain = nextItem.batteryPercent ?? before;
  nextItem.batteryPercent = Math.min(100, afterPassiveDrain + effectiveRate * (elapsed / 60));
  return success(next, `Vous rechargez ${item.name.toLowerCase()}.`, `Batterie : ${nextItem.batteryPercent.toFixed(1)} %.`, elapsed);
}

export function examineItem(state: GameState, itemId: string | undefined): EngineTransition {
  if (!itemId || !isItemAccessible(state, itemId)) return failure(state, 'Impossible', 'Cet objet n’est pas accessible.');
  const item = state.items[itemId];
  if (!item) return failure(state, 'Impossible', 'Cet objet n’existe plus.');

  const next = cloneState(state);
  const nextItem = next.items[itemId];
  if (!nextItem) return failure(state, 'Impossible', 'Cet objet n’existe plus.');
  nextItem.examined = true;
  advanceTime(next, 8);
  const details: string[] = [];
  if (item.condition) details.push(`État : ${item.condition}.`);
  if (item.capacityMl !== undefined) details.push(`Contenance : ${item.liquidMl ?? 0}/${item.capacityMl} ml.`);
  if (item.batteryPercent !== undefined) details.push(`Batterie : ${item.batteryPercent} %.`);
  if (details.length === 0) details.push('Rien d’anormal ne ressort de cet examen.');
  return success(next, `Vous examinez ${item.name.toLowerCase()}.`, details.join(' '), 8);
}
