# Epic 5 : Décor

**Statut : à faire. Détail à préciser à la fin de l'epic 4.**

Reconnaître « la route de chez soi » : bâtiments et forêts issus des vraies données, en repartant du placeur de la story 1.7.

**Passage : 60 FPS sur un portable moyen dans un village.**

| Story | Sujet                    | Critère                                                                                   |
| ----- | ------------------------ | ----------------------------------------------------------------------------------------- |
| 5.1   | Direction artistique     | Palette, lumière et brouillard choisis parmi 2 ou 3 essais, validés par capture           |
| 5.2   | Bâtiments                | BD TOPO IGN avec hauteurs, emprises extrudées en low-poly, valeur par défaut sans hauteur |
| 5.3   | Forêts et champs         | Polygones OSM ou BD TOPO peuplés d'arbres instanciés, placement déterministe              |
| 5.4   | Eau et occupation du sol | Couleurs du terrain selon `landuse` et `natural`                                          |
| 5.5   | Panneaux et public       | Le public près des épingles et du départ                                                  |
| 5.6   | Niveaux de détail        | Découpage du décor le long de la route, seule la portion proche est visible               |
| 5.7   | Collisions               | Seuls les éléments proches de la route ont un collider                                    |
| 5.8   | Cache                    | Données et maillages rangés dans IndexedDB avec la spéciale                               |

**Piège du PRD :** forêts et villages denses sont le principal risque de chute de FPS. Mesurer dès 5.2, ne pas attendre 5.6.
