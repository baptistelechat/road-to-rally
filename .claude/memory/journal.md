---
register: journal
---

## 2026-10-31

Découpage du PRD en feuille de route et en stories, puis lancement de l'epic 1 : socle Next.js 16, boucle à pas fixe et contrats partagés posés, puis subagents en parallèle sur la physique, le tracé, la voiture, les entrées, la caméra et le son. Installation de la mémoire du projet en cours de route.

**Entrées clés :**

- [BDR-001](decisions/BDR-001.md) — Next.js dès le socle
- [BDR-002](decisions/BDR-002.md) — Rapier déterministe en direct
- [BDR-003](decisions/BDR-003.md) — ordre du PRD et décor simple
## 2026-11-01

Fin de l'enquête sur le lag signalé en playtest : son qui saccade vers 5 minutes, puis énorme retard des entrées. Le mode diagnostic a reçu un historique de toute la session et un calcul de référence dans le Worker. Les tests sur le PC distant ont écarté la chauffe, le réseau et la vibration seule : le lag complet ne vient qu'avec le mode dev et le Bluetooth réunis. La production, réseau branché, tient 6 minutes sans lag. Pas de correctif : manette filaire en dev, ou production sur `:3001` en Bluetooth. Baptiste a aussi corrigé plusieurs de mes suppositions : le PC est toujours sur secteur, et la vue capot devait garder sa caméra. Premier commit du dépôt (`e62277e`), sans `scripts/debug-lap.ts`, script jetable resté non suivi. Les validations au volant de l'epic 1 restent à faire. Toutes les entrées de cette session restent locales, à la demande de Baptiste.

**Entrées clés :**

- [BLK-002](blockers/BLK-002.md) — Lag à 5 min en mode dev avec manette Bluetooth
- [LRN-003](learnings/LRN-003.md) — Lag : comparer dev et production, une variable par test
- [BDR-004](decisions/BDR-004.md) — Suspension par raycast Rapier, forces de pneus maison
---

Cadrage de l'epic 2 après la validation de l'epic 1, sans écrire de code. Le mode multi-user est activé sur le projet (`.multi-user`). L'ancienne liste de l'epic 2 devient neuf fiches dans `docs/stories/epic-2-pipeline-geo/`, écrites après lecture du code et tests réels des API IGN, Overpass et BRouter. Deux stories sont ajoutées : la 2.3, pour rouler tôt sur de vraies pentes parce que le jeu ne charge que le sandbox et que le chrono ne connaît que les boucles, et la 2.9, pour le playtest de passage. Baptiste a demandé d'analyser mapcn : son exemple utilise OSRM et non BRouter, et le composant ne fait qu'afficher les itinéraires. Il a aussi questionné le remplacement de l'altitude de BRouter : la mesure sur Turini et le besoin d'une grille pour le terrain confirment l'IGN. Le circuit reste, au choix avec une départementale et une montagne, en URL anglaises (`track`, `road`, `mountain`). Le dev de l'epic 2 n'est pas lancé : il attend le feu vert de Baptiste.

**Entrées clés :**

- [BDR-20261101115222-1](decisions/BDR-20261101115222-1.md) — L'IGN est la seule source d'altitude en jeu
- [BDR-20261101115222-2](decisions/BDR-20261101115222-2.md) — Circuit conservé et trois cartes de test
- [BDR-20261101115222-3](decisions/BDR-20261101115222-3.md) — Les tracés qui se croisent sont refusés en v0

---

Développement de l'epic 2 avec des subagents en parallèle : pipeline géo (GPX, relief IGN, largeurs OSM), tracé ouvert et largeur par point, terrain conforme par Delaunay contraint, Web Worker d'import, cache IndexedDB et empreinte. Le circuit reste identique au bit près, vérifié par 7 empreintes.

Le premier playtest de Baptiste a révélé ce que les contrôles ne voyaient pas : éventails de triangles, falaise au bord du couloir, arrivée en tremplin, recul au départ, remise en piste à l'atterrissage. Corrigés par un terrain gradué jusqu'à 1,5 km, le verrouillage au départ et le freinage à l'arrivée. J'ai d'abord contourné un contrôle en coupant le GPX et en ajoutant une ligne droite, refusé à juste titre : les fixtures portent maintenant 250 m de vrai tracé au-delà des lignes. L'arche restait dans le vide à cause d'une branche d'épingle à 7,9 m : l'arrivée est 120 m plus loin. React Doctor passe de 12 alertes à 6, toutes voulues, score 67.

Commit f8d08ae. Reste : le playtest complet de la story 2.9, Firefox, la génération de 15 km et le réseau coupé en pleine génération.

**Entrées clés :**

- [BDR-20261101163654-1](decisions/BDR-20261101163654-1.md) — vraie route au-delà des lignes
- [BDR-20261101163654-4](decisions/BDR-20261101163654-4.md) — terrain gradué jusqu'à 1,5 km
- [LRN-20261101163654-5](learnings/LRN-20261101163654-5.md) — arrivée loin des branches voisines
