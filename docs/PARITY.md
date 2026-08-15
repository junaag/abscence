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
- **Interruption de recharge sur transition électrique** : une recharge longue s'arrête exactement à la coupure du réseau et conserve la charge réellement acquise jusque-là.
- **Transitions d'infrastructure déterministes** pour eau, électricité et réseau mobile, avec instant exact et état persistant de traitement.
- Fraîcheur persistante des périssables : pomme 94 % initial, base 0,2 point/h.
- Courbe thermique historique de dégradation restaurée de ≤4 °C à >40 °C.
- Réfrigérateur comme contrôleur thermique générique : cible 4 °C si électricité disponible et tension ≥70 %, sinon température ambiante du lieu.
- **Règle réfrigérée v0.1.8 exacte** : lorsque le contrôle thermique est alimenté, le multiplicateur de dégradation vaut `min(courbe thermique, multiplicateur réfrigéré 0,25)` ; il n'est pas multiplié une seconde fois.
- Régression historique couverte : pomme 94 % → 92,8 % après 24 h dans un réfrigérateur alimenté à 4 °C.
- Température de stockage calculée depuis l'emplacement réel de l'objet.
- **Effets persistants historiques restaurés** : eau au sol, fumée, feu et bruit continu avec intensité persistante, croissance/décroissance, propagation par connexions ouvertes, ventilation et fenêtre pour la fumée.
- Impacts locaux des effets restaurés : stress, douleur et budget de dégâts PV pour fumée/feu dangereux.
- Narratif local enrichi à partir des effets réellement actifs dans le lieu.
- **Mitigation historique des effets restaurée** : éponger avec un torchon (−38, 150 s), ventiler la fumée (−18, 20 s), utiliser 250 ml d’eau sur un feu (−48, 15 s), neutraliser un bruit continu (−100, 25 s) et stopper une fuite (18 s).
- Les actions de mitigation sont générées par le moteur à partir des effets locaux et lient explicitement les ressources transportées nécessaires.
- **Événements historiques déterministes restaurés aux instants exacts** : bruit continu dans la cuisine à 5 min, fuite d'eau à 12 min, fumée dans le jardin à 25 min, sans duplication lors des avances de temps suivantes.
- CI reproductible : Node 22, `package-lock.json`, `npm ci`, TypeScript strict, ESLint, Vitest, build Vite et smoke Playwright mobile Pixel 7.

## À migrer avant promotion

- Système générique clé → serrure → déverrouillage (non suffisamment défini dans le v0.1.8 pour être inventé pendant le refactor).
- Génération autonome/seedée des évolutions de réseaux au-delà des transitions déterministes déjà supportées par le moteur.
- Événements autonomes procéduraux avec seed au-delà des trois événements historiques fixes déjà restaurés.
- Perception auditive / visuelle / olfactive à distance.
- Téléphone / messages pilotés par l'état moteur.
- Carte Leaflet + fog of war géographique persistant.
- Migration contrôlée d'une sauvegarde v0.1.11 si nécessaire.

## Décision UX qui remplace une règle historique

Le moteur v0.1.8 distinguait ouverture et fouille de contenus cachés. La conception actuelle d'ABSENCE simplifie volontairement ce flux : **ouvrir un contenant révèle directement son contenu accessible**. `Examiner` reste une action informative indépendante.
