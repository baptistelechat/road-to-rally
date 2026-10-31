# Epic 3 : Éditeur sur carte

**Statut : à faire. Détail à préciser à la fin de l'epic 2.**

Le joueur trace sa spéciale, avec une assistance qui le pousse vers des routes intéressantes.

**Passage : un ami crée une spéciale sans ton aide.**

| Story | Sujet                     | Critère                                                                                   |
| ----- | ------------------------- | ----------------------------------------------------------------------------------------- |
| 3.1   | Carte                     | MapLibre GL et tuiles OpenFreeMap, attribution OSM visible. Jamais de données Google Maps |
| 3.2   | Tracé accroché aux routes | Départ, arrivée, points de passage via BRouter. France seule, 2 à 15 km                   |
| 3.3   | Profil d'altitude         | Affiché sous la carte, mis à jour au fil du tracé                                         |
| 3.4   | Score du tracé en direct  | Virages par km, dénivelé, plus longue ligne droite                                        |
| 3.5   | Chicanes automatiques     | Bottes de paille sur les lignes droites au-delà de 400 m, plafond d'une par km            |
| 3.6   | Demi-tour                 | Autour d'un rond-point ou d'une épingle artificielle, pour un aller-retour                |
| 3.7   | Édition des éléments      | Le joueur déplace ou supprime chaque élément ajouté : il a le dernier mot                 |
| 3.8   | Suggestion de variante    | Itinéraire voisin plus sinueux (première à sauter si le temps manque)                     |
| 3.9   | Du tracé à la course      | Bouton « Rouler » qui lance le pipeline de l'epic 2                                       |

**Interface :** c'est ici que shadcn/ui entre dans le projet. Pas avant.
