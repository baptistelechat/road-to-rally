# Maquettes retenues — Road to Rally

Copie versionnée des écrans retenus du canevas Claude Design **[Road to Rally — maquettes](https://claude.ai/artifact/Dh3SmdnDzXmsvCd99xBhgo)** (version `1793914389-cfeb`, 2026-11-05). Le canevas reste la version de travail. Ce dossier sert de référence pour intégrer les écrans en React + shadcn.

**Pour regarder les maquettes sans claude.ai** : ouvrir `road-to-rally-maquettes.html` dans un navigateur. C'est l'export HTML du canevas complet (Partager › Exporter › HTML) : page autonome qui fonctionne hors ligne, polices et écrans empaquetés, explorations A/B/C comprises. Elle n'est pas modifiable : pour une nouvelle version, refaire l'export et remplacer le fichier.

Les fichiers `.dc.html` sont des composants du canevas : ils ont besoin de son moteur (`support.js`) et ne s'ouvrent pas tels quels dans un navigateur. Pour les voir, ouvrir le canevas. Pour les intégrer, lire leur markup : les couleurs y sont en hex et doivent être remplacées par les tokens de `src/app/globals.css` (voir `docs/design/DESIGN.md`).

## Écrans

| Fichier                      | Écran                                                                                                           | Route           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------- |
| `R-Menu.dc.html`             | Menu de départ : bandeau facetté, cartes de tracés, bouton de départ                                            | `/`             |
| `R-Pause.dc.html`            | Pause en drawer road-book : carte, affichage, audio et copilote                                                 | `/` (Échap)     |
| `R-Depart.dc.html`           | Départ arrêté, décompte 3-2-1-GO sous l'arche                                                                   | `/`             |
| `R-HUD-Cockpit.dc.html`      | HUD Cockpit : tableau de bord bas, compteur Chiffres et LED                                                     | `/`             |
| `R-HUD-Cockpit-Rond.dc.html` | HUD Cockpit avec un compteur rond (Arc) au bout du tableau de bord                                              | `/`             |
| `R-HUD-Broadcast.dc.html`    | HUD Broadcast : habillage télé, compteur Télémétrie                                                             | `/`             |
| `R-Arrivee.dc.html`          | Résultat de la spéciale : secteurs, total, pénalités                                                            | `/`             |
| `R-Panneaux.dc.html`         | Planche : décompte, hors piste / sens interdit / remise en piste, pénalités, intermédiaires, frise des secteurs | `/`             |
| `R-Notes.dc.html`            | Planche : toutes les notes du copilote redessinées                                                              | `/`             |
| `R-Compteurs.dc.html`        | Planche : les 4 compteurs existants (Digital, Cadran, Arc, Télémétrie)                                          | `/`             |
| `R-Garage.dc.html`           | Garage : panneau de livrée numéroté                                                                             | `/garage`       |
| `R-Editeur-Liste.dc.html`    | Éditeur, mes spéciales                                                                                          | `/editor`       |
| `R-Editeur-Trace.dc.html`    | Éditeur, création d'un tracé                                                                                    | `/editor/trace` |

`canvas.json` est l'index complet du canevas : il garde la position de tous les écrans, y compris les explorations non retenues (A, B, C, base).

## Images (`/_blob/…`)

Les maquettes appellent leurs images par l'identifiant du canevas. Correspondance avec les fichiers :

| Identifiant                               | Fichier                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `/_blob/5c840cca25c32621cb8c69df16f16860` | `assets/scene-car.svg` (scène de jour avec la voiture, imite le décor du jeu) |
| `/_blob/ac72bf9d2e41631be25024721e914dd6` | `assets/day-scene.svg` (scène de jour sans voiture)                           |
| `/_blob/205abedfaaa23167dfa7ddd73ae8f236` | `assets/garage-scene.svg` (intérieur du garage)                               |
| `/_blob/475aba501031d911302f509db68a4298` | `assets/editor-map.svg` (carte stylisée, fond Sombre)                         |
| `/_blob/d070a4889de521396016d3a8b2b8940a` | `public/icon.svg`                                                             |
| `/_blob/c5e1ca6386460b5ea4c86122bb462674` | `public/brand/road-to-rally.svg`                                              |
| `/_blob/4860449a7e6f25772b9446f146a42b7d` | `public/brand/road-to-rally-line.svg`                                         |

Les décors (`assets/`) remplacent seulement le rendu 3D dans les maquettes : dans le jeu, la scène reste celle de Three.js.
