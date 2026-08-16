# ABSENCE v0.2 — Checklist de promotion

Cette checklist doit être satisfaite avant qu'une build v0.2 remplace la v0.1.11 stable.

## Architecture

- [ ] `main` n'a reçu aucun hotfix fonctionnel non validé.
- [ ] Aucun `eval`, loader gzip/base64 ou patch runtime dans le code v0.2.
- [ ] Aucun import moteur → UI / DOM / stockage navigateur.
- [ ] `src/ui` passe exclusivement par l’API de présentation `src/app/game-api.ts` pour accéder au gameplay.
- [ ] Toutes les mutations de gameplay passent par les actions moteur.
- [ ] Les sous-systèmes persistés possèdent une validation ou des invariants adaptés.
- [ ] Présentation pure et contrôleur DOM restent séparés.

## Parité moteur

- [ ] `docs/PARITY.md` ne contient plus de bloc indispensable non migré.
- [ ] Les décisions UX qui divergent volontairement du moteur historique sont documentées.
- [ ] Les paramètres historiques repris possèdent au moins une régression automatisée.
- [ ] Aucun comportement non spécifié n'a été inventé uniquement pour terminer le refactor.

## Sauvegardes

- [ ] Sauvegarde v0.2 valide chargée prioritairement.
- [ ] Migration v0.1.11 testée avec le vrai moteur historique du dépôt.
- [ ] Migration navigateur testée via `localStorage` réel dans Playwright.
- [ ] Une migration valide est immédiatement persistée en v0.2 lorsque le stockage est disponible.
- [ ] Une sauvegarde historique corrompue ne crée pas de sauvegarde v0.2.
- [ ] Les anciennes clés sont conservées pendant la phase de validation pour rollback/diagnostic.
- [ ] Une panne de lecture/écriture du stockage navigateur ne casse pas le gameplay et affiche un avertissement clair.
- [ ] Les erreurs d’invariant moteur ne sont jamais masquées comme de simples erreurs de stockage.

## Mobile / UX

- [ ] Smoke Pixel 7 entièrement vert.
- [ ] Accueil, HUD, popups objets/contenants, inventaire et téléphone testés.
- [ ] Carte Leaflet, fog, POI et retour Accueil testés.
- [ ] Aucun scroll/overlay ne masque une action essentielle sur écran mobile.
- [ ] Les bulles HUD et fermetures de popup sont testables au tactile.
- [ ] Le mode stockage indisponible reste jouable et son avertissement est visible sans bloquer l’interface.

## Carte

- [ ] Une seule instance Leaflet au cours d'une session.
- [ ] Le chunk Leaflet/carte n’est pas chargé avant le premier accès à Carte.
- [ ] Le lazy-load de la carte possède un test réseau E2E.
- [ ] Fog opaque/texturé et exploration persistante.
- [ ] POI au-dessus du fog.
- [ ] POI différés et plafonnés.
- [ ] Aucun état interne gameplay exposé automatiquement.
- [ ] Coordonnée Maison explicitement marquée comme exacte ou approximative.

## Performance

- [ ] JavaScript total ≤100 KiB gzip.
- [ ] JavaScript chargé au démarrage ≤35 KiB gzip.
- [ ] CSS total ≤15 KiB gzip.
- [ ] Toute hausse de budget est motivée dans la PR.
- [ ] Aucun chargement OSM/Overpass lourd au démarrage de l'écran Accueil.
- [ ] Les ressources cartographiques ne sont chargées que lorsque nécessaires.

## CI

- [ ] `npm ci` vert sous Node 22.
- [ ] Contrôle d’intégrité/déterminisme du source vert.
- [ ] TypeScript strict vert.
- [ ] ESLint et frontières d’import vertes.
- [ ] Vitest vert.
- [ ] Build Vite vert.
- [ ] Budgets mobile total + démarrage verts.
- [ ] Playwright mobile vert.
- [ ] La preview n’est publiée qu’après quality + E2E verts.

## Historique Git / preview

La preview v0.2 est actuellement publiée dans `main/v020-preview/`. Ces commits sont des **artefacts de publication**, pas des commits source du refactor. Ils font volontairement diverger `main` et la branche Draft pendant le chantier.

- [ ] Avant promotion, comparer `main` et la branche source et vérifier que les commits présents uniquement sur `main` ne concernent que les artefacts de preview / métadonnées Pages.
- [ ] Ne jamais résoudre cette divergence en forçant la branche Draft sur `main`.
- [ ] Créer au moment de la promotion une intégration propre basée sur le `main` courant, ou utiliser une fusion squash/rebase contrôlée si GitHub la confirme sans conflit.
- [ ] L’historique rouge/diagnostic du chantier ne doit pas être promu comme historique de release ; le résultat final doit être intégré sous forme d’un jalon propre et auditable.
- [ ] Vérifier à nouveau la CI complète sur l’intégration finale avant tout remplacement de la stable.

## Promotion

- [ ] PR Draft convertie en Ready uniquement après tous les points bloquants.
- [ ] Preview v0.2 testée sur le téléphone réel du testeur.
- [ ] Retours critiques corrigés et CI de nouveau verte.
- [ ] Intégration finale propre basée sur le `main` courant préparée et revalidée.
- [ ] Tag/version de release préparé.
- [ ] Sauvegarde de la version stable précédente conservée.
- [ ] Seulement ensuite : fusion/promotion vers la version stable.
