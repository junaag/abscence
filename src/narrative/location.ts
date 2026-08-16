import { activeEffectsAt } from '../engine/effects';
import { isElectricityAvailable, isWaterAvailable } from '../engine/infrastructure';
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

function persistentSilence(state: GameState): string {
  const minutes = Math.floor(state.engine.elapsedSeconds / 60);
  if (minutes < 10) return '';
  if (minutes < 20) return ' Plusieurs minutes ont passé et personne n’a encore répondu, appelé ou traversé la rue.';
  return ' Le temps passe. Ce silence n’a plus rien d’un simple hasard : aucune présence humaine ne s’est manifestée depuis votre réveil.';
}

export function describeCurrentLocation(state: GameState): string {
  const location = currentLocation(state);
  const items = visibleNames(looseItemsAtCurrentLocation(state));
  const effectText = activeEffectsAt(state, location.id).map(describeEffect).join(' ');
  let base: string;

  if (location.id === 'bedroom') {
    const first = 'La place à côté de vous est vide. Les draps sont froids, comme si personne ne s’y était allongé depuis un moment. Derrière les volets, aucun moteur, aucune voix, aucun bruit de voisinage.';
    base = state.memory.shoutedForWife
      ? `${first} Vous avez appelé votre épouse. Votre voix a traversé la maison, puis le silence est revenu exactement comme avant.`
      : `${first} Votre téléphone est là, mais rien dans la pièce n’explique cette absence.`;
  } else if (location.id === 'kitchen') {
    const parts: string[] = [];
    parts.push(isElectricityAvailable(state) ? 'Le ronronnement du réfrigérateur paraît presque trop présent dans cette maison silencieuse.' : 'Le réfrigérateur s’est tu : le courant est coupé.');
    parts.push(items.length > 0 ? `Sur le plan de travail et autour de vous : ${joinFrench(items)}.` : 'Le plan de travail ne vous donne aucun indice immédiat.');
    parts.push(isWaterAvailable(state) ? 'L’eau coule encore au robinet, signe que les réseaux n’ont pas encore totalement cessé de fonctionner.' : 'Le robinet ne donne plus rien. Le réseau d’eau a déjà cessé de fonctionner.');
    base = parts.join(' ');
  } else if (location.id === 'garden') {
    base = 'L’air extérieur confirme ce que la maison laissait craindre. Le jardin est immobile ; aucune conversation voisine, aucune portière, aucun moteur. Au-delà de la clôture, la rue semble anormalement vide.';
  } else if (location.id === 'street') {
    base = 'Vous franchissez réellement la limite de la maison. La rue est là, familière dans ses formes et pourtant méconnaissable : des véhicules sont stationnés, mais rien ne circule. Aucun piéton, aucun voisin, aucune voix aux fenêtres. Pour la première fois, l’hypothèse que le problème dépasse votre foyer devient difficile à écarter.';
  } else {
    base = `Vous vous trouvez dans ${location.name.toLowerCase()}.`;
  }

  const silence = persistentSilence(state);
  return effectText ? `${base}${silence} ${effectText}` : `${base}${silence}`;
}
