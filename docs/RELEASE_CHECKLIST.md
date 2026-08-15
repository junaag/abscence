# ABSENCE v0.2 — Checklist de promotion

Cette checklist doit être satisfaite avant qu'une build v0.2 remplace la v0.1.11 stable.

## Architecture

- [ ] `main` n'a reçu aucun hotfix fonctionnel non validé.
- [ ] Aucun `eval`, loader gzip/base64 ou patch runtime dans le code v0.2.
- [ ] Aucun import moteur → UI / DOM / stockage navigateur.
- [ ] Toutes les mutations de gameplay passent par les actions moteur.
- [ ] Les sous-systèmes persistés possèdent une validation ou des invariants adaptés.

## Parité moteur

- [ ] `docs/PARITY.md` ne contient plus de bloc indispensable non migré.
- [ ] Les décisions UX qui divergent volontairement du moteur historique sont documentées.
- [ ] Les paramètres historiques repris possèdent au moins une régression automatisée.
- [ ] Aucun comportement non spécifié n'a été inventé uniquement pour terminer le refactor.

## Sauvegardes

- [ ] Sauvegarde v0.2 valide chargée prioritairement.
- [ ] Migration v0.1.11 testée avec le vrai moteur historique du dépôt.
- [ ] Migration navigateur testée via `localStorage` réel dans Playwright.
- [ ] Une migration valide est immédiatement persistée en v0.2.
- [ ] Une sauvegarde historique corrompue ne crée pas de sauvegarde v0.2.
- [ ] Les anciennes clés sont conservées pendant la phase de validation pour rollback/diagnostic.

## Mobile / UX

- [ ] Smoke Pixel 7 entièrement vert.
- [ ] Accueil, HUD, popups objets/contenants, inventaire et téléphone testés.
- [ ] Carte Leaflet, fog, POI et retour Accueil testés.
- [ ] Aucun scroll/overlay ne masque une action essentielle sur écran mobile.
- [ ] Les bulles HUD et fermetures de popup sont testables au tactile.

## Carte

- [ ] Une seule instance Leaflet au cours d'une session.
- [ ] Fog opaque/texturé et exploration persistante.
- [ ] POI au-dessus du fog.
- [ ] POI différés et plafonnés.
- [ ] Aucun état interne gameplay exposé automatiquement.
- [ ] Coordonnée Maison explicitement marquée comme exacte ou approximative.

## Performance

- [ ] `npm run build` respecte le budget : JS ≤100 KiB gzip, CSS ≤15 KiB gzip.
- [ ] Toute hausse de budget est motivée dans la PR.
- [ ] Aucun chargement OSM/Overpass lourd au démarrage de l'écran Accueil.
- [ ] Les ressources cartographiques ne sont chargées que lorsque nécessaires.

## CI

- [ ] `npm ci` vert sous Node 22.
- [ ] TypeScript strict vert.
- [ ] ESLint vert.
- [ ] Vitest vert.
- [ ] Build Vite vert.
- [ ] Budget mobile vert.
- [ ] Playwright mobile vert.

## Promotion

- [ ] PR Draft convertie en Ready uniquement après tous les points bloquants.
- [ ] Preview v0.2 testée sur le téléphone réel du testeur.
- [ ] Retours critiques corrigés et CI de nouveau verte.
- [ ] Tag/version de release préparé.
- [ ] Sauvegarde de la version stable précédente conservée.
- [ ] Seulement ensuite : fusion/promotion vers la version stable.
