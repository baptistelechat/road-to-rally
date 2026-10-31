# 🗺️ Feuille de route v0 : le bac à sable

Découpage du [PRD](prd.md) pour le premier jet : on trace, on génère, on roule, on partage le tracé et son temps.

**Règle d'or : on ne passe à l'epic suivant que si le critère de passage est atteint.** Le jeu vit ou meurt sur le pilotage.

## Epics

Les epics suivent l'ordre des phases du PRD.

| #   | Epic                                                                         | Critère de passage                                                    | Statut     |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------- |
| 1   | [Gameplay](stories/epic-1-gameplay/) : voiture, contrôles, tracé sandbox     | Tu as envie d'y rejouer 10 minutes sans rien d'autre                  | 🟡 À jouer |
| 2   | [Pipeline géo](stories/epic-2-pipeline-geo.md) : GPX vers route et relief 3D | Une vraie spéciale de 5 km roulable sans bug de maillage              | ⬜ À faire |
| 3   | [Éditeur sur carte](stories/epic-3-editeur.md) : tracé assisté               | Un ami crée une spéciale sans ton aide                                | ⬜ À faire |
| 4   | [Course](stories/epic-4-course.md) : chrono, fantôme, copilote               | Une spéciale complète se court du départ à l'arrivée, notes à l'heure | ⬜ À faire |
| 5   | [Décor](stories/epic-5-decor.md) : bâtiments et forêts depuis les données    | 60 FPS sur un portable moyen dans un village                          | ⬜ À faire |
| 6   | [Partage](stories/epic-6-partage.md) : tracé et temps dans l'URL             | Un ami ouvre le lien et tente de battre ton temps                     | ⬜ À faire |

Le détail suit la proximité : l'epic 1 a une fiche par story, les suivants une liste à préciser au moment de les attaquer, car ce qu'on apprendra sur la voiture les changera.

## Epic 1 : ordre des stories

| Story                                                   | Sujet                                 | Statut |
| ------------------------------------------------------- | ------------------------------------- | ------ |
| [1.1](stories/epic-1-gameplay/1.1-socle-technique.md)   | Socle technique et boucle à pas fixe  | ✅     |
| [1.2](stories/epic-1-gameplay/1.2-design-voiture.md)    | Design de la voiture low-poly         | ✅     |
| [1.3](stories/epic-1-gameplay/1.3-entrees.md)           | Couche d'entrées clavier et manette   | ✅     |
| [1.4](stories/epic-1-gameplay/1.4-physique-vehicule.md) | Physique du véhicule                  | ✅     |
| [1.5](stories/epic-1-gameplay/1.5-camera.md)            | Caméras                               | 🟡     |
| [1.6](stories/epic-1-gameplay/1.6-trace-sandbox.md)     | Tracé sandbox                         | ✅     |
| [1.7](stories/epic-1-gameplay/1.7-decor-sandbox.md)     | Décor sandbox simple                  | 🟡     |
| [1.8](stories/epic-1-gameplay/1.8-reglage-feeling.md)   | Réglage du feeling (le gros morceau)  | 🟡     |
| [1.9](stories/epic-1-gameplay/1.9-son-retours.md)       | Son et retours visuels                | 🟡     |
| [1.10](stories/epic-1-gameplay/1.10-playtest.md)        | Chrono de tour et playtest de passage | ⬜     |
| [1.11](stories/epic-1-gameplay/1.11-retours-playtest.md) | Retours du premier essai | 🟡 |

✅ validé · 🟡 code livré et vérifié par les tests, jugement au volant de Baptiste attendu

## Décisions de cadrage

| Sujet          | Décision                                                                        | Pourquoi                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arcade ou simu | Simcade                                                                         | Recommandation du PRD : tolérante, avec un transfert de masse crédible                                                                                   |
| Couverture     | France seule                                                                    | Décidé dans le PRD le 27/10                                                                                                                              |
| App            | Next.js 16 dès le départ, jeu en Client Component sans SSR                      | Éditeur, partage et backend futur vivront dans la même app, et changer de framework plus tard coûterait cher                                             |
| Physique       | `@dimforge/rapier3d-deterministic-compat` en direct, sans `@react-three/rapier` | Ce wrapper embarque `rapier3d-compat` 0.19.2 (non déterministe). La simulation doit pouvoir tourner sans rendu pour le fantôme et le futur rejeu serveur |
| Modèle voiture | Construit par code                                                              | Pas de pipeline Blender à maintenir, couleurs par sommet, livrées faciles                                                                                |
| Décor          | Un décor simple en story 1.7, le décor complet en epic 5                        | La sandbox ne reste pas vide et la vitesse se sent, sans avancer le travail de la phase 5 du PRD                                                         |

## Hors v0

Monde entier, classements en ligne, rallye multi-spéciales, réglages voiture exposés au joueur, comptes, anti-triche, multijoueur, météo, nuit.

Trois choses à préparer quand même dès la v0, sans construire la fonctionnalité : **pas de physique fixe, enregistrement des entrées, paramètres voiture dans un objet de config.**
