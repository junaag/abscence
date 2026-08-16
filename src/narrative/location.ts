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
  return effect.intensity >= 35 ? 'Un bruit continu finit par remplir tout l’espace.' : 'Un bruit de fond persistant reste perceptible.';
}

function persistentSilence(state: GameState): string {
  const minutes = Math.floor(state.engine.elapsedSeconds / 60);
  if (minutes < 15) return '';
  if (minutes < 35) return ' Le silence extérieur s’est prolongé sans être interrompu par une voix, un moteur ou des pas.';
  return ' Le temps s’accumule et l’absence de voix humaines devient une présence en soi, régulière, presque matérielle.';
}

function visitCount(state: GameState, locationId: string): number {
  return state.memory.locationVisitCounts?.[locationId]
    ?? (state.memory.visitedLocationIds.includes(locationId) ? 1 : 0);
}

/**
 * Kept as an API compatibility point, but the situation panel no longer gives
 * the player a recommended next action. Exploration must remain self-directed.
 */
export function describeImmediateConcern(state: GameState): string {
  void state;
  return '';
}

export function describeCurrentLocation(state: GameState): string {
  const location = currentLocation(state);
  const items = visibleNames(looseItemsAtCurrentLocation(state));
  const effects = activeEffectsAt(state, location.id).map(describeEffect).join(' ');
  const firstVisit = visitCount(state, location.id) <= 1;
  let base: string;

  if (location.id === 'bedroom') {
    if (firstVisit) {
      base = 'Le réveil est brutal. Vous ouvrez les yeux avec le souffle court, encore allongé dans un lit dont les draps sont froissés autour de vous. Il ne reste qu’une image avant cet instant : un flash d’une blancheur violente, sans forme ni durée. Après lui, rien. Aucun nom ne remonte. Aucun visage. Aucun souvenir de la veille, de cette chambre ou de la raison pour laquelle vous êtes ici. La lumière du matin passe en bandes pâles entre les volets. Le mobilier, les vêtements, les objets autour de vous devraient peut-être signifier quelque chose ; ils ne provoquent qu’une impression de familiarité inaccessible.';
      if (items.length > 0) base += ` À portée de main, vous distinguez ${joinFrench(items)}.`;
      base += state.memory.shoutedForWife
        ? ' Votre appel a traversé la maison. Aucune voix ne lui a répondu.'
        : ' Au-delà de la pièce, la maison ne laisse entendre aucun mouvement.';
    } else {
      base = 'Vous retrouvez la chambre et ses détails désormais connus : les draps défaits, la lumière filtrée par les volets, le même silence derrière la porte. Le souvenir du flash n’a pas gagné en netteté.';
    }
  } else if (location.id === 'kitchen') {
    if (firstVisit) {
      const parts: string[] = [];
      parts.push('La cuisine a l’apparence banale d’un lieu quitté au milieu d’une journée ordinaire, mais rien ici ne déclenche de souvenir précis.');
      parts.push(isElectricityAvailable(state) ? 'Le réfrigérateur ronronne doucement, un bruit presque disproportionné dans le calme de la maison.' : 'Le réfrigérateur est silencieux ; aucun appareil électrique ne semble fonctionner.');
      if (items.length > 0) parts.push(`Plusieurs choses restent visibles : ${joinFrench(items)}.`);
      parts.push(isWaterAvailable(state) ? 'Lorsque le robinet est sollicité, l’eau est encore sous pression.' : 'Le robinet ne donne plus d’eau.');
      base = parts.join(' ');
    } else {
      base = `La cuisine est telle que vous l’avez déjà vue. ${isElectricityAvailable(state) ? 'Le réfrigérateur continue de vibrer faiblement.' : 'Les appareils restent muets.'}`;
      if (items.length > 0) base += ` Il reste ici ${joinFrench(items)}.`;
    }
  } else if (location.id === 'garden') {
    base = firstVisit
      ? 'L’air extérieur vous saisit immédiatement. Le jardin porte les traces ordinaires d’une habitation — végétation, clôture, mobilier — sans que rien ne vous revienne. Plus loin, aucune conversation, aucune portière, aucun moteur. Un oiseau traverse brièvement le silence puis disparaît derrière les toits.'
      : 'Le jardin n’a presque pas changé. Le vent déplace légèrement les feuilles et, au-delà de la clôture, le quartier reste étrangement calme.';
  } else if (location.id === 'street') {
    base = firstVisit
      ? 'Vous passez au-delà de la propriété. La rue s’étire entre des façades et des véhicules stationnés comme un décor intact après le départ de ses occupants. Rien n’est détruit. Rien n’annonce une catastrophe. Pourtant personne ne marche sur les trottoirs, aucune voiture ne passe, aucune silhouette n’apparaît derrière une fenêtre. Les sons qui restent — vent, oiseaux, un volet qui bouge quelque part — rendent l’absence humaine plus nette encore.'
      : 'Vous retrouvez la rue silencieuse. Les voitures sont toujours immobiles, les fenêtres toujours vides, et seuls les petits bruits du quartier sans habitants viennent rompre le calme.';
  } else if (location.id === 'map_walk_position') {
    base = firstVisit
      ? 'Vous avancez dans les rues du quartier. À chaque portion parcourue, quelques façades et intersections nouvelles émergent de ce que vous ne connaissiez pas encore.'
      : 'Vous continuez à pied dans le quartier, en laissant derrière vous les portions de rue déjà parcourues.';
  } else {
    base = firstVisit
      ? `Vous arrivez devant ${location.name}. Le lieu est silencieux et rien, de l’extérieur, ne permet encore de savoir ce qui s’est passé ici.`
      : `Vous revenez à ${location.name}. Les repères sont désormais familiers, même si le lieu reste privé de présence humaine.`;
  }

  const silence = persistentSilence(state);
  const scene = `${base}${silence}`;
  return effects ? `${scene} ${effects}` : scene;
}
