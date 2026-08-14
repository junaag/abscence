# ABSENCE — v0.1.9

Build de test isolée de la version principale.

## Objectif

Faire passer les événements du monde d'une simple notification à des conséquences persistantes simulées.

## Ajouts

- effets persistants : eau au sol, fumée, départ de feu, bruit continu ;
- évolution de l'intensité avec le temps ;
- propagation simple entre lieux connectés ;
- interactions du joueur : stopper une fuite, éponger, aérer, couper une source de bruit, utiliser de l'eau sur un feu ;
- stress, douleur et santé influencés par les situations locales ;
- Santé en PV 0–100, autres besoins en % ;
- pomme : -9 % faim et -4 % soif ;
- sauvegarde séparée de la preview 0.1.8 (`absence-preview-v019`).

## Scénario vertical de test

Des événements sont planifiés au début de partie pour rendre la fonctionnalité observable : bruit continu, fuite d'eau, puis fumée. L'écran **Monde** permet aussi d'avancer le temps et de créer un départ de feu de test.

La carte reste volontairement géographique : les dangers et ressources internes restent dans le moteur et ne sont pas affichés comme marqueurs de carte.
