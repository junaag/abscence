import type { ActionOption, EngineTransition, GameAction, GameState, ItemState } from './model';
import { connectedDestinations, containerContents, hasRunningTap, inventoryItems, isItemAccessible } from './selectors';
import { cloneState, clampNeeds } from './state';
import { advanceTime } from './time';

const APPLE_HUNGER_EFFECT = -9;
const APPLE_THIRST_EFFECT = -4;
const APPLE_CONSUMPTION_SECONDS = 120;
const WATER_DRINK_ML = 250;
const WATER_THIRST_EFFECT = -15;

function success(state: GameState, title: string, body: string, elapsedSeconds: number): EngineTransition {
  return { state, result: { success: true, title, body, elapsedSeconds } };
}
function failure(state: GameState, title: string, body: string): EngineTransition {
  return { state, result: { success: false, title, body, elapsedSeconds: 0 } };
}
function itemKind(item: ItemState): 'food' | 'liquid-container' | 'phone' | 'other' {
  if (item.definitionId === 'apple') return 'food';
  if (item.definitionId === 'water_bottle') return 'liquid-container';
  if (item.definitionId === 'phone') return 'phone';
  return 'other';
}

export function getContextActions(state: GameState): ActionOption[] {
  const actions: ActionOption[] = [];
  for (const { connection, location } of connectedDestinations(state)) {
    if (connection.blocked || connection.locked) continue;
    actions.push({ id: 'MOVE', targetId: location.id, label: `Aller vers ${location.name}`, detail: `${connection.durationSeconds} s` });
  }
  if (hasRunningTap(state)) actions.push({ id: 'DRINK_TAP', label: 'Boire au robinet', detail: 'Boire directement à la source.' });
  if (state.player.locationId === 'bedroom' && !state.memory.shoutedForWife) actions.push({ id: 'SHOUT_FOR_WIFE', label: 'Appeler votre épouse à haute voix', detail: 'Écouter si quelqu’un répond.' });
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
  if (!inInventory) actions.push({ id: 'TAKE_ITEM', targetId: itemId, label: 'Prendre' });
  if (inInventory) {
    if (itemKind(item) === 'food') actions.push({ id: 'EAT_ITEM', targetId: itemId, label: 'Manger' });
    if (itemKind(item) === 'liquid-container') {
      const liquidMl = item.liquidMl ?? 0;
      const capacityMl = item.capacityMl ?? 0;
      if (liquidMl > 0) actions.push({ id: 'DRINK_ITEM', targetId: itemId, amountMl: Math.min(WATER_DRINK_ML, liquidMl), label: 'Boire', detail: `${Math.min(WATER_DRINK_ML, liquidMl)} ml` });
      if (hasRunningTap(state) && capacityMl > liquidMl) actions.push({ id: 'FILL_LIQUID_CONTAINER', targetId: itemId, label: 'Remplir au robinet', detail: `${liquidMl}/${capacityMl} ml` });
    }
  }
  actions.push({ id: 'EXAMINE_ITEM', targetId: itemId, label: 'Examiner', detail: 'Observer son rôle, son fonctionnement et son état.' });
  return actions;
}

function move(state: GameState, targetId: string | undefined): EngineTransition {
  if (!targetId || !state.locations[targetId]) return failure(state, 'Déplacement impossible', 'Cette destination n’existe pas.');
  const candidate = connectedDestinations(state).find(({ location }) => location.id === targetId);
  if (!candidate || candidate.connection.blocked || candidate.connection.locked) return failure(state, 'Déplacement impossible', 'Aucun passage accessible ne mène là-bas.');
  const next = cloneState(state);
  next.player.locationId = targetId;
  if (!next.memory.visitedLocationIds.includes(targetId)) next.memory.visitedLocationIds.push(targetId);
  advanceTime(next, candidate.connection.durationSeconds);
  return success(next, next.locations[targetId]?.name ?? 'Déplacement', 'Vous rejoignez le lieu.', candidate.connection.durationSeconds);
}
function openContainer(state: GameState, containerId: string | undefined): EngineTransition {
  if (!containerId) return failure(state, 'Impossible', 'Aucun contenant ciblé.');
  const container = state.containers[containerId];
  if (!container || container.locationId !== state.player.locationId) return failure(state, 'Impossible', 'Ce contenant n’est pas accessible ici.');
  if (container.locked) return failure(state, 'Verrouillé', 'Le contenant est verrouillé.');
  if (container.open) return failure(state, 'Déjà ouvert', 'Le contenant est déjà ouvert.');
  const next = cloneState(state);
  const nextContainer = next.containers[containerId];
  if (!nextContainer) return failure(state, 'Impossible', 'Le contenant a disparu.');
  nextContainer.open = true;
  advanceTime(next, 2);
  const count = containerContents(next, containerId).length;
  return success(next, `Vous ouvrez ${container.name.toLowerCase()}.`, count > 0 ? `Vous voyez ${count} objet${count > 1 ? 's' : ''} à l’intérieur.` : 'Il est vide.', 2);
}
function takeItem(state: GameState, itemId: string | undefined): EngineTransition {
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
function eatItem(state: GameState, itemId: string | undefined): EngineTransition {
  if (!itemId) return failure(state, 'Impossible', 'Aucun aliment ciblé.');
  const item = state.items[itemId];
  if (!item || item.location.kind !== 'inventory' || item.definitionId !== 'apple') return failure(state, 'Impossible', 'Cet objet ne peut pas être mangé maintenant.');
  const next = cloneState(state);
  next.player.needs.hunger += APPLE_HUNGER_EFFECT;
  next.player.needs.thirst += APPLE_THIRST_EFFECT;
  next.player.inventoryIds = next.player.inventoryIds.filter((id) => id !== itemId);
  const nextItem = next.items[itemId];
  if (nextItem) nextItem.location = { kind: 'consumed' };
  clampNeeds(next);
  advanceTime(next, APPLE_CONSUMPTION_SECONDS);
  return success(next, 'Vous mangez la pomme.', 'Elle calme nettement la faim et apporte aussi un peu d’eau.', APPLE_CONSUMPTION_SECONDS);
}
function drinkItem(state: GameState, itemId: string | undefined, requestedMl: number | undefined): EngineTransition {
  if (!itemId) return failure(state, 'Impossible', 'Aucun contenant ciblé.');
  const item = state.items[itemId];
  if (!item || item.location.kind !== 'inventory' || item.definitionId !== 'water_bottle') return failure(state, 'Impossible', 'Vous ne pouvez pas boire depuis cet objet maintenant.');
  const available = item.liquidMl ?? 0;
  if (available <= 0) return failure(state, 'Bouteille vide', 'Il ne reste plus d’eau.');
  const amount = Math.max(1, Math.min(requestedMl ?? WATER_DRINK_ML, available));
  const next = cloneState(state);
  const nextItem = next.items[itemId];
  if (!nextItem) return failure(state, 'Impossible', 'Le contenant a disparu.');
  nextItem.liquidMl = Math.max(0, (nextItem.liquidMl ?? 0) - amount);
  next.player.needs.thirst += WATER_THIRST_EFFECT * (amount / WATER_DRINK_ML);
  clampNeeds(next);
  advanceTime(next, 20);
  return success(next, 'Vous buvez.', `${amount} ml d’eau consommés.`, 20);
}
function drinkTap(state: GameState): EngineTransition {
  if (!hasRunningTap(state)) return failure(state, 'Pas d’eau', 'Aucune eau courante n’est disponible ici.');
  const next = cloneState(state);
  next.player.needs.thirst += WATER_THIRST_EFFECT;
  clampNeeds(next);
  advanceTime(next, 20);
  return success(next, 'Vous buvez au robinet.', 'L’eau coule encore normalement.', 20);
}
function fillLiquidContainer(state: GameState, itemId: string | undefined): EngineTransition {
  if (!itemId || !hasRunningTap(state)) return failure(state, 'Impossible', 'Aucune source d’eau utilisable ici.');
  const item = state.items[itemId];
  if (!item || item.location.kind !== 'inventory' || item.definitionId !== 'water_bottle') return failure(state, 'Impossible', 'Ce contenant doit être dans votre inventaire.');
  const current = item.liquidMl ?? 0;
  const capacity = item.capacityMl ?? 0;
  if (capacity <= current) return failure(state, 'Déjà pleine', 'La bouteille est déjà pleine.');
  const added = capacity - current;
  const elapsed = Math.max(8, Math.round(added / 25));
  const next = cloneState(state);
  const nextItem = next.items[itemId];
  if (!nextItem) return failure(state, 'Impossible', 'Le contenant a disparu.');
  nextItem.liquidMl = capacity;
  advanceTime(next, elapsed);
  return success(next, 'Vous remplissez la bouteille.', `${added} ml ajoutés.`, elapsed);
}
function examineItem(state: GameState, itemId: string | undefined): EngineTransition {
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
function shoutForWife(state: GameState): EngineTransition {
  if (state.player.locationId !== 'bedroom') return failure(state, 'Impossible', 'Ce contexte ne correspond plus à cette action.');
  const next = cloneState(state);
  next.memory.shoutedForWife = true;
  advanceTime(next, 8);
  return success(next, 'Votre voix traverse la maison.', 'Aucune réponse. Le silence qui suit paraît encore plus anormal.', 8);
}
function wait(state: GameState, seconds: number | undefined): EngineTransition {
  const elapsed = Math.max(1, Math.floor(seconds ?? 60));
  const next = cloneState(state);
  advanceTime(next, elapsed);
  return success(next, 'Vous attendez.', 'Le temps continue de passer.', elapsed);
}

export function performAction(state: GameState, action: GameAction): EngineTransition {
  switch (action.id) {
    case 'MOVE': return move(state, action.targetId);
    case 'OPEN_CONTAINER': return openContainer(state, action.targetId);
    case 'TAKE_ITEM': return takeItem(state, action.targetId);
    case 'EAT_ITEM': return eatItem(state, action.targetId);
    case 'DRINK_ITEM': return drinkItem(state, action.targetId, action.amountMl);
    case 'DRINK_TAP': return drinkTap(state);
    case 'FILL_LIQUID_CONTAINER': return fillLiquidContainer(state, action.targetId);
    case 'EXAMINE_ITEM': return examineItem(state, action.targetId);
    case 'SHOUT_FOR_WIFE': return shoutForWife(state);
    case 'WAIT': return wait(state, action.seconds);
  }
}

export function inventoryHas(state: GameState, definitionId: string): boolean {
  return inventoryItems(state).some((item) => item.definitionId === definitionId);
}
