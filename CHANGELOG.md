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

### Changed

- Au garage, le bouton A de la manette valide la ligne sélectionnée : la rotation se met en pause depuis son bouton

### Fixed

- Bavettes qui traversaient la route : elles sont plus courtes et restent au-dessus du sol à l'assiette de repos
- Caméra du garage qui s'inversait à la manette en passant au-dessus de la voiture : elle se bloque au sommet, comme à la souris
