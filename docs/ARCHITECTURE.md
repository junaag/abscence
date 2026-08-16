# ABSENCE v0.2.0 — Architecture technique

## Règles non négociables

1. **Le moteur est la seule autorité sur l'état du jeu.** L'UI n'écrit jamais directement dans le monde.
2. **Les actions passent toutes par `performAction`.** Pas de logique gameplay dans les handlers DOM.
3. **Les actions disponibles sont dérivées de l'état.** Aucun bouton métier codé en dur dans une vue.
4. **Narratif dérivé de l'état.** Une phrase ne doit pas décrire un objet absent ou consommé.
5. **Une seule représentation par concept.** Un contenant a `contentIds`, jamais `contents` dans un module et `items` dans un autre.
6. **Pas de `eval`, pas de gzip/base64 source, pas de hotfix runtime.** Vite produit le bundle de production.
7. **`main` doit rester jouable.** Le développement se fait par branche et PR.
8. **Une mécanique = spécification + tests moteur + intégration UI + smoke E2E.**
9. **Les actions sont découpées par domaine.** Le dispatcher central route vers mouvement, contenants, objets et monde ; il ne contient pas les règles métier de ces domaines.
10. **Le moteur est runtime-agnostique.** Il ne dépend ni du DOM, ni de `window`, ni de `localStorage`; ces dépendances sont injectées depuis `src/app`.
11. **Les frontières d'import sont exécutables.** ESLint bloque moteur → UI et interdit à `src/ui` tout import direct depuis `src/engine`; la présentation passe exclusivement par `src/app/game-api.ts`.
12. **Chaque action est transactionnelle.** `performAction` valide l'état entrant et sortant. Une réussite doit produire un nouvel état valide ; un échec doit rendre exactement l'état d'entrée.
13. **Les sauvegardes sont validées avant écriture et avant normalisation destructive.** Un champ manquant d'une ancienne version peut être complété ; une valeur explicitement corrompue doit être rejetée, pas réparée silencieusement.
14. **Une seule source thermique.** La météo mondiale décrit l'extérieur ; les lieux dérivent leur température via `location-environment`. Physiologie et conservation utilisent les mêmes sélecteurs.
15. **Une hausse du budget mobile est une décision explicite.** La CI bloque un dépassement ; on ne relève jamais le seuil uniquement pour faire passer un build.

## Flux

```text
Browser adapters (storage, map, préférences)
   ↓
Application
   ↓
src/app/game-api.ts (surface de présentation réduite)
   ↓
UI interaction
   ↓
GameAction
   ↓
performAction(state, action)
   ├─ validate input invariants
   ├─ dispatch to one domain handler
   └─ validate transaction + output invariants
   ↓
GameState suivant + ActionResult
   ↓
application persistence adapter
   ↓
presentation pure → render
```

## Découpage

- `src/app/game-api.ts` : surface gameplay autorisée à la présentation ; ne réexporte pas les helpers de simulation/admin du moteur.
- `src/app` : composition des dépendances navigateur, stockage, préférences et état UI de carte.
- `src/engine/actions/availability.ts` : déduction des actions disponibles.
- `src/engine/actions/movement.ts` : déplacements et passages.
- `src/engine/actions/containers.ts` : interactions de contenants.
- `src/engine/actions/items.ts` : nourriture, liquides, usage, recharge, examen.
- `src/engine/actions/world.ts` : actions sans cible objet.
- `src/engine/actions/dispatcher.ts` : unique frontière transactionnelle de mutation moteur.
- `src/engine/location-environment.ts` : température locale dérivée de la météo et des propriétés du lieu.
- `src/engine/*-validation.ts` : validation des sous-systèmes persistés avant leur usage.
- `src/content` : données de jeu sans logique DOM.
- `src/narrative` : texte calculé depuis l'état.
- `src/ui/presentation.ts` : HTML pur dérivé de l'état et des sélecteurs autorisés.
- `src/ui/render.ts` : contrôleur DOM/navigation ; transforme l'intention utilisateur en `GameAction` et ne contient pas de règle métier.
- `tests/engine` : règles unitaires et contrats structurels.
- `tests/integration` : scénarios de jeu complets.
- `tests/e2e` : parcours navigateur mobile réel.

## Temps et simulation

`advanceTime` orchestre les systèmes. Les frontières temporelles exactes — pannes d'infrastructure, événements, effets persistants — sont traitées au moment où elles surviennent même si une action traverse plusieurs frontières.

Les seeds moteur font partie de l'état persistant. Le résultat métier ne doit pas dépendre de la taille des pas de simulation, hors arrondis historiques explicitement documentés et testés.

## Persistance et migrations

- clé v0.2 de développement : `absence-v020-dev` ;
- une sauvegarde v0.2 valide a toujours priorité sur les previews historiques ;
- migration reconnue : `absence-preview-v0111`, puis `absence-preview-v019` ;
- une migration valide est immédiatement persistée au format v0.2 dans l'adaptateur navigateur ;
- l'ancienne clé historique est conservée pour diagnostic/rollback ;
- une donnée historique corrompue n'est jamais promue en sauvegarde v0.2 ;
- les tests de migration utilisent le vrai moteur v0.1.11 compressé présent dans le dépôt, pas uniquement un fixture réécrit à la main.

La migration historique ne suppose pas que les identifiants internes soient identiques entre versions. Les alias connus et l'état mutable imbriqué sont traduits vers les concepts canoniques v0.2 avant validation.

## Environnement canonique

La météo mondiale est la source extérieure. La règle historique restaurée est :

- température locale fixe si le lieu en impose une ;
- lieu extérieur → température météo ;
- lieu intérieur → température météo + offset, `−2 °C` par défaut ;
- humidité, condition et vent joueur proviennent de la météo mondiale.

Physiologie et périssables consomment ces sélecteurs. Un nouveau système ne doit pas introduire une température ou une humidité parallèle.

## Carte

La carte reste un outil géographique. Danger, ressources, état de fouille, sécurité et autres états internes ne doivent pas être révélés automatiquement.

- une seule instance Leaflet persistante ;
- brouillard géographique et persistant ;
- corridors d'exploration compacts ;
- POI différés, limités et mis en cache ;
- bulles/POI au-dessus du fog ;
- l'état UI de carte est séparé du `GameState` moteur.

## Règle objets / contenants

- Une action concernant un objet n'apparaît jamais dans le menu d'actions général.
- Un contenant fermé expose `Ouvrir`.
- `Ouvrir` révèle immédiatement son contenu dans le popup.
- Il n'existe pas d'étape obligatoire `Examiner → Fouiller` pour accéder au contenu.
- `Examiner` est une action informative d'objet, indépendante de l'accès au contenu.
- Les objets d'inventaire ne sont pas répétés sur l'accueil.

## Barrières qualité obligatoires

Chaque head candidat doit passer :

1. TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.) ;
2. ESLint et frontières d'architecture ;
3. tests moteur et intégration ;
4. build Vite ;
5. budget mobile gzip ;
6. smoke Playwright en émulation Pixel 7.

Budget v0.2 actuel :

- JavaScript total : **≤100 KiB gzip** ;
- CSS total : **≤15 KiB gzip**.

Base mesurée avant activation du budget : environ **73,2 KiB JS gzip** et **8,5 KiB CSS gzip**.

## Git et versions

- `main` reste jouable ;
- une évolution se fait sur branche dédiée ;
- PR Draft tant que parité ou validation mobile n'est pas complète ;
- diagnostics temporaires exclus de la branche canonique de release ;
- CI verte avant promotion ;
- les versions historiques sont conservées par Git/tags, pas par duplication permanente du code source ;
- aucun retour au loader runtime `gzip/base64 + eval` dans la v0.2.
