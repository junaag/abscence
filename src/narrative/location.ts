import type { GameState, ItemState } from '../engine/model';
import { currentLocation, looseItemsAtCurrentLocation } from '../engine/selectors';

function joinFrench(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`;
}
function visibleNames(items: ItemState[]): string[] { return items.map((item) => item.name.toLowerCase()); }

export function describeCurrentLocation(state: GameState): string {
  const location = currentLocation(state);
  const items = visibleNames(looseItemsAtCurrentLocation(state));
  if (location.id === 'bedroom') {
    const first = 'La place à côté de vous est vide. Aucun bruit de circulation ne traverse la maison.';
    return state.memory.shoutedForWife ? `${first} Vous avez appelé votre épouse, sans obtenir la moindre réponse.` : `${first} Le silence est suffisamment inhabituel pour attirer votre attention.`;
  }
  if (location.id === 'kitchen') {
    const parts: string[] = [];
    parts.push(state.infrastructure.electricity.available ? 'Le réfrigérateur ronronne encore.' : 'Le réfrigérateur est silencieux : le courant est coupé.');
    parts.push(items.length > 0 ? `À portée de main : ${joinFrench(items)}.` : 'Le plan de travail est presque vide.');
    parts.push(state.infrastructure.water.available ? 'Le robinet fonctionne encore.' : 'Lorsque vous ouvrez le robinet, rien ne coule.');
    return parts.join(' ');
  }
  if (location.id === 'garden') return 'Le jardin est calme. Aucun mouvement humain, aucune voix, aucun moteur au loin.';
  return `Vous vous trouvez dans ${location.name.toLowerCase()}.`;
}
