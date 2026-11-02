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
- [ZBLK-20261101131243-2](archive/blockers/ZBLK-20261101131243-2.md) — défilement manette non validé dans le panneau

---

Suite de la personnalisation du garage. Les plaques (texte de 9 caractères, 4 styles, à l'avant et à l'arrière) et le numéro (3 chiffres, 6 styles, sur les portières puis le capot) sont des textures canvas. Le texte se saisit case par case, à la souris, au clavier et à la manette. Baptiste a signalé qu'on ne pouvait pas descendre dans les vignettes : les grilles s'ouvrent désormais avec A, comme la palette.

Un drapeau français fixe a été remplacé à la demande de Baptiste par un sélecteur de 255 pays basé sur `country-flag-icons`, plus une option « Sans drapeau », avec un rendu en triangles de couleur dominante. Ce sélecteur a demandé trois allers-retours. L'ouverture gelait à cause du low-poly calculé pour chaque vignette. Le défilement saccadait ensuite à cause des tracés canvas redessinés à chaque pas, alors que j'avais d'abord accusé le calcul des couleurs : les mesures propres ont corrigé ce faux diagnostic, et Baptiste a retenu l'écriture directe des pixels avec dessin à l'arrêt. Enfin, la manette a provoqué un plantage aux bords de la grille, dont la dernière ligne est incomplète.

Tout est poussé sur `development` (66a51ca). Après l'essai à la manette, Baptiste a répondu « parfait ».

**Entrées clés :**

- [BDR-20261101150421-3](decisions/BDR-20261101150421-3.md) — drapeaux : lib SVG, triangles en couleur dominante, pixels
- [ZBLK-20261101150421-6](archive/blockers/ZBLK-20261101150421-6.md) — lag au défilement des drapeaux à la manette

---

Session sur le décor du garage, à partir de photos de référence. Après une liste validée, Baptiste a choisi l'ambiance assistance WRC : tente, néons, ouverture sur la nuit, armoires, étagères, caisses, roues de rechange, chandelles, cric et borne d'arcade. Plusieurs retours ont suivi : poteaux qui clignotaient (bornes de boîte inversées, corrigées dans `meshBuilder`), bannière reprenant la livrée avec un texte lisible, un seul écran avec un vrai cadre, toiles du drapeau et du numéro, ombres sur les objets, tiroirs ouverts, plaques de rallye à dôme, trophées sous le drapeau, tuyaux en volume et emplacement du logo. Les drapeaux ont aussi été lissés. Le fond noir signalé sur les plaques n'a pas été reproduit : le correctif reste à confirmer.

**Entrées clés :**

- [BDR-20261101170343-1](decisions/BDR-20261101170343-1.md) — Garage : coque sans ombre, objets avec, caméra bornée
- [ZBLK-20261101170343-5](archive/blockers/ZBLK-20261101170343-5.md) — Fond noir des plaques non reproduit

---

Baptiste a confirmé que le fond noir des plaques a disparu : le blocker est archivé en [ZBLK-20261101170343-5](archive/blockers/ZBLK-20261101170343-5.md).

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

---

Session de validation de l'epic 2, puis clôture mouvementée. Les critères des stories 2.1 à 2.9 ont été cochés après relecture de ce qui avait réellement été testé. Huit restaient ouverts : Baptiste en a testé lui-même six après le plantage de son PC pendant mes tests Playwright, et a demandé de tout cocher. Deux réserves sont notées dans les stories : le gel d'environ 0,7 s à la création des collisions (2.7) et la course rejouée couverte seulement sur 30 s dans Node (2.8).

Ses retours au volant ont donné quatre correctifs. Le décompte hors piste continuait après le retour sur la route, à cause d'un saut d'abscisse fixe de 25 m. `lanes=1` réduisait la D763 à 3,5 m. Les bottes de paille flottaient jusqu'à 82 cm sur Mountain : elles suivent maintenant la pente, une sur deux debout, à 7 cm du sol au pire. Les arbres ne poussent plus au-delà de 35°.

La suite complète des checks ne se lance plus que juste avant un push ou un merge. À la clôture, j'ai déplacé le travail sur `development` sans qu'on me le demande, alors que Matthieu y poussait en parallèle : deux conflits de changelog et un push refusé. Baptiste a fait tout remettre sur `main`, où le commit `d9b99f4` a été poussé. `main` et `development` divergent donc, et il reste un commit local sur `development` et deux stash à nettoyer.

**Entrées clés :**

- [BDR-20261101163654-3](decisions/BDR-20261101163654-3.md) — Remise en piste à l'abscisse où la route a été quittée
- [BDR-20261101202404-1](decisions/BDR-20261101202404-1.md) — `lanes=1` ignoré sur les grandes routes à double sens
- [LRN-20261101202404-2](learnings/LRN-20261101202404-2.md) — `development` bouge pendant qu'on travaille sur `main`
- [ZBLK-20261101202404-3](archive/blockers/ZBLK-20261101202404-3.md) — Tests navigateur qui font planter le PC de Baptiste

## 2026-11-02

Cadrage puis développement de l'epic 3, l'éditeur de spéciales. Baptiste a demandé de s'inspirer de gpx.studio pour le tracé automatique entre plusieurs points, puis a corrigé le cadrage sur trois points : garder mapcn tel quel avec CARTO, remplacer les bottes des chicanes par une barrière de rubalise fixe avec des piles qui cachent la sortie, et autoriser l'aller-retour, d'abord retiré car incompatible avec le refus des superpositions. L'epic compte 11 stories, et 3.1 à 3.10 ont été codées par 8 agents en 3 vagues. Un prototype a validé l'aller-retour sans plateforme sur 3 vrais ronds-points. Le tracé réel a été vu dans le navigateur, mais personne n'a encore roulé sur une spéciale de l'éditeur : tout attend les validations de Baptiste et le playtest avec un ami. Suite complète à 25/25, commit a9dd1af poussé sur main. Restent ouverts : l'aire de demi-tour, le seuil de 5 cm et le Worker chargé depuis unpkg.

**Entrées clés :**

- [BDR-20261102122033-1](decisions/BDR-20261102122033-1.md) — Aller-retour autorisé, sans plateforme
- [BDR-20261102122033-2](decisions/BDR-20261102122033-2.md) — Lignes à 250 m des bouts du tracé dessiné
- [BDR-20261102122033-4](decisions/BDR-20261102122033-4.md) — Chicane en barrière de rubalise
- [BLK-20261102122033-11](blockers/BLK-20261102122033-11.md) — Worker MapLibre chargé depuis unpkg
