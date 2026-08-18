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

function describeKnownLocation(state: GameState, locationId: string): string | undefined {
  switch (locationId) {
    case 'hallway':
      return 'Le couloir dessert les autres pièces de la maison. Les portes sont là, les affaires aussi, mais aucune voix ne vient rompre le silence.';
    case 'girls_room':
      return 'La chambre paraît avoir été quittée normalement la veille. Les lits, les vêtements et les petits objets du quotidien sont toujours là. Vos filles, elles, ont disparu.';
    case 'bathroom':
      return isWaterAvailable(state)
        ? 'Tout semble banal. Le miroir, les serviettes, les produits de toilette. L’eau coule encore au robinet, comme si rien ne s’était passé.'
        : 'Tout semble banal, sauf le robinet : aucune eau ne sort lorsque vous l’ouvrez.';
    case 'living_room':
      return isElectricityAvailable(state)
        ? 'Le salon est intact. Quelques appareils restent alimentés, mais aucun son humain ne vient de la rue ni des maisons voisines.'
        : 'Le salon est plongé dans un calme lourd. Les appareils sont éteints et la rue, derrière les fenêtres, paraît anormalement immobile.';
    case 'garage':
      return 'L’odeur familière du garage contraste avec le silence extérieur. Outils, rangements et véhicule semblent avoir été abandonnés en plein quotidien.';
    case 'driveway':
      return 'Vous êtes maintenant devant la maison. Rien ne bouge dans les propriétés voisines. Des voitures sont garées, mais personne ne les rejoint.';
    case 'home_street':
      return 'La rue résidentielle est déserte. Volets ouverts, véhicules stationnés, poubelles et vélos donnent l’impression d’un matin ordinaire auquel il manquerait seulement tous les habitants.';
    case 'neighbor_front':
      return 'La maison voisine paraît intacte. Aucun appel, aucune sonnerie et aucun mouvement derrière les fenêtres ne provoquent de réaction.';
    case 'bus_stop':
      return 'L’arrêt de bus est vide. Aucun véhicule n’arrive, aucun moteur ne se fait entendre. Les horaires affichés semblent soudain appartenir à un monde qui ne fonctionne plus.';
    case 'small_park':
      return 'Le petit parc est entièrement vide. Le vent fait légèrement bouger la végétation et le mobilier, seul mouvement visible dans les environs.';
    case 'crossroads':
      return 'Le carrefour offre une première vue plus large du quartier. Plusieurs commerces sont visibles, mais aucune circulation et aucun piéton ne traversent les rues.';
    case 'pharmacy_front':
      return 'La pharmacie est fermée, mais la devanture semble intacte. À travers la vitre, les rayonnages sont encore en place.';
    case 'grocery_front':
      return 'La supérette paraît avoir fermé sans préparation particulière. Des produits sont encore visibles à travers la façade, mais personne ne répond à l’intérieur.';
    default:
      return undefined;
  }
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
    parts.push(isElectricityAvailable(state) ? 'Le réfrigérateur ronronne encore.' : 'Le réfrigérateur est silencieux : le courant est coupé.');
    parts.push(items.length > 0 ? `À portée de main : ${joinFrench(items)}.` : 'Le plan de travail est presque vide.');
    parts.push(isWaterAvailable(state) ? 'Le robinet fonctionne encore.' : 'Lorsque vous ouvrez le robinet, rien ne coule.');
    base = parts.join(' ');
  } else if (location.id === 'garden') {
    base = 'Le jardin est calme. Aucun mouvement humain, aucune voix, aucun moteur au loin.';
  } else {
    base = describeKnownLocation(state, location.id) ?? `Vous vous trouvez dans ${location.name.toLowerCase()}.`;
  }

  return effectText ? `${base} ${effectText}` : base;
}
