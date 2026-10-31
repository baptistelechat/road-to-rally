# Epic 2 : Pipeline géo vers 3D

**Statut : à faire. Détail à préciser à la fin de l'epic 1.**

À partir d'un tracé figé (fichier GPX), générer une spéciale roulable. C'est **le vrai défi technique** du projet selon le PRD.

**Passage : une vraie spéciale de 5 km roulable sans bug de maillage.**

| Story | Sujet                               | Critère                                                                                |
| ----- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| 2.1   | Lecture et rééchantillonnage du GPX | Points à pas constant, projection en mètres, tracé lissé sans perdre les épingles      |
| 2.2   | Relief IGN                          | Altitudes RGE ALTI via la Géoplateforme, stockées avec le tracé (endpoint à vérifier)  |
| 2.3   | Largeur de route                    | Déduite de `highway` et `lanes` d'OSM, valeur par défaut sinon                         |
| 2.4   | Ruban sur vraies routes             | `ribbon.ts` gère épingles, rayon inférieur à la demi-largeur et croisements du tracé   |
| 2.5   | Terrain et couloir aplani           | Maillage low-poly, couloir aplani sous la route, sans marche visible au raccord        |
| 2.6   | Web Worker                          | Génération hors du fil principal, avec barre de progression                            |
| 2.7   | Déterminisme et cache               | Même tracé = même spéciale, résultat gardé dans IndexedDB, aucun appel d'API en course |

**Pièges du PRD :** un relief brut est bosselé et la voiture saute partout ; le tag `width` est rare dans OSM ; les serveurs publics sont limités, donc aucun appel pendant la course.
