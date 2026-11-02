# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Spéciale sandbox jouable au clavier et à la manette, avec voiture low-poly, décor et chrono au tour
- Vue poursuite et vue capot
- Son du moteur et de la route, vibration de la manette et effets visuels
- Remise en piste maintenue, retour automatique hors piste et à contresens
- Bottes de paille, plots et panneaux renversables
- Bouton pour relancer le tour et aide selon le périphérique actif
- Blocage du jeu sur téléphone
- Compteurs de performance et capture de diagnostic avec `F9` ou `LB`
- Garage sur `/garage` : voiture sur plateau tournant avec pause, caméra à la souris et à la manette
- Personnalisation de la voiture au garage : carrosserie, bas de caisse, accents et jantes, avec une palette de 220 couleurs Tailwind à la souris, au clavier et à la manette, conservée en jeu
- Plaques personnalisables au garage, à l'avant et à l'arrière : texte de 9 caractères et 4 styles
- Numéro personnalisable au garage, sur les portières et le capot : 3 chiffres et 6 styles
- Drapeau de 255 pays sur les flancs arrière, redessiné en style low-poly, avec une option sans drapeau
- Décor de tente d'assistance autour de la voiture au garage : bannière, drapeau et numéro aux couleurs de la livrée, écran avec l'heure réelle, plaques de rallye, trophées, étagères et armoires à outils
- Emplacement réservé au logo du jeu dans le garage
- Sélecteur de carte avec deux vraies routes de France, Road et Mountain, et un record par carte
- Vrai relief low-poly autour de la route, largeur de route selon OpenStreetMap
- Spéciales du départ à l'arrivée : la voiture attend le premier coup de gaz, puis s'arrête seule après la ligne
- Import d'un fichier GPX pour générer sa propre spéciale, avec progression, annulation et réouverture hors ligne
- Remise en piste à l'endroit où la route a été quittée sur une spéciale
- Aperçu de chaque piste avec `/track-preview?map=`
- Menu de départ avant chaque course, avec le bouton « Prendre le départ »
- Menu pause avec `Échap` ou `Start` : la course se fige et le son se coupe, avec reprise, relance et choix de la carte
- Rotation de la caméra autour de la voiture en course avec le stick droit, en vue poursuite : elle revient derrière la voiture au relâchement
- Menu pause entièrement utilisable à la manette : haut et bas pour se déplacer, A pour valider et B pour fermer
- Bouton pour couper ou remettre le son dans le menu pause
- Choix du moteur au garage entre 4 cylindres atmo, 4 cylindres turbo et 5 cylindres, avec une démo sonore à la sélection et une pastille sur le moteur validé, conservé en course
- Page `/labo-son` pour écouter les moteurs et régler chaque couche du son
- Animations en course : flammes et étincelles à l'échappement, calées sur les pétarades, à-coup de la caisse et de la caméra aux passages de rapport, mottes d'herbe et de terre projetées hors piste, gerbe d'étincelles sur les chocs
- Disques de frein visibles derrière les jantes, qui rougissent aux gros freinages
- Feux de recul blancs dans les blocs arrière, allumés en marche arrière
- Crissement de pneus sur l'asphalte, en plus du souffle du dérapage, réglable dans une section dédiée de `/labo-son`

### Changed

- Son du moteur plus réaliste en course : résonance d'échappement, admission, mécanique, saturation, frein moteur et pétarades, plus sifflement et « pschitt » sur les moteurs turbo

- Au garage, le bouton A de la manette valide la ligne sélectionnée : la rotation se met en pause depuis son bouton
- Caméra du garage limitée à l'intérieur de la tente, avec un champ de vision plus large
- Drapeaux plus lisses, avec des triangles plus petits et plus discrets
- Le sélecteur de carte passe du HUD au menu de départ et de pause
- Le choix de la carte devient une liste qui s'ouvre, à la souris comme à la manette, où A valide et B referme
- En pause, A à la manette active la ligne sélectionnée au lieu de reprendre directement la course
- Le menu de départ se parcourt à la manette comme le menu pause, ce qui permet d'y choisir la carte

### Fixed

- Bavettes qui traversaient la route : elles sont plus courtes et restent au-dessus du sol à l'assiette de repos
- Caméra du garage qui s'inversait à la manette en passant au-dessus de la voiture : elle se bloque au sommet, comme à la souris
- Son du moteur absent après un changement de carte tant que le joueur n'avait pas de nouveau cliqué
- Feux stop allumés en marche arrière et moteur qui sonnait comme au frein moteur en reculant
