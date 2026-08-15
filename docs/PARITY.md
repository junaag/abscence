# Parité v0.1.11 / moteur historique v0.1.8 → v0.2.0

La v0.2.0 ne remplace pas la v0.1.11 tant que cette matrice n'est pas complète.

## Déjà migré dans le nouveau noyau

- Santé exprimée en PV 0–100 ; besoins en %.
- Faim +1 % / 25 min ; soif +1 % / 15 min ; fatigue +1 % / 20 min.
- Perte de PV critique historique avec budget fractionnaire persistant et seuils faim/soif 90/100.
- Régression historique : soif 95 %, +30 min → soif 97 %, santé −1 PV.
- Mort logique à 0 PV.
- **Modificateurs physiologiques chaleur/humidité historiques restaurés** : soif accélérée au-delà de 26 °C, supplément humidité à partir de 28 °C et >60 %, fatigue accélérée au-delà de 30 °C, avec caps historiques.
- Les dégâts critiques utilisent le taux de soif environnemental effectif, donc la chaleur peut faire franchir les seuils de danger plus tôt.
- Graphe de lieux canonique ; connexions avec `open`, `locked`, `openSeconds`, `travelSeconds`.
- Inventaire et emplacement persistant unique des objets.
- Pomme : faim −9, soif −4, durée 120 s.
- Liquides en ml, bouteille 500 ml, boisson partielle et remplissage au robinet.
- Actions d'objet uniquement dans le popup de l'objet.
- Contenant : Ouvrir → contenu visible immédiatement.
- Examiner est informatif et n'est pas un verrou d'utilisation.
- Narratif de lieu dérivé de l'état réel.
- Sauvegarde v0.2.0 isolée, versionnée et validée par invariants.
- Batteries génériques : charge persistante, coût d'usage, drain passif, extinction à 0 %.
- Téléphone : 78 % initial, −0,03 % par usage, recharge 2 %/min.
- Lampe : 64 % initial, −0,02 % par usage, −0,25 %/min lorsqu'elle est allumée.
- Source électrique générique et recharge selon disponibilité/tension actuelle.
- Fraîcheur persistante des périssables : pomme 94 % initial, base 0,2 point/h.
- Courbe thermique historique de dégradation restaurée de ≤4 °C à >40 °C.
- Réfrigérateur comme contrôleur thermique générique : cible 4 °C si électricité disponible et tension ≥70 %, sinon température ambiante du lieu.
- Température de stockage calculée depuis l'emplacement réel de l'objet.
- **Effets persistants historiques restaurés** : eau au sol, fumée, feu et bruit continu avec intensité persistante, croissance/décroissance, propagation par connexions ouvertes, ventilation et fenêtre pour la fumée.
- Impacts locaux des effets restaurés : stress, douleur et budget de dégâts PV pour fumée/feu dangereux.
- Narratif local enrichi à partir des effets réellement actifs dans le lieu.

## À migrer avant promotion

- Multiplicateur réfrigéré historique additionnel `0,25` : valeur connue mais combinaison exacte avec la courbe thermique à revérifier dans la source historique avant activation.
- Système générique clé → serrure → déverrouillage (non suffisamment défini dans le v0.1.8 pour être inventé pendant le refactor).
- Interruption de recharge pendant une transition autonome du réseau électrique.
- Réseaux eau / électricité / mobile autonomes et déterministes.
- Événements autonomes avec seed.
- Perception auditive / visuelle / olfactive à distance.
- Actions de mitigation des effets persistants : éponger, ventiler, éteindre un feu, stopper une fuite/source de bruit.
- Téléphone / messages.
- Carte Leaflet + fog of war géographique persistant.
- Migration contrôlée d'une sauvegarde v0.1.11 si nécessaire.

## Décision UX qui remplace une règle historique

Le moteur v0.1.8 distinguait ouverture et fouille de contenus cachés. La conception actuelle d'ABSENCE simplifie volontairement ce flux : **ouvrir un contenant révèle directement son contenu accessible**. `Examiner` reste une action informative indépendante.
