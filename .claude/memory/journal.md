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

Première session sur le garage. La voiture flottait de 11,5 cm au-dessus de son plateau : `GarageScene` calculait sa hauteur avec les roues détendues alors que `CarModel` les affiche à l'assiette de repos. Elle utilise maintenant `carConfig.ride.height`. Ajout d'un bouton pause pour la rotation du plateau.

Les bavettes traversaient le sol pour la même raison, corrigé avec une garde au sol dans `carConfig.mudflaps`. Un pendule les a rendues dynamiques (validé sur la vraie simulation, jamais vu en course), puis Baptiste a demandé son retrait et gardé les hauteurs : les bavettes sont de nouveau fixes, dans le maillage de la caisse.

Ajout des commandes manette au garage (stick droit, RT/LT, A), testées avec une manette simulée et validées par Baptiste. Liste des couleurs dressée pour préparer la personnalisation : 4 couleurs de livrée déjà paramétrables, les autres en dur dans `buildCarGeometry`. Le choix des couleurs à exposer reste à faire. Rien n'est commité en fin de session.

**Entrées clés :**

- [BDR-20261101115823-1](decisions/BDR-20261101115823-1.md) — Bavettes fixes, pendule retiré
- [BDR-20261101115823-2](decisions/BDR-20261101115823-2.md) — Manette au garage : stick gauche et croix réservés
- [LRN-20261101115823-3](learnings/LRN-20261101115823-3.md) — Cotes du modèle : depuis les roues détendues, pas la route

---

Personnalisation de la voiture au garage. D'abord quatre sélecteurs de couleur natifs, puis, après essai de Baptiste à la manette, un menu pilotable et enfin une palette unique de 220 couleurs Tailwind, partagée par la souris, le clavier et la manette. A valide désormais la ligne sélectionnée et la rotation se met en pause depuis son bouton. Maintenir une direction fait défiler le menu. La livrée est sauvegardée et reprise en jeu. La caméra qui s'inversait au sommet à la manette se bloque maintenant comme à la souris (`makeSafe`). L'erreur d'hydratation venait de l'extension ColorZilla : `suppressHydrationWarning` ajouté sur `<body>`, sans pouvoir le confirmer ici. Le défilement n'a pas pu être testé jusqu'au bout car le panneau navigateur se fige : à essayer manette en main. Les plaques et numéros restent à faire. Commit `b0e5980`, sans push.

**Entrées clés :**

- [BDR-20261101131243-1](decisions/BDR-20261101131243-1.md) — une seule palette et un seul reducer au garage
- [BLK-20261101131243-2](blockers/BLK-20261101131243-2.md) — défilement manette non validé dans le panneau
