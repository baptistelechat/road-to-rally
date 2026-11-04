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
- Éditeur de spéciales sur `/editor` : carte, recherche de lieu et tracé automatique sur les vraies routes entre les points posés, avec déplacement, insertion, suppression, inversion et annulation, et brouillon conservé
- Contrôle du tracé en direct dans l'éditeur : longueur, croisements, routes qui se touchent, lignes trop proches d'une autre portion et sortie de France, avec l'endroit indiqué sur la carte
- Profil d'altitude et score du tracé dans l'éditeur : virages par km, épingles, dénivelé, plus longue ligne droite et verdict
- Bouton « Rouler » qui génère la spéciale tracée et lance la course, avec retour à l'éditeur
- Aller-retour sur une même route, autour d'un rond-point ou d'une boucle
- Chicanes sur les longues lignes droites : barrière de rubalise fixe, avec des bottes empilées derrière pour cacher la sortie. Elles se déplacent, se suppriment ou s'ajoutent dans l'éditeur
- Suggestion de variantes plus sinueuses entre deux points de l'éditeur
- Accès à l'éditeur depuis le sélecteur de carte
- Accueil de l'éditeur sur `/editor` : nouvelle spéciale, liste des spéciales créées ou importées, et suppression après confirmation
- Modification d'une spéciale après l'avoir testée : la rouler à nouveau remplace la version précédente, et une confirmation protège les changements non roulés
- Fonds de carte satellite, clair et sombre dans l'éditeur, avec relief, boussole et localisation
- Panneau de virages à l'approche de chaque chicane, en miroir selon le côté, et chevrons sur les bottes
- Routes OpenStreetMap sur le fond satellite de l'éditeur, plus discrètes à mesure qu'on zoome, avec les noms de rue seulement de près et un bouton « Routes » pour les masquer
- Zone de 100 m autour de chaque chicane sur la carte, qui passe au rouge si elle en touche une autre, avec l'écart actuel et le décalage à faire
- Clic sur un point, une chicane ou une alerte du panneau pour centrer la carte dessus
- Indicateur de chargement pendant la recherche de la route avant le départ et après l'arrivée
- Barrière incassable au centre des ronds-points roulés, qui suit le relief, pour qu'on ne les coupe pas, avec son cercle rouge sur la carte de l'éditeur
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
- Copilote en course : tous les virages sont notés de 1 à 6 et annoncés par une voix française, assez tôt pour préparer le virage selon la vitesse, avec crêtes, bosses et enfilades
- Icônes des prochains virages à l'écran et mini-carte de la spéciale
- Options du copilote dans le menu : voix, vitesse de diction, volume, icônes et mini-carte, à la souris, au clavier et à la manette, conservées d'une session à l'autre
- Carte d'essai « Pace notes » avec un virage de chaque note, et écoute de la voix dans `/labo-son`
- Quatre styles de mini-carte au choix dans les options : globale, zoom nord en haut avec boussole, zoom cap en haut, et zoom avec vue globale en vignette
- Balance du son dans les options : curseurs à crans de 10 % pour la voix, le moteur et les effets (pneus, herbe, vent, chocs)
- Profil d'altitude de l'éditeur gradué en distance et en altitude, avec les points, les chicanes et leur zone, les ronds-points, les rochers et la plus longue ligne droite, cliquables pour centrer la carte
- Barre du haut dans l'éditeur : nom de la spéciale, annuler et rétablir, liste des problèmes du tracé et bouton « Rouler »
- Légende de l'éditeur, au survol : traits, symboles et gestes, avec les mêmes symboles sur la carte et sur le profil
- Rocher au centre des petits giratoires trop étroits pour une barrière, en course et sur la carte de l'éditeur
- Plus longue ligne droite toujours affichée en vert sur la carte de l'éditeur

### Changed

- Son du moteur plus réaliste en course : résonance d'échappement, admission, mécanique, saturation, frein moteur et pétarades, plus sifflement et « pschitt » sur les moteurs turbo

- Au garage, le bouton A de la manette valide la ligne sélectionnée : la rotation se met en pause depuis son bouton
- Caméra du garage limitée à l'intérieur de la tente, avec un champ de vision plus large
- Drapeaux plus lisses, avec des triangles plus petits et plus discrets
- Bottes de paille tantôt debout, tantôt couchées, posées selon la pente du terrain
- Plus aucun arbre sur les pentes trop raides des spéciales
- Carte de tracé de l'éditeur déplacée sur `/editor/trace`, et routes plus lisibles sur le fond sombre
- Chicanes moins hautes, deux rangs de bottes : la sortie se voit par-dessus en caméra poursuite, et reste cachée en vue capot
- Clic droit plus tolérant pour ajouter une chicane à côté du tracé
- Le premier point du tracé est désormais le départ et le dernier l'arrivée, avec 200 m de vraie route ajoutés au-delà, hors chrono. Sans route libre, l'éditeur demande de déplacer le point au lieu d'inventer une route
- Marqueurs de chicane en forme de panneau triangulaire du jeu, avec le sens du premier virage, et sens indiqué dans la liste (« droite puis gauche »)
- Les ponts et tunnels ne retirent plus les chicanes
- Le message de virage arrondi indique le rayon appliqué et l'écart avec la route réelle
- Alertes de chicane retirée plus précises, avec l'écart réel, et conservées après une modification tant que la chicane n'a pas bougé
- Le clic droit ne fait plus tourner la carte de l'éditeur
- Virages et carrefours moins arrondis : rayon minimal de 5 m au lieu de 8 m, la route roulée colle mieux à la vraie route
- Pointillés selon le nombre de voies d'OpenStreetMap : aucun sur une voie unique, une ligne sur deux voies, deux sur trois
- Le sélecteur de carte passe du HUD au menu de départ et de pause
- Le choix de la carte devient une liste qui s'ouvre, à la souris comme à la manette, où A valide et B referme
- En pause, A à la manette active la ligne sélectionnée au lieu de reprendre directement la course
- Le menu de départ se parcourt à la manette comme le menu pause, ce qui permet d'y choisir la carte
- Nouvelles icônes du copilote : pilule colorée selon la note, badge « LONG », pastille bicolore et flèche qui se referme quand le virage se resserre, crêtes et bosses en rouge, et cadre autour des enfilades
- Un virage qui se resserre s'annonce avec sa note d'entrée, et une enfilade annonce chacun de ses virages
- Seuls les vrais sommets sont annoncés comme des crêtes : les petites ondulations de la route ne le sont plus
- La mini-carte montre le parcouru en ambre et la route à venir en gris, avec une flèche orientée selon le cap, un départ vert et un damier à l'arrivée, et suit la voiture à chaque image
- Le volume de la voix se règle par un curseur, sans phrase de test
- Un seul mode sur la carte de l'éditeur : un clic pose un point, les points et les chicanes se glissent toujours, et un clic près d'un élément ou pour fermer un menu ne crée rien. Déplacer la carte ne pose plus de point par erreur
- Le panneau latéral de l'éditeur laisse la place à la carte : points et chicanes s'ouvrent dans des fenêtres, le score se lit au-dessus du profil et en détail dans une fenêtre
- Une spéciale peut faire 500 m au lieu de 2 km minimum
- Cliquer sur un point, une chicane ou un repère du profil zoome assez pour voir la route
- La route roulée passe en bleu nuit sur le fond clair de l'éditeur
- Sans les données d'OpenStreetMap, une spéciale tracée dans l'éditeur garde ses largeurs de route et ses ronds-points, tirés de BRouter

### Removed

- Noms de lieux sur le fond satellite de l'éditeur

### Fixed

- Bavettes qui traversaient la route : elles sont plus courtes et restent au-dessus du sol à l'assiette de repos
- Caméra du garage qui s'inversait à la manette en passant au-dessus de la voiture : elle se bloque au sommet, comme à la souris
- Décompte hors piste qui continuait une fois revenu sur la route après une sortie à grande vitesse
- Routes à double sens trop étroites dans les GPX importés quand OpenStreetMap n'indiquait qu'une voie
- GPX marqués avec leur propre prolongement : un tracé qui se croise est maintenant refusé dès sa lecture, avec l'endroit indiqué
- Marqueur de chicane qui restait à côté de la route une fois glissé : il revient sur le tracé
- Textures de chicane qui clignotaient au loin
- Erreur de la console à l'ouverture de l'éditeur, avec des alertes d'écart de chicanes fausses (« 0 m ») avant la fin de l'analyse du tracé
- Chicane acceptée par l'éditeur puis retirée à la génération parce que trop proche d'une ligne ou d'une autre chicane
- Curseur qui tremblait près du tracé et clic droit qui ne posait pas de chicane
- Alertes et drapeaux qui empêchaient d'attraper un point sur la carte
- Kilomètre d'une chicane différent entre la liste et l'alerte
- Boutons d'une chicane qui perdaient le focus au clavier après chaque déplacement
- Son du moteur absent après un changement de carte tant que le joueur n'avait pas de nouveau cliqué
- Feux stop allumés en marche arrière et moteur qui sonnait comme au frein moteur en reculant
- Erreur à l'ajout d'un point quand un nouveau rond-point s'insérait avant les autres sur le tracé
