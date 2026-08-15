# Parité v0.1.11 / moteur historique v0.1.8 → v0.2.0

La v0.2.0 ne remplace pas la v0.1.11 tant que cette matrice n'est pas complète.

## Déjà migré dans le nouveau noyau

- Santé exprimée en PV 0–100 ; besoins en %.
- Faim +1 % / 25 min ; soif +1 % / 15 min ; fatigue +1 % / 20 min.
- Perte de PV critique historique : budget fractionnaire persistant, seuils soif/faim 90/100.
- Régression historique : soif 95 %, +30 min → soif 97 %, santé −1 PV.
- Mort logique à 0 PV.
- Graphe de lieux canonique ; connexions avec `open`, `locked`, `openSeconds`, `travelSeconds`.
- Inventaire et emplacement persistant unique des objets.
- Pomme : faim −9, soif −4, durée 120 s.
- Liquides en ml, bouteille 500 ml, boisson partielle et remplissage au robinet.
- Actions d'objet uniquement dans le popup de l'objet.
- Contenant : Ouvrir → contenu visible immédiatement.
- Examiner est informatif et n'est pas un verrou d'utilisation.
- Narratif de lieu dérivé de l'état réel.
- Sauvegarde v0.2.0 isolée, versionnée et validée par invariants.
- **Batteries génériques restaurées** : charge persistante, coût d'usage, drain passif, extinction à 0 %.
- Téléphone : 78 % initial, −0,03 % par usage, recharge 2 %/min.
- Lampe : 64 % initial, −0,02 % par usage, −0,25 %/min lorsqu'elle est allumée.
- Source électrique générique et recharge statique selon disponibilité/tension actuelle.

## À migrer avant promotion

- Modificateurs de physiologie liés à la température/météo.
- Système générique clé → serrure → déverrouillage (non suffisamment défini dans le v0.1.8 pour être inventé pendant le refactor).
- Interruption de recharge pendant une transition autonome du réseau électrique.
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
