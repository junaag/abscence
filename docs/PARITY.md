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
- **Unification thermique historique restaurée** : la météo mondiale est la source extérieure ; un lieu extérieur utilise directement sa température, un intérieur sans réglage dédié utilise `extérieur −2 °C`, et un lieu peut imposer une température fixe ou un offset intérieur spécifique.
- **Environnement joueur canonique** : température du lieu + humidité/condition/vent de la météo mondiale ; physiologie et conservation alimentaire consomment désormais les mêmes sélecteurs thermiques.
- Les anciennes sauvegardes v0.2-dev sans métadonnées d'environnement de lieu sont normalisées automatiquement au chargement.
- Graphe de lieux canonique ; connexions avec `open`, `locked`, `openSeconds`, `travelSeconds`.
- Inventaire et emplacement persistant unique des objets.
- Pomme : faim −9, soif −4, durée 120 s.
- Liquides en ml, bouteille 500 ml, boisson partielle et remplissage au robinet.
- Actions d'objet uniquement dans le popup de l'objet.
- Contenant : Ouvrir → contenu visible immédiatement.
- Examiner est informatif et n'est pas un verrou d'utilisation.
- Narratif de lieu dérivé de l'état réel.
- Sauvegarde v0.2.0 isolée, versionnée et validée par invariants.
- **Migration contrôlée v0.1.11 → v0.2 restaurée et testée contre le vrai moteur historique compressé du dépôt** : priorité à `absence-preview-v0111`, repli `absence-preview-v019`, et priorité absolue à une sauvegarde v0.2 valide existante.
- La migration v0.1.11 conserve les données reconnues : PV/besoins, emplacement, inventaire, pomme consommée, alias historique `water_bottle_01` / `water_bottle_500` vers `water_01`, quantité de liquide, batterie/fraîcheur si présentes, réseaux, météo, effets et mémoire ; les champs inconnus sont ignorés plutôt que d'invalider le nouvel état.
- Batteries génériques : charge persistante, coût d'usage, drain passif, extinction à 0 %.
- Téléphone : 78 % initial, −0,03 % par usage, recharge 2 %/min.
- Lampe : 64 % initial, −0,02 % par usage, −0,25 %/min lorsqu'elle est allumée.
- Source électrique générique et recharge selon disponibilité/tension actuelle.
- **Interruption de recharge sur transition électrique** : une recharge longue s'arrête exactement à la coupure du réseau et conserve la charge réellement acquise jusque-là.
- **Transitions d'infrastructure déterministes** pour eau, électricité et réseau mobile, avec instant exact et état persistant de traitement.
- **Dégradation autonome seedée des réseaux restaurée depuis v0.1.8** : seed 1701 ; électricité 12–72 h puis 8–48 h, eau 24–120 h puis 12–72 h, mobile 3–24 h puis 6–36 h.
- États instables historiques restaurés : électricité 65–92 %, eau 30–75 %, mobile 15–60 % ; seuils mobile SMS ≥10 %, appels ≥20 %, data ≥30 %.
- **Météo v0.1.8 restaurée dans l’état persistant** : `clear`, `partly_cloudy`, `cloudy`, `rain`, `storm`, `fog`, avec défauts historiques 23 °C, 55 %, vent 8 km/h et 0 mm/h.
- Normalisation météo historique restaurée : température bornée −30…55 °C, humidité 0…100 %, vent et précipitations non négatifs ; migration automatique des sauvegardes v0.2-dev sans météo.
- Fraîcheur persistante des périssables : pomme 94 % initial, base 0,2 point/h.
- Courbe thermique historique de dégradation restaurée de ≤4 °C à >40 °C.
- Réfrigérateur comme contrôleur thermique générique : cible 4 °C si électricité disponible et tension ≥70 %, sinon température réelle du lieu dérivée de la météo/environnement.
- **Règle réfrigérée v0.1.8 exacte** : lorsque le contrôle thermique est alimenté, le multiplicateur de dégradation vaut `min(courbe thermique, multiplicateur réfrigéré 0,25)` ; il n'est pas multiplié une seconde fois.
- Régression historique couverte : pomme 94 % → 92,8 % après 24 h dans un réfrigérateur alimenté à 4 °C.
- Température de stockage calculée depuis l'emplacement réel de l'objet.
- **Effets persistants historiques restaurés** : eau au sol, fumée, feu et bruit continu avec intensité persistante, croissance/décroissance, propagation par connexions ouvertes, ventilation et fenêtre pour la fumée.
- Impacts locaux des effets restaurés : stress, douleur et budget de dégâts PV pour fumée/feu dangereux.
- Narratif local enrichi à partir des effets réellement actifs dans le lieu.
- **Mitigation historique des effets restaurée** : éponger avec un torchon (−38, 150 s), ventiler la fumée (−18, 20 s), utiliser 250 ml d’eau sur un feu (−48, 15 s), neutraliser un bruit continu (−100, 25 s) et stopper une fuite (18 s).
- Les actions de mitigation sont générées par le moteur à partir des effets locaux et lient explicitement les ressources transportées nécessaires.
- **Événements historiques déterministes restaurés aux instants exacts** : bruit continu dans la cuisine à 5 min, fuite d'eau à 12 min, fumée dans le jardin à 25 min, sans duplication lors des avances de temps suivantes.
- **Définitions sensorielles v0.1.8 restaurées** pour fuite d'eau, alarme, panache de fumée, activité animale et bruit isolé, avec portées audible/visible/odeur exactes.
- **Perception à distance v0.1.8 restaurée** : distance locale métrique, Haversine géographique puis repli sur le graphe des lieux à `travelSeconds × 1,4 m/s`.
- Les canaux `audible`, `visible` et `smell` sont indépendants ; leur force décroît linéairement selon `1 − distance/portée`, et un événement hors de toute portée reste inconnu du joueur.
- Les événements perçus sont triés par distance et peuvent être marqués découverts sans rendre visibles les événements hors portée.
- **Scheduler autonome v0.1.8 restauré** : sources sérialisables, seed 1801, fenêtres de déclenchement, probabilités, conditions, durée, occurrences/tentatives, cycle `planifiée → active → résolue` et historique borné.
- Les événements autonomes restent reproductibles quel que soit le découpage de `advanceTime`; une transition d'infrastructure au même instant est toujours appliquée avant la tentative d'événement.
- Comme dans le moteur v0.1.8 pur, une nouvelle partie v0.2 démarre avec `eventSources: {}` : les cinq sources de démonstration appartenaient au pont v0.85 et ne sont pas injectées implicitement dans le scénario.
- **Téléphone historique piloté par GameState** : appels récents et messages d’Épouse/Alice/Lilou sont persistés dans l'état moteur et migrés pour les sauvegardes v0.2-dev plus anciennes ; l'UI ne contient plus ces données en dur.
- Écran téléphone : historique local consultable hors réseau si l'appareil est transporté et alimenté ; batterie et réseau affichés depuis l'état réel.
- **Capacités téléphone dérivées par le moteur** : appel, SMS et data suivent batterie + seuils réseau v0.1.8 ; l'historique local reste indépendant du réseau.
- **Météo du téléphone reconnectée** : l’écran lit directement la météo persistée du monde simulé et reste consultable hors réseau ; aucune donnée Internet n’est simulée comme étant réelle.
- **Validation structurelle du téléphone sauvegardé** : appareil lié à un smartphone valide, identifiants d'historique uniques et signal mobile 0–100 ; une sauvegarde corrompue est récupérée proprement.
- **Menu global remis au cahier des charges** : Accueil, Paramètres et À propos ; le réglage Son est persisté séparément de la sauvegarde de partie.
- **Carte Leaflet mobile restaurée** : tuiles OpenStreetMap, une seule instance `L.Map` conservée entre les changements de vue, centre/zoom persistants et marqueur Maison avec action « Revenir à la maison ».
- **Brouillard de guerre géographique persistant restauré** : état de carte séparé de la sauvegarde moteur, cercle initial exploré de 85 m, Canvas gris opaque texturé, trous géographiques persistants, fog pane sous les marqueurs et popups.
- La manipulation de la carte masque temporairement HUD et navigation basse et agrandit la carte à la hauteur de l’écran, sans recréer Leaflet au retour.
- **POI OSM progressifs restaurés** : chargement différé après stabilisation de la carte, uniquement à partir du zoom 15 et à proximité du secteur de départ, plafond de 45 marqueurs, requêtes annulables avec délai maximal et cache de quatre zones.
- **Catégories cartographiques françaises** : Industrie, Commerce, Services, Services publics et Résidentiel nommé ; `Station service` remplace l’ancien libellé Carburant, et `car_repair` est classé Services avant le cas générique `shop`.
- Les bulles POI affichent uniquement catégorie, nom OSM réel et type géographique ; aucun danger, ressource, état de fouille ou autre donnée interne du moteur n’est exposé sur la carte.
- Les POI utilisent une pane au-dessus du fog et les popups restent lisibles par-dessus le brouillard.
- Smoke mobile couvrant l’ouverture du téléphone, les historiques locaux, la météo, le menu, la persistance du réglage Son, Leaflet, le fog, l’instance de carte unique et les POI au-dessus du brouillard.
- CI reproductible : Node 22, `package-lock.json`, `npm ci`, TypeScript strict, ESLint, Vitest, build Vite et smoke Playwright mobile Pixel 7.

## À migrer avant promotion

- Système générique clé → serrure → déverrouillage (non suffisamment défini dans le v0.1.8 pour être inventé pendant le refactor).
- Téléphone : actions sortantes appel/SMS et leurs résultats de gameplay ; écran Réglages du téléphone si conservé dans la conception finale.
- **Exploration géographique réelle** : le fog sait persister des zones explorées, mais le déplacement actuel du gameplay reste un graphe intérieur abstrait ; il faut encore relier les futurs déplacements extérieurs aux zones/corridors explorés.
- **Position Maison exacte** : `[43.4053, 5.0548]` reste une approximation du secteur de départ et ne doit pas être considérée comme la coordonnée exacte du domicile.
- Annotations cartographiques au stylet si cette mécanique est conservée ; elles devront rester manuelles et ne jamais révéler les états internes des lieux.

## Décision UX qui remplace une règle historique

Le moteur v0.1.8 distinguait ouverture et fouille de contenus cachés. La conception actuelle d'ABSENCE simplifie volontairement ce flux : **ouvrir un contenant révèle directement son contenu accessible**. `Examiner` reste une action informative indépendante.
