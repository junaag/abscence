import { activeEffectsAt } from '../engine/effects';
import type { GameState, ItemState, PersistentEffect } from '../engine/model';
import { currentLocation, looseItemsAtCurrentLocation } from '../engine/selectors';

function joinFrench(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`;
}

function visibleNames(items: ItemState[]): string[] {
  return items.map((item) => item.name.toLowerCase());
}

function describeEffect(effect: PersistentEffect): string {
  if (effect.type === 'water_puddle') return effect.intensity >= 55 ? 'De l’eau s’étend franchement sur le sol.' : 'Une zone humide marque le sol.';
  if (effect.type === 'smoke') return effect.intensity >= 65 ? 'Une fumée épaisse rend l’air agressif.' : 'Une odeur de fumée flotte dans l’air.';
  if (effect.type === 'fire') return effect.intensity >= 75 ? 'Un feu violent gagne du terrain.' : 'Un départ de feu est actif ici.';
  return effect.intensity >= 35 ? 'Un bruit continu finit par devenir difficile à ignorer.' : 'Un bruit de fond persistant reste perceptible.';
}

export function describeCurrentLocation(state: GameState): string {
  const location = currentLocation(state);
  const items = visibleNames(looseItemsAtCurrentLocation(state));
  const effectText = activeEffectsAt(state, location.id).map(describeEffect).join(' ');
  let base: string;

  if (location.id === 'bedroom') {
    const first = 'La place à côté de vous est vide. Aucun bruit de circulation ne traverse la maison.';
    base = state.memory.shoutedForWife ? `${first} Vous avez appelé votre épouse, sans obtenir la moindre réponse.` : `${first} Le silence est suffisamment inhabituel pour attirer votre attention.`;
  } else if (location.id === 'kitchen') {
    const parts: string[] = [];
    parts.push(state.infrastructure.electricity.available ? 'Le réfrigérateur ronronne encore.' : 'Le réfrigérateur est silencieux : le courant est coupé.');
    parts.push(items.length > 0 ? `À portée de main : ${joinFrench(items)}.` : 'Le plan de travail est presque vide.');
    parts.push(state.infrastructure.water.available ? 'Le robinet fonctionne encore.' : 'Lorsque vous ouvrez le robinet, rien ne coule.');
    base = parts.join(' ');
  } else if (location.id === 'garden') {
    base = 'Le jardin est calme. Aucun mouvement humain, aucune voix, aucun moteur au loin.';
  } else {
    base = `Vous vous trouvez dans ${location.name.toLowerCase()}.`;
  }

  return effectText ? `${base} ${effectText}` : base;
}
