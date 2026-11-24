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
- Logo du jeu dans le garage : logotype facetté sur la bannière et icône encadrée au mur
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
- Options du copilote dans le menu : voix féminine ou masculine, volume, icônes et mini-carte, à la souris, au clavier et à la manette, conservées d'une session à l'autre
- Carte d'essai « Pace notes » avec un virage de chaque note, et écoute de la voix dans `/labo-son`
- Quatre styles de mini-carte au choix dans les options : globale, zoom nord en haut avec boussole, zoom cap en haut, et zoom avec vue globale en vignette
- Balance du son dans les options : curseurs à crans de 10 % pour la voix, le moteur et les effets (pneus, herbe, vent, chocs)
- Quatre compteurs au choix dans les options : chiffres avec LED de régime, cadran rond à aiguille avec anneau de régime, arc de régime gradué, et télémétrie avec accélérateur et frein
- Le copilote annonce les chicanes (« Chicane droite », dans le sens du panneau) et l'arrivée des spéciales, avec leur icône
- Aperçu de partage aux couleurs du jeu quand on colle un lien : scène low-poly, icône et logotype, avec le nom de la spéciale et le temps pour un tracé ou un défi partagé
- Icône de Road to Rally dans l'onglet du navigateur
- Profil d'altitude de l'éditeur gradué en distance et en altitude, avec les points, les chicanes et leur zone, les ronds-points, les rochers et la plus longue ligne droite, cliquables pour centrer la carte
- Barre du haut dans l'éditeur : nom de la spéciale, annuler et rétablir, liste des problèmes du tracé et bouton « Rouler »
- Légende de l'éditeur, au survol : traits, symboles et gestes, avec les mêmes symboles sur la carte et sur le profil
- Rocher au centre des petits giratoires trop étroits pour une barrière, en course et sur la carte de l'éditeur
- Plus longue ligne droite toujours affichée en vert sur la carte de l'éditeur
- Aller-retour en milieu de spéciale, par exemple un demi-tour au rond-point avant de repasser devant le carrefour : deux chaussées séparées par un terre-plein et une glissière solide, y compris sur une avenue déjà à deux chaussées
- Glissière des terre-pleins tracée en rose sur la carte de l'éditeur, repérée sur le profil et expliquée dans la légende
- Décompte 3-2-1 avec bips et feux sous le portique de départ, sur les spéciales comme sur le circuit : le chrono part au GO
- Temps intermédiaires : chaque spéciale, et chaque tour du circuit, se coupe en trois secteurs, avec l'écart au meilleur temps à chaque passage, en vert ou en rouge
- Arches gonflables « SECTEUR 2 » et « SECTEUR 3 » aux intermédiaires, avec bandes, haubans et pieds qu'on percute
- Frise de la spéciale à gauche de l'écran : secteurs terminés en vert ou en rouge, position de la voiture et du fantôme
- Repères des intermédiaires sur la mini-carte et dans l'éditeur, sur la carte, le profil et la légende
- Écran d'arrivée : temps de chaque secteur, total et écart au meilleur temps en vert ou en rouge, pénalités, et boutons pour recommencer ou revenir au menu, à la souris comme à la manette
- Meilleur temps propre à chaque spéciale, avec ses temps de passage
- Fantôme du meilleur temps : voiture translucide en course et point sur la mini-carte, calé sur le chrono officiel, avec une option pour le masquer. Sans trajectoire enregistrée, il roule à allure constante
- Pénalité de 5 s par remise en piste, affichée avec sa raison : remise en piste, hors piste ou contresens
- Deux styles de HUD au choix dans les options : Cockpit, un tableau de bord bas d'un seul tenant, ou Broadcast, un habillage façon télé
- Option pour afficher ou masquer le panneau des commandes, désormais en haut à gauche
- Écran « Prêt » après un changement de carte depuis la pause, au lieu de repasser par le menu de départ
- Accès au garage depuis le menu de départ et la pause, et retour au menu principal depuis la pause
- Nom de la carte dans l'en-tête de l'écran d'arrivée
- Icônes des touches et des boutons à la place des textes d'aide, en course et au garage : clavier en ZQSD ou WASD selon sa disposition, manette Xbox ou PlayStation reconnue, selon le dernier appareil utilisé
- Option « Icônes manette » dans les options : Auto, Xbox ou PlayStation
- Drapeau et numéro de la voiture choisis au garage, affichés dans le HUD à côté du chrono
- Décor réel sur les spéciales, tiré des données de l'IGN : les vrais bâtiments du village à leur hauteur, maisons, fermes, églises, ateliers, silos ou serres, avec fenêtres, volets et toits en tuile ou en ardoise selon la région
- Forêts, haies, vergers et vignes là où ils existent vraiment, avec neuf essences d'arbres et des saules au bord de l'eau
- Champs, prairies, vignes et sous-bois colorés selon les parcelles réelles
- Rivières et étangs à leur niveau : on peut y entrer, la voiture ralentit et projette des gerbes d'eau
- Haies et rangs de vigne qu'on fauche en sortant de la route, comme les bottes de paille
- Habillage de rallye : arche gonflable au départ, aux secteurs et à l'arrivée, avec les feux du départ, banderoles, voiles, pancartes, mâts de drapeaux, tente buvette, rubalise renversable et commissaires
- Public au bord de la route au départ, à l'arrivée et aux épingles, derrière des barrières, avec des tenues variées et des drapeaux de tous les pays
- Cinq ambiances au choix sur la page d'accueil et dans l'écran « Prêt » : après-midi, matin, couchant, brume et aube
- Étape « Décor » dans la progression de la génération d'une spéciale, avec un avertissement si les données de l'IGN sont indisponibles
- Page `/decor-lab` pour comparer les modèles de bâtiments, de végétation, de public, les ambiances et les ponts
- Ponts dessinés sous la route, avec garde-corps solides et trottoir : pierre à arches dans les bourgs et sur les petits ouvrages, viaduc dès 12 m de haut, poutres en treillis sur l'eau des petites routes, béton à piles ailleurs
- Bouton « Régénérer » sur les spéciales générées par une ancienne version du jeu : le tracé se rouvre dans l'éditeur et la génération se lance seule
- Panneaux de freinage jaunes à 3, 2 puis 1 chevrons, pointés vers le virage, avant chaque virage serré au bout d'une longue ligne droite, sur toutes les spéciales. On peut les renverser
- Séparateurs en plastique rouge et blanc autour des ronds-points, qu'on pousse et fait pivoter, autour d'un îlot solide en jardinière béton ou en rochers
- Onglet « Obstacles » dans `/decor-lab` pour comparer les habillages des chicanes, des terre-pleins et des îlots
- Massifs au centre des grands ronds-points selon le lieu : jardin fleuri en ville, rocaille et pins en montagne, bosquet à la campagne
- Ponts repérés en bleu sur le profil d'altitude de l'éditeur, cliquables pour centrer la carte
- Bouton « Importer un GPX » dans l'éditeur : la spéciale importée rejoint « Mes spéciales » avec l'aperçu de son tracé, et se modifie ensuite comme une spéciale tracée sur la carte
- Carte d'essai « Slopes » : une ligne droite avec des montées de 4 à 16 % et des descentes, pour juger la voiture en côte
- Vrais tunnels sur les spéciales : la montagne reste au-dessus de la route, un tube en béton aux parois solides, une façade de roche aux portails et un intérieur sombre, d'un bout à l'autre de l'ouvrage même quand la trace GPS s'en écarte
- Tunnels repérés en gris roche sur le profil d'altitude de l'éditeur, cliquables pour centrer la carte

### Changed

- Le jeu s'appelle désormais « Road to Rally » dans l'onglet du navigateur et les aperçus de lien
- Voix du copilote plus fluide et plus forte : chaque note est dite d'un seul tenant au lieu de mots recollés
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
- Panneau des commandes sur deux colonnes : en haut à gauche en Cockpit, en bas à gauche en Broadcast, aligné avec la frise des secteurs. L'aide du garage s'affiche aussi au clavier et à la souris
- Le signalement de lag n'apparaît plus dans l'aide des commandes, `F9` et `LB` le déclenchent toujours
- Marqueurs de chicane en forme de panneau triangulaire du jeu, avec le sens du premier virage, et sens indiqué dans la liste (« droite puis gauche »)
- Les ponts et tunnels ne retirent plus les chicanes
- Le message de virage arrondi indique le rayon appliqué et l'écart avec la route réelle
- Alertes de chicane retirée plus précises, avec l'écart réel, et conservées après une modification tant que la chicane n'a pas bougé
- Le clic droit ne fait plus tourner la carte de l'éditeur
- Virages et carrefours moins arrondis : rayon minimal de 5 m au lieu de 8 m, la route roulée colle mieux à la vraie route
- Pointillés selon le nombre de voies d'OpenStreetMap : aucun sur une voie unique, une ligne sur deux voies, deux sur trois
- Le sélecteur de carte passe du HUD au menu de départ et de pause
- Seule la portion de décor proche de la voiture est dessinée, pour garder la fluidité dans les villages
- Remise en piste automatique, avec sa pénalité, quand la voiture reste immobilisée sur le côté ou sur le toit
- Plus aucune chicane dans un tunnel
- Bâtiments proches de la route solides : on peut les percuter
- Écran d'arrivée aux boutons biseautés comme le menu principal
- Quand le serveur des routes OpenStreetMap ne répond pas, deux serveurs de secours sont essayés avant de se passer de ses données
- Le choix de la carte devient une liste qui s'ouvre, à la souris comme à la manette, où A valide et B referme
- Les styles de mini-carte et de compteur se choisissent sur des cartes avec aperçu, et la mini-carte se désactive depuis la carte « Aucune »
- Le compteur garde la même largeur quelle que soit la vitesse
- Les compteurs de performance passent sous la mini-carte, empilés
- En pause, A à la manette active la ligne sélectionnée au lieu de reprendre directement la course
- Le menu de départ se parcourt à la manette comme le menu pause, ce qui permet d'y choisir la carte
- Routes, ponts, tunnels et ronds-points tirés de l'IGN (BD TOPO) : l'étape « Routes » de la génération prend quelques secondes, OpenStreetMap ne sert plus qu'en secours
- Sous un pont, le sol suit la vraie vallée au lieu d'un remblai monté jusqu'à la route
- Le chargement d'une spéciale se fait par étapes : l'écran ne se fige plus d'un seul bloc
- L'onglet « Chicanes » de l'éditeur indique « (retirées) » quand elles sont désactivées
- Sur un écran étroit, le choix du fond de carte de l'éditeur n'affiche plus que ses icônes
- Nouvelles icônes du copilote : pilule colorée selon la note, badge « LONG », pastille bicolore et flèche qui se referme quand le virage se resserre, crêtes et bosses en rouge, et cadre autour des enfilades
- Un virage qui se resserre s'annonce avec sa note d'entrée, et une enfilade annonce chacun de ses virages
- Seuls les vrais sommets sont annoncés comme des crêtes : les petites ondulations de la route ne le sont plus
- La mini-carte montre le parcouru en ambre et la route à venir en gris, avec une flèche orientée selon le cap, un départ vert et un damier à l'arrivée, et suit la voiture à chaque image
- Le volume de la voix se règle par un curseur, sans phrase de test
- Nouvelle charte « Nuit facettée » sur le jeu, le garage et l'éditeur : fond bleu nuit, jaune des phares pour le rapport, les actions principales et la sélection, titres en Michroma, texte en Manrope, chiffres en Share Tech Mono, coins plus anguleux
- Un seul mode sur la carte de l'éditeur : un clic pose un point, les points et les chicanes se glissent toujours, et un clic près d'un élément ou pour fermer un menu ne crée rien. Déplacer la carte ne pose plus de point par erreur
- Le panneau latéral de l'éditeur laisse la place à la carte : points et chicanes s'ouvrent dans des fenêtres, tout le score se lit au-dessus du profil, épingles et plus longue ligne droite compris
- Une spéciale peut faire 500 m au lieu de 2 km minimum
- Cliquer sur un point, une chicane ou un repère du profil zoome assez pour voir la route
- La route roulée passe en bleu nuit sur le fond clair de l'éditeur
- Sans les données d'OpenStreetMap, une spéciale tracée dans l'éditeur garde ses largeurs de route et ses ronds-points, tirés de BRouter
- Sur une spéciale, la voiture reste sur la ligne jusqu'au GO au lieu de partir au premier coup de gaz
- Les panneaux d'annonce de chicane se renversent comme les autres panneaux
- Message clair quand le service d'itinéraire refuse les demandes, et itinéraires déjà calculés réutilisés pour moins le solliciter
- Nouvelle interface sur tous les écrans : menu de départ avec bandeau et cartes montrant le vrai tracé de chaque piste, défilant au-delà de quatre, pause en panneau à gauche qu'on ferme d'un clic à côté, décompte sous un hexagone avec ses feux, écran d'arrivée, garage en sections numérotées et éditeur avec ses spéciales en cartes et un panneau latéral à onglets
- Boutons biseautés et focus en deux traits clairs, en haut et en bas, partout dans le jeu, le garage et l'éditeur, avec une barre de défilement fine qui s'élargit au survol
- Notes du copilote redessinées : tuile inclinée et badge hexagonal
- Mini-carte en rectangle plus large, et HUD de course masqué au menu de départ
- Road et Mountain refaites avec la génération actuelle : vrais bâtiments, forêts, eau et ponts, et chicanes sur les longues lignes droites de Road. Les records et fantômes de ces deux cartes repartent de zéro
- Le copilote annonce plus tôt à haute vitesse : la phrase finit avant le point de freinage, pas une seconde avant le virage
- Rien n'est annoncé pendant le décompte, et le virage où l'on prend le départ n'est pas annoncé
- Chocs plus vivants : la voiture bascule sur un choc de face, valse sur une chicane, tombe en basculant dans un ravin, et peut faire un tonneau
- Ombres portées plus loin autour de la voiture : elles n'apparaissent plus sous les yeux en roulant
- Glissière métallique devant les blocs de chicane et séparateur en béton sur les terre-pleins, pour ne plus les confondre avec les barrières renversables
- Sur une route étroite à flanc de montagne, l'arche de secteur devient une banderole tendue entre deux mâts ; ailleurs, ses pieds descendent jusqu'au sol
- Tous les records et fantômes repartent de zéro : routes, obstacles et physique des chocs ont changé
- Pendant le décompte, le moteur monte dans les tours et le compteur suit les gaz ; au GO, le régime redescend comme un embrayage qu'on relâche au lieu de retomber au ralenti
- Moteur 10 % plus puissant, et rétrogradage automatique pied au plancher quand le régime chute : la voiture tient mieux les côtes. Records et fantômes ne sont plus comparables

### Removed

- Noms de lieux sur le fond satellite de l'éditeur
- Fenêtre « Score détaillé » et verdict « route roulante / sinueuse » de l'éditeur, redondants avec le bandeau du profil
- Import d'un GPX depuis le menu de départ et le menu pause : il se fait désormais depuis l'éditeur

### Fixed

- Arbres du bord de route qu'on traversait après une sortie large : ils ont un tronc solide jusqu'à 25 m de la route
- Public, barrières et pancartes perchés sur le versant au-dessus des épingles de montagne : ils restent à hauteur de route
- Arches de secteur plantées dans le talus ou suspendues au-dessus du vide
- Rambardes de pont qui traversaient la route dans les courbes
- Mur invisible en longeant la glissière d'un terre-plein
- Îlot de rond-point décentré dans son anneau
- Dans les options, bas à la manette passe de la mini-carte au compteur au lieu de faire défiler leurs cartes
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
- Chicanes annoncées à l'envers par la voix et l'icône du copilote : elles disent maintenant le même côté que le panneau au bord de la route
- Navigation à la manette dans les menus : haut et bas suivent l'écran rangée par rangée, gauche et droite passent d'une grille à l'autre
- Exemple de voix des options qui partait avec plusieurs secondes de retard après un changement de voix
- Chicane qui sautait sur l'autre passage quand le tracé repasse sur sa propre route, dans l'éditeur comme en course
- Bouton « Satellite » caché sous la recherche de lieu sur un écran étroit
- Réouverture d'un tracé qui relançait une recherche de commune à chaque fois
- Nappe d'eau qui passait devant la route sur les ponts bas
- Message « données OSM indisponibles » à presque chaque génération, les serveurs d'OpenStreetMap étant saturés
- Pied d'arche planté dans la glissière d'un terre-plein : l'arche se resserre, ou devient une banderole quand la place manque
- Îlot de rond-point qui flottait au-dessus de la route en pente
- Profil d'altitude de l'éditeur qui plongeait sous les ponts

### Security

- Next.js mis à jour en 16.4.6 pour corriger plusieurs failles
- Le moteur de la carte de l'éditeur est servi par le site lui-même, et non plus par un CDN tiers
