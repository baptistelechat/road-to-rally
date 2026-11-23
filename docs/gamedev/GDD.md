# 🏁 Road to Rally — Game Design Document

> Ce qui **est** dans le jeu, reconstruit le 2026-11-21 depuis le [PRD](../prd.md), la [roadmap](../roadmap.md) et le code. Le PRD dit ce qu'on voulait ; ce document dit ce qui tourne. Les valeurs chiffrées renvoient à leur constante : **le code fait foi**, ce document dit où le trouver et pourquoi la valeur a été retenue. « ❓ à trancher » = non déductible du code, à décider par Baptiste.

Statut : **validé le 2026-11-21** (PR-2). Les trois ❓ ont été tranchés : téléphone, ambiance, public.

## 1. Concept

Rallye dans le navigateur. Le joueur trace une spéciale sur une vraie route de France, le jeu la génère en 3D low-poly (relief IGN, bâtiments, bois, eau), il la court au chrono avec un copilote, puis la partage par lien.

## 2. Piliers

1. **Le pilotage d'abord** : simcade, fun en 30 secondes, dur à maîtriser. Le pilotage prime sur tout.
2. **La route de chez soi** : n'importe quelle route de France devient une spéciale reconnaissable.
3. **L'identité rallye** : notes de copilote, chrono, arches, public, chicanes en bottes de paille.
4. **Zéro installation** : un lien suffit, la spéciale est régénérée de façon déterministe.

## 3. Boucle de jeu

Tracer (éditeur) → générer (Worker, cache IndexedDB) → choisir ambiance et options → départ arrêté (décompte) → courir avec notes et temps intermédiaires → arrivée, résultat, record local, fantôme → relancer ou partager (epic 6, à faire).

Cartes livrées : `track` (boucle sandbox, banc d'essai du pilotage), `road` (départementale des Landes, route de test), `mountain` (col de Turini), `notes` (banc des notes de copilote) — `src/game/maps.ts`. `road` et `mountain` sont figées à la version 6 du pipeline (01/11), la version actuelle est la 21 : ni décor BD TOPO ni chicanes (`scripts/bake-stage.ts` n'applique ni l'un ni l'autre). Voir PR-6.

## 4. Voiture (Caractère)

Une seule voiture, traction intégrale 50/50, 1 100 kg. Toutes les valeurs : `src/sim/carConfig.ts`.

| Métrique                | Valeur                                                      | Justification                      |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------- |
| Masse                   | 1 100 kg                                                    | Voiture de rallye légère           |
| Répartition du couple   | 50 / 50 (`driveShare`)                                      | 4RM                                |
| Répartition du freinage | 60 / 40 (`brakeShare`)                                      | Plonge au freinage, aide à pivoter |
| Rapports                | 5 (`engine.gears`), passage auto à 6 900 tr/min             | Arcade                             |
| Puissance équivalente   | `maxForce` 5 720 N : ~137 ch à la roue au passage de rapport, ~150 ch au rupteur, soit ~7,3 kg/ch (2026-11-23, PR-26) | Petite sportive de série (repère : 205 GTI 1.9, ~130 ch pour ~900 kg), loin d'une Groupe A (~300 ch). Repère à garder pour d'autres voitures |
| Rétrogradage forcé      | pied au plancher, si le rapport inférieur tourne sous 6 400 tr/min (`kickdownRpm`) | Tenir les côtes (B-16)             |
| 0 → 100 km/h            | cible 6 à 8 s · mesuré ~5 s pour 0 → 68                     | Story 1.8                          |
| Vitesse max             | cible ~170 km/h · mesuré 153 km/h à ~40 s                   | Story 1.8                          |
| Angle de braquage       | 0,6 rad, réduit à 0,16 rad à haute vitesse                  | Stabilité                          |
| Assistances             | contre-braquage 0,35, lacet max 2,2 rad/s, anti-tonneau 0,5 | Story 1.8                          |

Sensation validée par Baptiste : story 1.8 « acceptable pour le moment, à affiner plus tard ». Vitesse ressentie à 150 km/h : « juste » (T-1).

## 5. Caméra

Deux vues (`src/render/camera/cameraRig.ts`, `RIG_TUNING`) :

| Vue                | Réglages clés                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Poursuite (défaut) | 7 m derrière (+0,03 m par m/s), 2,25 m de haut, suit le vecteur vitesse à 80 % au-dessus de 6 m/s, FOV 60° + 14° avec la vitesse |
| Capot              | FOV 72°, 30 % du tangage et du roulis transmis                                                                                   |

## 6. Contrôles

Clavier et manette, appareil d'icônes = dernier utilisé (`src/input/`). L'aide aux commandes s'affiche tant que l'option `controlsHelpEnabled` est active (`src/game/copilotOptions.ts`, activée par défaut).

**Téléphone : bloqué en v0** (décidé le 2026-11-21). Un écran tactile seul n'est pas un poste de pilotage : `GameEntry.tsx` ne charge ni Three.js ni Rapier et affiche une page qui invite à passer sur ordinateur, en vocabulaire rallye (PR-7). Les commandes tactiles viendront avec une future version téléphone, et l'aide aux commandes sera repensée à ce moment-là.

## 7. Règles de course

| Règle                    | Valeur                                | Où                              |
| ------------------------ | ------------------------------------- | ------------------------------- |
| Pas de simulation        | 1/60 s fixe                           | `src/sim/fixedStep.ts`          |
| Décompte de départ       | 3 s                                   | `COUNTDOWN_S`, `simulation.ts`  |
| Remise en piste demandée | maintenir 3 s                         | `RESPAWN_HOLD_S`, `recovery.ts` |
| Hors piste               | remise auto après 3 s                 | `OFFROAD_LIMIT_S`               |
| Contresens               | 2 s de tolérance puis 3 s de décompte | `WRONG_WAY_*`                   |
| Pénalité par remise      | +5 s, pas sur le circuit              | `RESPAWN_PENALTY_MS`            |
| Temps intermédiaires     | 3 secteurs                            | `splits.ts`                     |
| Fantôme                  | rejoue les entrées enregistrées       | story 4.5                       |

## 8. Copilote

Notes calculées depuis la courbure (`src/sim/track/paceNotes.ts`) : rayons des degrés 20 / 35 / 55 / 85 / 130 m, « longue » au-delà de 100 m, « se resserre », crêtes, obstacles. Voix : mots enregistrés enchaînés (`src/audio/paceNoteWords.ts`), annoncés selon la vitesse (`paceNoteCue.ts`). Icônes de virage dans le HUD.

## 9. Surfaces

| Surface             | Adhérence     | Résistance au roulement     |
| ------------------- | ------------- | --------------------------- |
| Asphalte            | 1             | 0                           |
| Herbe               | 0,55          | 900                         |
| Eau (roue immergée) | jusqu'à −50 % | traînée selon la profondeur |

Décidé le 2026-11-21 (PR-4) : pas de nouvelle surface en v0. Ensuite, **bas-côtés en gravier**, puis **d'autres surfaces à adhérence variée** (terre, gravier, neige…) qui donneront un sens aux réglages.

## 10. Bible visuelle

- Low-poly facetté, couleurs par sommet, voiture construite par code.
- 5 ambiances (`src/render/look.ts`) : `afternoon` (fin d'après-midi), `morning`, `sunset`, `mist`, `dawn`. **`afternoon` verrouillée par défaut** le 2026-11-21 (PR-9), les autres restent au choix dans le menu.
- Couleurs du décor : `src/render/palette.ts`, jamais en dur dans les vues.
- Identité des menus : `docs/design/DESIGN.md`.

## 11. Son

Moteur synthétisé (Web Audio, presets dans `src/audio/enginePresets.ts`), pneus, herbe, vent, chocs, bip du décompte, voix du copilote, vibration manette.

**Public : à ajouter** (décidé le 2026-11-21, PR-8). Les spectateurs sont muets aujourd'hui ; ils doivent réagir au passage de la voiture (fiche dans l'audit, tour 2).

## 12. Budget de performance

- Critère : **60 FPS sur un portable moyen dans un village** (epic 5). À mesurer en production au moment de fermer l'epic 5 (PR-3).
- Décor par tranches de 200 m, visibles à moins de 800 m d'abscisse ou 350 m à vol d'oiseau, ombres portées à moins de 80 m (story 5.6).
- Relevé en mode dev le 2026-11-21 : ~100 appels de dessin, ~90 000 triangles par image.

## 13. Hors v0

Monde entier, classements, rallye multi-spéciales, réglages exposés, comptes, anti-triche, multijoueur, météo, nuit, version téléphone.
