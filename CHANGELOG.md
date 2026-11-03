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
- Modes Éditer et Déplacer sur la carte de l'éditeur, pour créer des éléments ou les glisser sans risque d'erreur
- Calque des routes de l'IGN sur le fond satellite de l'éditeur
- Zone de 100 m autour de chaque chicane sur la carte, qui passe au rouge si elle en touche une autre, avec l'écart actuel et le décalage à faire
- Clic sur un point, une chicane ou une alerte du panneau pour centrer la carte dessus
- Indicateur de chargement pendant la recherche de la route avant le départ et après l'arrivée
- Barrière incassable au centre des ronds-points roulés, qui suit le relief, pour qu'on ne les coupe pas, avec son cercle rouge sur la carte de l'éditeur

### Changed

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
