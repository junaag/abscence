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
11. **Les frontières d'import sont exécutables.** ESLint bloque moteur → UI et bloque l'UI qui contourne la façade publique du moteur.

## Flux

```text
Browser adapters (storage, future map/network)
   ↓
Application
   ↓
UI interaction
   ↓
GameAction
   ↓
performAction(state, action)
   ↓
GameState suivant + ActionResult
   ↓
application persistence adapter
   ↓
render(state)
```

## Découpage

- `src/app` : composition des dépendances navigateur et orchestration.
- `src/engine/actions/availability.ts` : déduction des actions disponibles.
- `src/engine/actions/movement.ts` : déplacements et passages.
- `src/engine/actions/containers.ts` : interactions de contenants.
- `src/engine/actions/items.ts` : nourriture, liquides, usage, recharge, examen.
- `src/engine/actions/world.ts` : actions sans cible objet.
- `src/engine/actions/dispatcher.ts` : unique point d'entrée de mutation moteur.
- `src/engine/rules.ts` : règles numériques transverses vérifiées.
- `src/content` : données de jeu sans logique DOM.
- `src/narrative` : texte calculé depuis l'état.
- `src/ui` : rendu et interactions, sans mutation gameplay directe.
- `tests/engine` : règles unitaires.
- `tests/integration` : scénarios de jeu complets.
- `tests/e2e` : parcours navigateur mobile.

## Règle objets / contenants

- Une action concernant un objet n'apparaît jamais dans le menu d'actions général.
- Un contenant fermé expose `Ouvrir`.
- `Ouvrir` révèle immédiatement son contenu dans le popup.
- Il n'existe pas d'étape obligatoire `Examiner → Fouiller` pour accéder au contenu.
- `Examiner` est une action informative d'objet, indépendante de l'accès au contenu.
