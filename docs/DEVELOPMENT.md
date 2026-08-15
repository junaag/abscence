# Méthode de développement ABSENCE

## Principe

`main` reste jouable. Une évolution n'arrive jamais directement dans la version stable.

## Cycle d'une évolution

1. Écrire la règle fonctionnelle.
2. Créer une branche `feature/...` ou `fix/...`.
3. Ajouter ou ajuster le test moteur avant l'intégration UI.
4. Implémenter la règle dans le moteur.
5. Vérifier les invariants de `GameState`.
6. Brancher l'UI sur les actions exposées par le moteur.
7. Ajouter un scénario d'intégration si la règle traverse plusieurs systèmes.
8. Ajouter/adapter un smoke E2E mobile pour les parcours critiques.
9. Laisser la CI exécuter typecheck, lint, tests, build et Playwright mobile.
10. Ouvrir une PR en draft et tester la preview mobile.
11. Ne fusionner qu'après parité, CI verte et validation fonctionnelle.

## Interdictions

- Pas de logique de gameplay dans un handler DOM.
- Pas de mutation directe du `GameState` par l'UI.
- Pas de `eval`.
- Pas de code source encodé en gzip/base64.
- Pas de hotfix runtime superposé à un autre hotfix.
- Pas de nouvelle représentation d'un concept existant sans migration explicite.
- Pas de merge d'une branche rouge.

## Contrats de robustesse

- Une action moteur reçoit un état et retourne un nouvel état ; l'état d'entrée ne doit pas être muté.
- `validateState` doit rester vide après chaque transition valide.
- Une sauvegarde incohérente est rejetée plutôt que chargée partiellement.
- Un objet possède exactement un emplacement canonique.
- Un contenant et ses objets doivent être d'accord sur `contentIds` et `item.location`.
- Les connexions doivent toujours référencer des lieux existants.

## Critères de promotion v0.2.0

La branche technique ne remplace pas v0.1.11 tant que :

- la matrice `docs/PARITY.md` n'est pas complète ;
- la CI complète est verte ;
- les parcours mobile critiques passent ;
- la carte et le téléphone ont retrouvé leur comportement attendu ;
- aucune régression fonctionnelle connue n'est ouverte.
