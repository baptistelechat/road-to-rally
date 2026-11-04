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

---

Son du moteur à l'arrivée sur le jeu : le navigateur exige un geste avant tout son, et une manette n'en est pas un. Après une tentative de message dans le HUD et une recommandation de PWA écartée grâce au retour d'expérience sur Pawzzle, on a retenu un menu de départ. Le sélecteur de carte y a été déplacé, puis le menu a aussi servi de menu pause avec Échap et Start, la simulation restant gelée hors course. Baptiste a fait retirer tous les textes d'aide : l'interface doit se comprendre seule. Le menu est commité et poussé (`0fda8ba`), avec checks, lint, build et react-doctor au vert. Baptiste a validé le son, la pause, Échap, ainsi que A et Start à la manette.

**Entrées clés :**

- [BDR-20261101191443-4](decisions/BDR-20261101191443-4.md) — Menu de départ et de pause, simulation gelée hors course
- [LRN-20261101191443-1](learnings/LRN-20261101191443-1.md) — Une manette ne débloque pas l'audio du navigateur
- [ZBLK-20261101191443-6](archive/blockers/ZBLK-20261101191443-6.md) — Boutons A et Start du menu non testés à la manette

---

Baptiste a essayé le menu de départ et de pause dans son navigateur : le son, la pause, Échap, ainsi que A et Start à la manette fonctionnent. Le blocker de test est donc résolu et archivé. Reste ouvert le blocage de `next dev` dans le navigateur intégré, sans incidence sur le jeu dans Chrome.

**Entrées clés :**

- [ZBLK-20261101191443-6](archive/blockers/ZBLK-20261101191443-6.md) — Boutons A et Start du menu non testés à la manette

---

Session manette en jeu. Ajout de la rotation de la caméra de poursuite au stick droit, avec retour derrière la voiture au relâchement. Baptiste a ensuite signalé qu'il ne pouvait plus tourner : jamais reproduit en vue poursuite, seulement en vue capot, où la rotation est ignorée. Il a confirmé que l'absence de rotation en vue capot lui convient, sans que la cause de son signalement soit établie.

Le menu pause ne se pilotait pas à la manette : A reprenait la course d'office. Ajout de la navigation par focus, d'un bouton pour couper le son et de B pour fermer. Le choix de carte a été livré en gauche/droite, puis refusé par Baptiste comme pas clair : il est passé à une liste maison qui s'ouvre avec A, à la place du `select` natif, et Baptiste a validé ses tests à la manette. Ce modèle existait déjà au garage et aurait dû être suivi dès le départ.

`react-doctor` a signalé 2 alertes, corrigées avant le commit en sortant `applyMenuAction.ts` du fichier de composant et en donnant un rôle au conteneur de la liste. Ces corrections n'ont pas été rejouées en jeu. Commit `213e55f` poussé sur `development`.

**Entrées clés :**

- [BDR-20261101201935-1](decisions/BDR-20261101201935-1.md) — Caméra de course : stick droit, retour au relâchement
- [BDR-20261101201935-2](decisions/BDR-20261101201935-2.md) — Menu pause à la manette : focus, A pour ouvrir, B pour revenir
---

Session sur le son du moteur, jugé trop synthétique. Après quatre pistes proposées, Baptiste a demandé une page de test des trois caractères (4 cylindres atmo, 4 cylindres turbo, 5 cylindres) en synthèse enrichie, avec frein moteur, pétarades, résonance d'échappement, admission, mécanique et saturation. La page `/labo-son` a été construite avec une voix moteur séparée de la simulation.

Baptiste a ensuite choisi d'en faire une personnalisation au garage : trois sélecteurs avec une démo, un choix stocké dans la livrée et joué en course. Il a demandé en cours de route de garder la page labo pour de futurs moteurs. Après essai, deux retours : pas de retour visuel à la validation à la manette, corrigé par une pastille sur le moteur validé, et un turbo trop présent en accélération, corrigé par une turbine qui garde son élan et un niveau lié à sa montée en régime. Le rendu de cette dernière correction n'a pas été confirmé à l'oreille pendant la session, et la manette réelle n'a pas été testée.

Commit `2d0dc73` poussé sur `development`. GitHub a affiché que les changements doivent passer par une pull request, mais le push a été accepté.

**Entrées clés :**

- [BDR-20261101233659-1](decisions/BDR-20261101233659-1.md) — moteur choisi au garage, stocké dans la livrée
- [BDR-20261101233659-2](decisions/BDR-20261101233659-2.md) — labo son conservé pour les futurs moteurs
- [LRN-20261101233659-4](learnings/LRN-20261101233659-4.md) — un son continu se juge en course, pas sur une démo

## 2026-11-02

Cadrage puis développement de l'epic 3, l'éditeur de spéciales. Baptiste a demandé de s'inspirer de gpx.studio pour le tracé automatique entre plusieurs points, puis a corrigé le cadrage sur trois points : garder mapcn tel quel avec CARTO, remplacer les bottes des chicanes par une barrière de rubalise fixe avec des piles qui cachent la sortie, et autoriser l'aller-retour, d'abord retiré car incompatible avec le refus des superpositions. L'epic compte 11 stories, et 3.1 à 3.10 ont été codées par 8 agents en 3 vagues. Un prototype a validé l'aller-retour sans plateforme sur 3 vrais ronds-points. Le tracé réel a été vu dans le navigateur, mais personne n'a encore roulé sur une spéciale de l'éditeur : tout attend les validations de Baptiste et le playtest avec un ami. Suite complète à 25/25, commit a9dd1af poussé sur main. Restent ouverts : l'aire de demi-tour, le seuil de 5 cm et le Worker chargé depuis unpkg.

**Entrées clés :**

- [BDR-20261102122033-1](decisions/BDR-20261102122033-1.md) — Aller-retour autorisé, sans plateforme
- [BDR-20261102122033-2](decisions/BDR-20261102122033-2.md) — Lignes à 250 m des bouts du tracé dessiné
- [BDR-20261102122033-4](decisions/BDR-20261102122033-4.md) — Chicane en barrière de rubalise
- [BLK-20261102122033-11](blockers/BLK-20261102122033-11.md) — Worker MapLibre chargé depuis unpkg

---

Session sur le confort de l'éditeur et le rendu des chicanes, itérée avec Baptiste au volant. La carte reçoit trois fonds (satellite par défaut, clair, sombre), le relief, la boussole et la localisation. L'éditeur est réorganisé : `/editor` devient un accueil qui liste les spéciales d'IndexedDB, `/editor/trace` porte la carte, et une spéciale garde son tracé pour pouvoir être modifiée, la nouvelle version remplaçant l'ancienne. Une page `/my-stages` a existé le temps d'un échange avant d'être fondue dans cet accueil.

Côté chicanes : deux rangs de bottes à 2,2 m, chevrons, et un panneau d'annonce refait trois fois. Rond bleu d'abord, puis triangle sans éclairage rejeté comme « PNG plaqué », enfin tôle éclairée, avec le dessin inversé après un retour au volant. Le clignotement est corrigé en supprimant les faces superposées. Le recalage manuel n'était pas un défaut de données : le marqueur restait sous le pointeur.

Avant le push, la suite complète a échoué sur `fingerprint` et `geo` : le passage à `PIPELINE_VERSION` 6 demandait de régénérer les spéciales livrées. Après `pnpm bake:stages`, 25/25, et `main` poussé avec `aa4506a` et `aeddf40`. Pendant un test, tout le stockage des spéciales du navigateur intégré à l'app a été vidé au lieu des seules entrées d'essai ; signalé à Baptiste, et les tests suivants n'ont retiré que leurs entrées.

**Entrées clés :**

- [BDR-20261102162710-1](decisions/BDR-20261102162710-1.md) — La spéciale garde son tracé, la rouler à nouveau la remplace
- [BDR-20261102162710-2](decisions/BDR-20261102162710-2.md) — Panneau d'annonce : le dessin suit le premier écart du pilote
- [LRN-20261102162710-3](learnings/LRN-20261102162710-3.md) — Changer PIPELINE_VERSION impose pnpm bake:stages

---

Point sur l'epic 3, puis longue passe de playtest : Baptiste jouait et envoyait ses remarques, corrigées à chaud sans aucune commande lourde.

Le changement de fond porte sur les lignes de course. Le premier point devient le départ et le dernier l'arrivée, avec un prolongement ajouté au-delà. Le chemin a été heurté : la ligne droite de secours a traversé des bâtiments et Baptiste l'a refusée, alors qu'une décision l'avait déjà écartée. Un refus venait d'un prolongement jamais revérifié quand le tracé grandissait, un autre de la rue piétonne que le profil voiture contourne : 1 052 m contre 276 m à Clisson, trouvé en rejouant le cas sur le vrai BRouter.

Le reste : calque routes IGN sur le satellite, modes Éditer et Déplacer, marqueurs qui ne bloquent plus la prise d'un point, panneau du jeu sur les chicanes, clic pour centrer la carte, alertes de chicane cliquables et conservées, zones de 100 m réutilisables. L'écart entre chicanes est passé par 50 et 80 m avant 100 m, une fois le panneau d'annonce recalculé.

À la fermeture, lint, build et six vérifications passent, après correction de deux tests qui supposaient l'ancien format. Commit `024cd2e`, sans push. La suite complète et les vérifications navigateur restent à faire.

**Entrées clés :**

- [BDR-20261102212945-1](decisions/BDR-20261102212945-1.md) — Premier point au départ, dernier à l'arrivée, 200 m au-delà
- [BDR-20261102212945-2](decisions/BDR-20261102212945-2.md) — Chicanes : zones de 100 m, ponts et tunnels ignorés
- [ZBLK-20261102212945-5](archive/blockers/ZBLK-20261102212945-5.md) — Vérifications navigateur de l'epic 3 encore à faire

---

Règle durcie par Baptiste après des checks lancés sans lui demander à la fermeture : plus aucun `pnpm check:determinism` sans son accord, même partiel ou avant un push. Commit `8db0b4b`.

---

Session sur les animations en course. Baptiste voulait de petites explosions à l'échappement : six pistes proposées, puis flammes calées sur les détonations du son, à-coup de la caisse et de la caméra aux passages de rapport, mottes d'herbe et disques de frein rougeoyants. Ses essais ont révélé que les pédales brutes de la marche arrière faisaient rougir les disques et multipliaient les flammes : corrigé à la source dans `vehicle.ts`, ce qui a aussi réglé les feux stop et le son en recul. Le menu de départ se parcourt maintenant à la manette, validé par lui sur sa vraie manette. Ajout de feux de recul (feux coupés gardés, feux de pare-chocs retirés après essai), puis d'un crissement de pneus : la première version à oscillateurs miaulait, refaite en bruit filtré et réglable dans `/labo-son`, timbre Rauque retenu puis baissé d'environ 2 dB. Enfin, étincelles sur choc, vues en jeu contre un poteau du portique. Baptiste signale que son bug de son au démarrage a disparu sans explication : aucun changement connu ne le justifie, il peut revenir. Transfert de masse accentué et vibration moteur restent en attente de sa décision. Commit `59ffb65` poussé sur `development`.

**Entrées clés :**

- [BDR-20261102121514-1](decisions/BDR-20261102121514-1.md) — Effets de course calés sur le son, côté rendu
- [BDR-20261102121514-2](decisions/BDR-20261102121514-2.md) — CarState donne la charge et le serrage réels, pas les pédales
- [LRN-20261102121514-4](learnings/LRN-20261102121514-4.md) — Un crissement à notes pures miaule

---

Session de cadrage du copilote, sans code. Baptiste étant sur l'epic 3, le copilote de l'epic 4 a été retenu comme chantier indépendant. Les fiches 4.6, 4.7 et 4.8 ont été écrites, puis revues : voix en mots enregistrés au lieu de `speechSynthesis`, plus aucun saut de note, mot « enfilade » pour les passages très serrés, et trois nouvelles fiches : icônes de virage (4.9), mini-carte (4.10) et options (4.11). Une piste d'essai « Pace notes » est prévue dans le sélecteur, car aucune piste actuelle n'a de note 6. La première version annonçait une marge faible en montagne : le calcul à rebours a montré que tout tient à l'heure. Ces chiffres restent des estimations, à confirmer au volant. La provenance de la voix reste à choisir. Fiches commitées dans `85fd78c`, sans push.

**Entrées clés :**

- [BDR-20261102200843-1](decisions/BDR-20261102200843-1.md) — copilote en parallèle de l'epic 3
- [BDR-20261102200843-2](decisions/BDR-20261102200843-2.md) — voix en mots enregistrés
- [BDR-20261102200843-3](decisions/BDR-20261102200843-3.md) — tous les virages annoncés
- [LRN-20261102200843-4](learnings/LRN-20261102200843-4.md) — l'écart entre virages ne mesure pas le temps de parole

---

Développement des stories 4.6 à 4.11 du copilote, découpé en lots confiés à des subagents : calcul des notes et carte « Pace notes », voix en mots enregistrés, moment des annonces, branchement dans la boucle de jeu, icônes, mini-carte et panneau d'options. La provenance de la voix a pris le plus de temps : Piper, seule famille testée d'abord pour sa licence claire, donnait des annonces courtes incomprises par une transcription, alors qu'une voix Windows témoin passait. Kokoro (`ff_siwis`) a passé le test, et le script de génération est gardé dans le dépôt pour ajouter des mots plus tard.

Les vraies durées des mots (0,585 s contre 0,38 s estimées) ont révélé un retard au départ de `mountain` et des contrôles trop optimistes. Le contrôle utilise maintenant les fichiers réels. L'exception du départ couvre les phrases enchaînées sans pause, et le cumul de la diction lente et de l'allure ×1,6 n'est pas garanti. La mini-carte est activée par défaut à la demande de Baptiste. Le code est poussé (`e6d96de`), avec 22/22 contrôles passés. Rien n'a été testé dans un navigateur : Baptiste fait les tests et donnera ses retours à la prochaine session sur la mini-carte, la voix et les icônes.

**Entrées clés :**

- [BDR-20261102224247-1](decisions/BDR-20261102224247-1.md) — Voix du copilote générée avec Kokoro
- [LRN-20261102224247-2](learnings/LRN-20261102224247-2.md) — Tester une voix de synthèse par transcription, avec témoin

## 2026-11-03

Session de retours de jeu sur l'éditeur et les spéciales. Correction d'abord d'une erreur React de clé en double dans le panneau des chicanes : avant la fin de l'analyse, toutes les chicanes tombaient au point 0 et produisaient des alertes « 0 m » identiques. Puis le rayon minimal de virage est passé de 8 à 5 m, pour que les carrefours en épingle restent proches de la vraie route.

Gros morceau : les ronds-points. Détection par le tag OSM `junction` (Overpass pour la spéciale, arcs BRouter pour l'éditeur), cercle ajusté, îlot incassable en barrière de rubalise, cercle rouge sur la carte de l'éditeur. Il a fallu plusieurs allers-retours : brouillon de l'éditeur sans le nouveau tag, cache IndexedDB qui resservait l'ancienne spéciale faute d'incrément de version, barrière calée sur l'axe qui mordait sur l'asphalte des routes larges, et enfin cercle posé à plat qui flottait et s'enterrait sur un rond-point en pente (Gétigné, avenue Xavier Rineau). La règle finale : barrière à 0,5 m du bord roulé, modules posés sur le sol.

Marquage : une ligne pointillée entre chaque paire de voies, le nombre de voies venant des tags OSM et non plus de la largeur, après correction de Baptiste. Commit `2ff34f8` (PIPELINE_VERSION 12). Reste à faire : `pnpm bake:stages`, puis les checks `fingerprint` et `geo`, avec l'accord de Baptiste.

**Entrées clés :**

- [BDR-20261103205616-1](decisions/BDR-20261103205616-1.md) — Îlot de rond-point : tag junction, hors de la route roulée
- [BDR-20261103205616-2](decisions/BDR-20261103205616-2.md) — Pointillés selon les voies OSM, jamais selon la largeur
- [ZBLK-20261103205616-7](archive/blockers/ZBLK-20261103205616-7.md) — Barrière d'îlot « dans la route » : c'était le relief

---

Point d'avancement de l'epic 3, puis nettoyage des warnings du terminal de dev. La clé React dupliquée venait des alertes d'écart de chicanes calculées sur l'axe du tracé d'avant pendant la ré-analyse (alertes masquées tant que `analyzing`, clé par rang). Le warning PCFSoftShadowMap est réglé par `shadows="percentage"` sur les quatre `<Canvas>`, et `THREE.Clock` vient de R3F lui-même. Passe navigateur en dev sur le Col de Turini : aucun appel Google, attribution lisible, garde-fou de distance, panne BRouter simulée avec Réessayer, vraie panne Overpass avec « Rouler quand même », parcours jusqu'au volant et retour avec chicanes conservées. Elle a trouvé un bug de focus clavier dans la liste des chicanes (clé construite sur le libellé), corrigé, et laissé quelques défauts ouverts. Baptiste a ensuite marqué tout l'epic 3 comme validé pour passer à l'epic 4. react-doctor sans remarque, commit c2d802c sans push.

**Entrées clés :**

- [BDR-20261103211811-1](decisions/BDR-20261103211811-1.md) — Epic 3 validé sans son critère de passage
- [BLK-20261103211811-5](blockers/BLK-20261103211811-5.md) — Défauts relevés à la passe navigateur de l'epic 3

---

Session de corrections sur l'epic 4, centrée sur les panneaux du copilote. Méthode demandée par Baptiste : des propositions visuelles en maquettes, sa validation, puis l'intégration sur son « go ». Les icônes deviennent des pilules colorées selon la note, avec un badge LONG, une pastille bicolore et une flèche en spirale pour les virages qui se resserrent. La note d'entrée s'affiche en gros et la sortie en indice. Crête et bosse passent en pilules rouges, après trois séries de dessins pour la crête (vue du pilote retenue), et les enfilades reçoivent un cadre avec un zigzag, ouvert quand elles dépassent la bande.

En vérifiant le code, il est apparu que la note d'un virage qui se resserre était déjà celle de la sortie : ajout de `entryGrade`, la voix dit maintenant « quatre se resserre ». Baptiste a aussi constaté que seule la note la plus dure d'une enfilade était annoncée : chaque virage l'est désormais, avec un raccourci qui retire le mot « enfilade » en cas de retard. Enfin, il entendait trop de crêtes : le seuil passe de 150 à 100 m après mesure sur la montagne.

La voix (Kokoro, « long » au lieu de « longue ») est reportée à une session dédiée, sans rien installer d'ici là. React-doctor a relevé 3 alertes sur les fichiers modifiés, corrigées. Commit e887a76 poussé sur development.

**Entrées clés :**

- [BDR-20261103202354-1](decisions/BDR-20261103202354-1.md) — Panneaux du copilote en pilule colorée
- [BDR-20261103202354-2](decisions/BDR-20261103202354-2.md) — Resserrement annoncé avec la note d'entrée
- [BDR-20261103202354-3](decisions/BDR-20261103202354-3.md) — Crête : rayon vertical sous 100 m
- [BLK-20261103202354-5](blockers/BLK-20261103202354-5.md) — Modèles Kokoro absents : « long » non régénéré

---

Refonte de la mini-carte. Quatre directions ont été maquettées (globale soignée, zoom nord en haut, zoom cap en haut, hybride), puis Baptiste a voulu les quatre en option. Le parcouru est en ambre et la route à venir en gris, avec une flèche orientée, un départ vert et un damier à l'arrivée. Au premier test, le trait ambre partait devant la voiture : `non-scaling-stroke` calculait les pointillés en pixels, et en pente `s` en 3D avançait plus vite que le trait à plat. La progression passe maintenant par `routeS()`, exposé en lecture seule sur la simulation, et par la longueur à plat du tracé. Un léger lag dans les cartes tournantes a disparu en passant de 10 Hz à `requestAnimationFrame`. Parmi cinq propositions, la boussole à aiguille a été retenue pour la carte nord en haut.

Ajout d'une balance audio : bus moteur et effets devant le master, voix à part, trois curseurs à crans de 10 % jouables à la manette, sans phrase de test. La suite de déterminisme échouait parce que le nouveau `mini-map.check.ts` n'avait pas d'`export default`. Baptiste a coupé le déterminisme et le build : il fait les tests lui-même. Commit `da4244d` poussé sur `development`.

**Entrées clés :**

- [BDR-20261103211134-2](decisions/BDR-20261103211134-2.md) — Mini-carte : quatre styles, parcouru sur la longueur à plat
- [BDR-20261103211134-3](decisions/BDR-20261103211134-3.md) — Balance audio : bus moteur et effets, voix à part

## 2026-11-04

Session éditeur, partie en mode Rodin. Baptiste trouvait l'éditeur peu intuitif. Le profil d'altitude a reçu des graduations en distance et en altitude, puis les points, les chicanes et leur zone jaune, les ronds-points, les rochers et la plus longue ligne droite (désormais toujours en vert sur la carte), tous cliquables pour centrer la carte, zoom porté à 17. La limite de 2 km, sans raison technique, est passée à 500 m.

L'éditeur a ensuite été refondu : un seul mode au lieu d'Éditer/Déplacer, avec une tolérance de clic à 8 px, une marge autour des marqueurs et aucun point créé en fermant un menu ou en cliquant sur une zone de chicane. Le panneau droit a disparu au profit d'une barre du haut, de popovers Points, Chicanes et Légende (au survol) et d'un bandeau de stats avec le score en fenêtre. Un seul jeu de symboles relie maintenant légende, carte et courbe. Sur fond clair, la route roulée passe en bleu nuit.

Les petits giratoires de l'avenue Bollée au Mans étaient bien tagués mais écartés, trop petits pour un îlot : ils reçoivent un rocher. Les ronds-points disparus en jeu venaient d'Overpass saturé, d'où un secours BRouter pour les spéciales de l'éditeur. Le vrai sujet, un même lien donnant deux routes selon le jour, est noté dans l'epic 6 avec les options d'un lien figé (Vercel Blob recommandé, backend à trancher). Commit `3fa14f7` sur `development`, sans push ni check de déterminisme.

**Entrées clés :**

- [BDR-261104_1032-1](decisions/BDR-261104_1032-1.md) — Éditeur en un seul mode
- [BDR-261104_1032-2](decisions/BDR-261104_1032-2.md) — Éditeur sans panneau latéral
- [BDR-261104_1032-3](decisions/BDR-261104_1032-3.md) — Secours BRouter quand Overpass ne répond pas
- [LRN-261104_1032-5](learnings/LRN-261104_1032-5.md) — Overpass saturé : spéciale sans ronds-points ni largeurs

---

Rendu satellite de l'éditeur retravaillé : les noms de rue du raster IGN `TRANSPORTNETWORKS.ROADS`, incrustés dans l'image, prenaient trop de place. Après une série de propositions (opacité, routes vectorielles, bouton, autre fond satellite), Baptiste a retenu les routes OSM vectorielles d'OpenFreeMap sur l'orthophoto, une opacité qui diminue avec le zoom et un bouton « Routes ». Les noms n'apparaissent plus qu'à partir du zoom 16. Ses retours ensuite : fonds réordonnés en Clair, Sombre, Satellite, bouton Routes déplacé à gauche de « Légende », et une erreur « Cannot style non-existing layer » au changement de fond, corrigée par un garde `getLayer`. React-doctor a relevé une valeur de contexte non mémorisée (corrigée, score 100). Commit `eda08f7`, non poussé. Rendu non vérifié à l'écran par Claude, car le serveur de dev de Baptiste occupait le port 3000.

**Entrées clés :**

- [BDR-261104_1456-1](decisions/BDR-261104_1456-1.md) — Routes du satellite en vecteur OSM, pas en raster IGN
- [LRN-261104_1456-2](learnings/LRN-261104_1456-2.md) — mapcn : l'effet voit encore l'ancien style au changement de fond
---

Le score de l'éditeur tient désormais tout entier dans le bandeau au-dessus du profil : la fenêtre « Score détaillé » est retirée, épingles et ligne droite max (surlignage au survol) remontent, et le verdict « route sinueuse », simple traduction des virages par km, n'est plus affiché.

Gros morceau ensuite : l'alerte récurrente « deux portions de route se touchent » sur les crochets BRouter en ville (carrefour en T, demi-tour au rond-point, retour devant le carrefour). L'aller-retour existant n'acceptait qu'un retour vers le départ. Baptiste a choisi l'option terre-plein : tout tronçon roulé dans les deux sens devient deux chaussées de 5 m séparées par 2 m de terre-plein et une glissière solide, en « roulant à droite » depuis le milieu des deux passages. La sim n'y voit qu'une spéciale ouverte ordinaire plus des glissières (`medians`). Première version validée sur un T synthétique, mais l'alerte restait sur la spéciale du Mans : en récupérant le brouillon via `/api/diag`, il est apparu que l'avenue Bollée a deux chaussées OSM à 8 m (tram) et un mini-giratoire à 256° de virage. Tolérance portée à 10 m, écart complété seulement de ce qui manque, boucle à 225° minimum. Baptiste a validé au volant, les checks n'ont pas été lancés à sa demande (le nouveau `dual-carriageway.check.ts` n'a jamais tourné). react-doctor à 91, commit `95fee94` sur `main`, sans push.

**Entrées clés :**

- [BDR-261104_1546-1](decisions/BDR-261104_1546-1.md) — aller-retour en milieu de spéciale : deux chaussées, glissière
- [BLK-261104_1546-5](blockers/BLK-261104_1546-5.md) — alerte persistante sur le tracé du Mans
- [LRN-261104_1546-4](learnings/LRN-261104_1546-4.md) — reproduire un tracé éditeur via `/api/diag`
---

La glissière des terre-pleins devient visible dans l'éditeur : trait rose sur la carte, bande et icône sur le profil (aller, demi-tour, retour), ligne dans la légende. Vérifié sur la spéciale du Mans dans Chrome, où un clic raté a posé un point sur le vrai brouillon, aussitôt annulé. react-doctor à 91, commit `4d80e37` sur `main`, sans push.

**Entrées clés :**

- [LRN-261104_1546-6](learnings/LRN-261104_1546-6.md) — vérifier l'éditeur dans Chrome modifie le vrai brouillon
