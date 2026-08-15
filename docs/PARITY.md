# Parité v0.1.11 / moteur historique v0.1.8 → v0.2.0

La v0.2.0 ne remplace pas la v0.1.11 tant que cette matrice n'est pas complète.

## Déjà migré dans le nouveau noyau

- Santé exprimée en PV 0–100.
- Faim / soif / fatigue / stress / douleur en %.
- Faim +1 % / 25 min.
- Soif +1 % / 15 min.
- Fatigue +1 % / 20 min.
- **Perte de PV critique historique restaurée exactement** : budget fractionnaire persistant, soif ≥90/100 et faim ≥90/100.
- Régression historique couverte : soif 95 %, +30 min → soif 97 %, santé −1 PV.
- Le calcul analytique conserve les mêmes résultats de PV quel que soit le découpage courant de simulation ; le léger écart sous le millième sur les valeurs fractionnaires est conservé car le v0.1.8 arrondissait chaque jauge et budget à 6 décimales après chaque avance.
- Mort logique lorsque la santé atteint 0 PV.
- Graphe de lieux canonique.
- **Connexions/portes v0.1.8 migrées** : `open`, `locked`, durée d'ouverture et durée de traversée distinctes.
- Une connexion fermée doit être ouverte avant le déplacement ; une connexion verrouillée bloque ouverture et déplacement.
- Inventaire et emplacement persistant des objets.
- Pomme : faim −9, soif −4, durée 120 s.
- Liquides en ml et bouteille de 500 ml.
- Boire partiellement.
- Remplir une bouteille depuis un robinet fonctionnel.
- Actions d'objet uniquement dans le popup de l'objet.
- Contenant : Ouvrir → contenu visible immédiatement.
- Examiner un objet sans en faire un verrou d'utilisation.
- Narratif de lieu dérivé de l'état réel.
- Sauvegarde v0.2.0 isolée et versionnée.
- Validation des invariants de `GameState` avant sauvegarde.

## À migrer avant promotion

- Modificateurs de physiologie liés à la température/météo.
- **Système générique clé → serrure → déverrouillage** (non suffisamment défini dans le v0.1.8 pour être inventé pendant le refactor).
- Batteries et recharge génériques.
- Périssables / réfrigération.
- Réseaux eau / électricité / mobile autonomes et déterministes.
- Événements autonomes avec seed.
- Perception auditive / visuelle / olfactive à distance.
- Effets persistants : eau, fumée, feu, bruit.
- Téléphone / messages.
- Carte Leaflet + fog of war géographique persistant.
- Migration contrôlée d'une sauvegarde v0.1.11 si nécessaire.

## Décision UX qui remplace une règle historique

Le moteur v0.1.8 distinguait ouverture et fouille de contenus cachés. La conception actuelle d'ABSENCE simplifie volontairement ce flux : **ouvrir un contenant révèle directement son contenu accessible**. `Examiner` reste une action informative indépendante.
