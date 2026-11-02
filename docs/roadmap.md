# 🗺️ Feuille de route v0 : le bac à sable

Découpage du [PRD](prd.md) pour le premier jet : on trace, on génère, on roule, on partage le tracé et son temps.

**Règle d'or : on ne passe à l'epic suivant que si le critère de passage est atteint.** Le jeu vit ou meurt sur le pilotage.

## Epics

Les epics suivent l'ordre des phases du PRD.

| #   | Epic                                                                       | Critère de passage                                                    | Statut     |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------- |
| 1   | [Gameplay](stories/epic-1-gameplay/) : voiture, contrôles, tracé sandbox   | Tu as envie d'y rejouer 10 minutes sans rien d'autre                  | ✅ Validé  |
| 2   | [Pipeline géo](stories/epic-2-pipeline-geo/) : GPX vers route et relief 3D | Une vraie spéciale de 5 km roulable sans bug de maillage              | ✅ Validé  |
| 3   | [Éditeur sur carte](stories/epic-3-editeur/) : tracé assisté               | Un ami crée une spéciale sans ton aide                                | 🟡 À jouer |
| 4   | [Course](stories/epic-4-course.md) : chrono, fantôme, copilote             | Une spéciale complète se court du départ à l'arrivée, notes à l'heure | ⬜ À faire |
| 5   | [Décor](stories/epic-5-decor.md) : bâtiments et forêts depuis les données  | 60 FPS sur un portable moyen dans un village                          | ⬜ À faire |
| 6   | [Partage](stories/epic-6-partage.md) : tracé et temps dans l'URL           | Un ami ouvre le lien et tente de battre ton temps                     | ⬜ À faire |

Le détail suit la proximité : les epics 1 à 3 ont une fiche par story, les suivants une liste à préciser au moment de les attaquer, car ce qu'on apprendra sur la voiture les changera.

## Epic 1 : ordre des stories

| Story                                                    | Sujet                                 | Statut |
| -------------------------------------------------------- | ------------------------------------- | ------ |
| [1.1](stories/epic-1-gameplay/1.1-socle-technique.md)    | Socle technique et boucle à pas fixe  | ✅     |
| [1.2](stories/epic-1-gameplay/1.2-design-voiture.md)     | Design de la voiture low-poly         | ✅     |
| [1.3](stories/epic-1-gameplay/1.3-entrees.md)            | Couche d'entrées clavier et manette   | ✅     |
| [1.4](stories/epic-1-gameplay/1.4-physique-vehicule.md)  | Physique du véhicule                  | ✅     |
| [1.5](stories/epic-1-gameplay/1.5-camera.md)             | Caméras                               | ✅     |
| [1.6](stories/epic-1-gameplay/1.6-trace-sandbox.md)      | Tracé sandbox                         | ✅     |
| [1.7](stories/epic-1-gameplay/1.7-decor-sandbox.md)      | Décor sandbox simple                  | ✅     |
| [1.8](stories/epic-1-gameplay/1.8-reglage-feeling.md)    | Réglage du feeling (le gros morceau)  | ✅     |
| [1.9](stories/epic-1-gameplay/1.9-son-retours.md)        | Son et retours visuels                | ✅     |
| [1.10](stories/epic-1-gameplay/1.10-playtest.md)         | Chrono de tour et playtest de passage | ✅     |
| [1.11](stories/epic-1-gameplay/1.11-retours-playtest.md) | Retours du premier essai              | ✅     |

## Epic 2 : ordre des stories

| Story                                                         | Sujet                               | Statut |
| ------------------------------------------------------------- | ----------------------------------- | ------ |
| [2.1](stories/epic-2-pipeline-geo/2.1-lecture-gpx.md)         | Lecture et rééchantillonnage du GPX | ✅     |
| [2.2](stories/epic-2-pipeline-geo/2.2-relief-ign.md)          | Relief IGN et profil de route       | ✅     |
| [2.3](stories/epic-2-pipeline-geo/2.3-premiere-speciale.md)   | Première spéciale roulable          | ✅     |
| [2.4](stories/epic-2-pipeline-geo/2.4-largeur-route.md)       | Largeur de route et attributs OSM   | ✅     |
| [2.5](stories/epic-2-pipeline-geo/2.5-ruban-vraies-routes.md) | Ruban sur vraies routes             | ✅     |
| [2.6](stories/epic-2-pipeline-geo/2.6-terrain-couloir.md)     | Terrain et couloir aplani           | ✅     |
| [2.7](stories/epic-2-pipeline-geo/2.7-web-worker.md)          | Web Worker et import d'un GPX       | ✅     |
| [2.8](stories/epic-2-pipeline-geo/2.8-determinisme-cache.md)  | Déterminisme et cache               | ✅     |
| [2.9](stories/epic-2-pipeline-geo/2.9-playtest.md)            | Playtest de passage                 | ✅     |

## Epic 3 : ordre des stories

| Story                                                      | Sujet                                    | Statut |
| ---------------------------------------------------------- | ---------------------------------------- | ------ |
| [3.1](stories/epic-3-editeur/3.1-carte-recherche.md)       | Carte et recherche de lieu               | 🟡     |
| [3.2](stories/epic-3-editeur/3.2-trace-accroche.md)        | Tracé automatique entre plusieurs points | 🟡     |
| [3.3](stories/epic-3-editeur/3.3-garde-fous.md)            | Garde-fous du tracé                      | 🟡     |
| [3.4](stories/epic-3-editeur/3.4-du-trace-a-la-course.md)  | Du tracé à la course                     | 🟡     |
| [3.5](stories/epic-3-editeur/3.5-profil-altitude.md)       | Profil d'altitude                        | 🟡     |
| [3.6](stories/epic-3-editeur/3.6-score-trace.md)           | Score du tracé en direct                 | 🟡     |
| [3.7](stories/epic-3-editeur/3.7-aller-retour.md)          | Aller-retour sur la même route           | 🟡     |
| [3.8](stories/epic-3-editeur/3.8-chicanes.md)              | Chicanes automatiques                    | 🟡     |
| [3.9](stories/epic-3-editeur/3.9-edition-elements.md)      | Édition des éléments                     | 🟡     |
| [3.10](stories/epic-3-editeur/3.10-suggestion-variante.md) | Suggestion de variante (optionnelle)     | 🟡     |
| [3.11](stories/epic-3-editeur/3.11-playtest.md)            | Playtest de passage                      | ⬜     |

L'éditeur s'inspire de [gpx.studio](https://gpx.studio/fr/help/toolbar/routing) pour le tracé entre plusieurs points. Le parcours complet, de la carte au volant, fonctionne dès la story 3.4 : le reste s'y ajoute.

✅ validé · 🟡 code livré et vérifié par les tests, jugement au volant de Baptiste attendu · ⬜ à faire

## Décisions de cadrage

| Sujet            | Décision                                                                        | Pourquoi                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arcade ou simu   | Simcade                                                                         | Recommandation du PRD : tolérante, avec un transfert de masse crédible                                                                                   |
| Couverture       | France seule                                                                    | Décidé dans le PRD le 27/10                                                                                                                              |
| App              | Next.js 16 dès le départ, jeu en Client Component sans SSR                      | Éditeur, partage et backend futur vivront dans la même app, et changer de framework plus tard coûterait cher                                             |
| Physique         | `@dimforge/rapier3d-deterministic-compat` en direct, sans `@react-three/rapier` | Ce wrapper embarque `rapier3d-compat` 0.19.2 (non déterministe). La simulation doit pouvoir tourner sans rendu pour le fantôme et le futur rejeu serveur |
| Modèle voiture   | Construit par code                                                              | Pas de pipeline Blender à maintenir, couleurs par sommet, livrées faciles                                                                                |
| Décor            | Un décor simple en story 1.7, le décor complet en epic 5                        | La sandbox ne reste pas vide et la vitesse se sent, sans avancer le travail de la phase 5 du PRD                                                         |
| Géo sans backend | IGN et Overpass appelés depuis le navigateur, à la création de la spéciale      | Testé le 01/11 : les deux répondent avec CORS ouvert. Aucun appel en course                                                                              |
| Croisements      | Tracé refusé s'il se croise ou si deux chaussées se touchent, sauf aller-retour | `nearest` suppose une seule route à chaque position. Ponts et carrefours coûteraient cher pour un cas rare. L'aller-retour arrive en story 3.7           |
| Largeur          | Variable le long de la route, stockée par point                                 | Une route étroite et une départementale ne se conduisent pas pareil, et le contrat `Track` est encore facile à changer                                   |
| Cartes de test   | Circuit du sandbox gardé, au choix avec une départementale et une montagne      | Le circuit reste le banc d'essai du pilotage, les deux autres testent le pipeline sur de vraies routes                                                   |
| Altitude         | IGN pour la route et le terrain, jamais l'altitude de BRouter en jeu            | Le terrain demande une grille que BRouter ne donne pas, et deux sources différentes feraient flotter la route. Mesures dans la story 2.2                 |
| Lignes de course | Départ et arrivée à 250 m des extrémités du tracé dessiné                       | Toujours de la vraie route au-delà des lignes. Demander le prolongement à BRouter échoue trop souvent : détails dans la story 3.3                        |
| Aller-retour     | Autorisé en sens inverse, avec un retournement au bout (story 3.7)              | Demande de Baptiste : une route qui mène à un rond-point, le tour, puis le retour. Story la plus risquée de l'epic, elle commence par un prototype       |
| Fond de carte    | mapcn tel quel, avec ses tuiles CARTO                                           | Moins de bricolage. Licence payante en cas d'usage commercial : la prop `styles` permet de passer à OpenFreeMap en une ligne                             |
| Chicanes         | Barrière de rubalise fixe, bottes empilées derrière pour cacher la sortie       | Idée de Baptiste : foncer dedans ne paie plus, et la route se lit moins facilement                                                                       |

## Hors v0

Monde entier, classements en ligne, rallye multi-spéciales, réglages voiture exposés au joueur, comptes, anti-triche, multijoueur, météo, nuit.

Trois choses à préparer quand même dès la v0, sans construire la fonctionnalité : **pas de physique fixe, enregistrement des entrées, paramètres voiture dans un objet de config.**
