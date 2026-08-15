# Méthode de développement — ABSENCE

Ce document définit le cadre de développement de référence pour ABSENCE à partir de la v0.2.0.

## 1. Principe directeur

`main` reste jouable. Une évolution n'arrive jamais directement dans la version stable.

Le jeu suit un flux unique :

`UI → GameAction → moteur → GameState → persistance → rendu`

L’interface ne modifie jamais directement le monde. Le moteur ne dépend jamais du DOM, de Leaflet, de `localStorage` ni d’une API navigateur.

Le `GameState` est l’unique source de vérité du gameplay. Le narratif, les actions disponibles, l’inventaire, le téléphone et les états des lieux sont dérivés de cet état.

## 2. Organisation du code

- `src/engine/` : simulation pure, règles, temps, physiologie, événements, infrastructures et persistance.
- `src/content/` : définitions de contenu et état initial ; pas de logique UI.
- `src/narrative/` : texte dérivé du moteur ; ne crée pas d’état parallèle.
- `src/ui/` : rendu, popups, téléphone, carte et interactions ; passe par la façade publique du moteur.
- `tests/engine/` : tests unitaires et invariants.
- `tests/integration/` : scénarios multi-systèmes.
- `tests/e2e/` : parcours réels en navigateur mobile.

Une mécanique générique doit être implémentée par données + composants réutilisables plutôt que par cas particulier attaché à un objet nommé.

## 3. Cycle d’une évolution

1. Écrire la règle fonctionnelle ou le contrat technique.
2. Créer une branche `feature/...`, `fix/...` ou `refactor/...`.
3. Ajouter ou ajuster les tests moteur avant l’intégration UI quand c’est pertinent.
4. Implémenter la règle dans le moteur ou le module concerné.
5. Vérifier les invariants de `GameState`.
6. Brancher l’UI uniquement sur les actions/sélecteurs exposés par le moteur.
7. Ajouter un scénario d’intégration si la règle traverse plusieurs systèmes.
8. Ajouter ou adapter un smoke E2E mobile pour les parcours critiques.
9. Laisser la CI exécuter intégrité, TypeScript, lint, tests, build/budget et Playwright mobile.
10. Garder la PR en Draft jusqu’à satisfaction de la Definition of Done.
11. Tester une preview mobile dédiée avant promotion.
12. Ne fusionner qu’après parité, CI verte et validation fonctionnelle.

## 4. Definition of Done

Un changement n’est considéré terminé que lorsque :

1. la règle est explicite ;
2. les tests attendus sont écrits ou mis à jour ;
3. TypeScript strict compile sans erreur ;
4. ESLint passe sans désactivation opportuniste ;
5. les invariants du `GameState` restent valides ;
6. tous les tests Vitest passent ;
7. le build Vite respecte le budget mobile ;
8. le smoke Playwright Pixel 7 passe ;
9. toute migration de sauvegarde nécessaire est couverte ;
10. `docs/PARITY.md` est mise à jour si le comportement historique évolue.

## 5. Interdictions structurelles

- Pas de logique de gameplay dans un handler DOM.
- Pas de mutation directe du `GameState` par l’UI.
- Pas de `eval`.
- Pas de code source encodé en gzip/base64 dans le runtime v0.2.
- Pas de hotfix runtime superposé à un autre hotfix.
- Pas de nouvelle représentation d’un concept existant sans migration explicite.
- Pas de dépendance moteur → UI.
- Pas de merge d’une branche rouge.

Dans `src/engine/`, sont également interdits :

- `Math.random()` ;
- `Date.now()` / `new Date()` ;
- `setTimeout()` / `setInterval()` ;
- UUID aléatoire runtime ;
- accès direct au DOM ou au stockage navigateur.

Le hasard passe par des seeds persistées. Le temps passe uniquement par l’horloge simulée. Les identifiants persistants utilisent une séquence stockée dans l’état ou une donnée déterministe.

## 6. Contrats de robustesse

- Une action moteur reçoit un état et retourne un nouvel état ; l’état d’entrée ne doit pas être muté.
- Une action refusée ne doit pas produire un faux nouvel état.
- `validateState` doit rester vide après chaque transition valide.
- Une sauvegarde incohérente est rejetée ou récupérée par migration contrôlée plutôt que chargée partiellement.
- Un objet possède exactement un emplacement canonique.
- Un contenant et ses objets doivent être cohérents sur `contentIds` et `item.location`.
- Les connexions doivent toujours référencer des lieux existants.
- Les événements et infrastructures doivent évoluer de façon reproductible pour un même seed et une même chronologie d’actions.

## 7. Sauvegardes

Chaque schéma de sauvegarde est versionné.

Une nouvelle version doit :

- conserver les anciennes sauvegardes reconnues quand cela est raisonnable ;
- migrer depuis un état validé vers un nouvel état validé ;
- ignorer les champs historiques inconnus plutôt que les recopier aveuglément ;
- ne jamais ressusciter un objet consommé ou restaurer artificiellement une ressource perdue ;
- préférer une sauvegarde de version courante valide à toute sauvegarde héritée.

Les préférences d’interface, par exemple le son, restent séparées de la sauvegarde du monde.

## 8. Stratégie de tests

### Tests unitaires

Ils couvrent les règles atomiques : besoins, PV, liquides, batteries, contenants, événements, réseaux, météo, perception, etc.

### Tests d’intégration

Ils couvrent les conséquences entre systèmes. Exemple :

`ouvrir frigo → prendre pomme → manger pomme → revenir en cuisine → la pomme n’est plus décrite`.

### End-to-end mobile

Playwright exécute les parcours critiques avec une émulation Pixel 7. Les traces et captures produites lors d’un échec sont conservées automatiquement comme artefact CI.

Un test rouge bloque la promotion. On corrige la cause ; on ne réduit pas la couverture pour rendre le pipeline vert.

## 9. Performance mobile

La performance fait partie de la Definition of Done.

- budget JavaScript gzip : 100 KiB ;
- budget CSS gzip : 15 KiB ;
- une seule instance Leaflet ;
- données OSM/POI chargées progressivement ;
- nombre de marqueurs limité ;
- brouillard Canvas compact ;
- aucune animation lourde indispensable au gameplay ;
- les ressources externes non critiques ne bloquent pas l’écran principal.

Toute augmentation notable du bundle doit être justifiée.

## 10. CI

Une PR vers `main` déclenche un seul pipeline autoritatif :

`npm ci → intégrité source → TypeScript → lint → Vitest → build + budget → Playwright mobile`.

`main` est revalidé après fusion. Un déclenchement manuel reste disponible.

Les GitHub Actions sont épinglées par SHA. Les dépendances npm sont verrouillées par `package-lock.json` et installées avec `npm ci`.

Les diagnostics Playwright d’un run rouge sont conservés sept jours afin de permettre une analyse reproductible des régressions mobiles.

## 11. Gestion des versions

Le code source courant reste unique. Les anciennes versions sont conservées par Git/tags, pas par duplication permanente du moteur.

Avant promotion d’une version :

1. CI complètement verte ;
2. matrice de parité vérifiée ;
3. preview mobile dédiée validée ;
4. sauvegarde/migration testée ;
5. tag de version ;
6. merge vers `main` ;
7. smoke post-déploiement.

## 12. Rollback

Chaque jalon important doit correspondre à un commit vert identifiable.

En cas de régression :

1. revenir au dernier commit vert connu ;
2. reproduire le défaut sur une branche dédiée ;
3. ajouter un test qui échoue ;
4. corriger la cause ;
5. ne republier qu’après retour complet au vert.

Les diagnostics temporaires ne restent jamais dans le head de référence.

## 13. Conception non définie

Une règle incertaine n’est jamais inventée pour satisfaire artificiellement la parité. Elle reste explicitement marquée « à concevoir » jusqu’à une décision de gameplay.

Cette règle s’applique notamment lorsque le moteur historique ne fournit pas un contrat assez clair ou lorsque la nouvelle UX remplace volontairement l’ancien comportement.

## 14. Critères de promotion v0.2.0

La branche technique ne remplace pas v0.1.11 tant que :

- la matrice `docs/PARITY.md` n’est pas suffisamment fermée pour les systèmes retenus ;
- la CI complète n’est pas verte ;
- les parcours mobile critiques ne passent pas ;
- la carte et le téléphone n’ont pas retrouvé leur comportement attendu ;
- une preview v0.2 dédiée n’a pas été validée ;
- une régression fonctionnelle connue reste ouverte.
