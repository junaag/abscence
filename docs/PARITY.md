# Parité v0.1.11 → v0.2.0

La v0.2.0 ne remplace pas la v0.1.11 tant que cette matrice n'est pas complète.

## Déjà migré dans le nouveau noyau

- Santé exprimée en PV 0–100.
- Faim / soif / fatigue / stress / douleur en %.
- Faim +1 % / 25 min.
- Soif +1 % / 15 min.
- Fatigue +1 % / 20 min.
- Déplacements via un graphe de connexions unique.
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

## À migrer avant promotion

- Courbe exacte de perte de PV liée aux besoins critiques.
- Portes / serrures / clés complètes.
- Batteries et recharge génériques.
- Périssables / réfrigération.
- Réseaux eau / électricité / mobile autonomes et déterministes.
- Événements autonomes avec seed.
- Perception auditive / visuelle / olfactive à distance.
- Effets persistants : eau, fumée, feu, bruit.
- Téléphone / messages.
- Carte Leaflet + fog of war géographique persistant.
- Migration contrôlée d'une sauvegarde v0.1.11 si nécessaire.
