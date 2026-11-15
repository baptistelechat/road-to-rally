# Epic 5 : Décor

**Statut : code livré, jugement au volant attendu.**

Reconnaître « la route de chez soi » : bâtiments, bois, haies, champs et eau issus des vraies données, en repartant du placeur de la story 1.7.

**Passage : 60 FPS sur un portable moyen dans un village.**

## D'où viennent les données

Tout vient de la **Géoplateforme IGN**, par son service WFS (`https://data.geopf.fr/wfs/ows`), le même hébergeur que le relief. Testé le 15/11/2026 : CORS ouvert, sans clé, réponse GeoJSON en `EPSG:4326`, limite de **1 requête par seconde** (`x-ratelimit-limit-second: 1`). Licence Ouverte Etalab : attribution « IGN – BD TOPO® » suffit.

| Élément               | Couche WFS                         | Champs utiles                                                                                 | Exemple mesuré (Tours, 15/11)                       |
| --------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Bâtiments             | `BDTOPO_V3:batiment`               | emprise, `hauteur`, `nombre_d_etages`, `usage_1`, `construction_legere`                       | 1 368 bâtiments sur 800 × 550 m, hauteur renseignée |
| Bois, vergers, vignes | `BDTOPO_V3:zone_de_vegetation`     | emprise, `nature` (« Bois », « Forêt fermée de conifères », « Haie », « Verger », « Vigne »…) | 334 zones sur 7 × 3 km                              |
| Haies                 | `BDTOPO_V3:haie`                   | ligne                                                                                         | 504 haies sur 7 × 3 km                              |
| Eau                   | `BDTOPO_V3:surface_hydrographique` | emprise, `nature`                                                                             | 318 surfaces sur 7 × 11 km                          |
| Champs et prairies    | `RPG.LATEST:parcelles_graphiques`  | emprise, `code_group` (culture)                                                               | réponse lente, plusieurs secondes                   |

**Pourquoi l'IGN plutôt qu'OSM** : la BD TOPO donne la **hauteur réelle** de presque chaque bâtiment (OSM la donne rarement), couvre toute la France de façon homogène, et Overpass est déjà fragile (voir `LRN-261104_1032-5`) : on ne lui ajoute aucune requête. OSM reste la source des routes.

**Comment c'est récupéré** : à la création de la spéciale, comme le relief, jamais en course. Le Worker découpe le couloir de la spéciale (300 m de part et d'autre de l'axe) en tuiles, demande chaque couche tuile par tuile à une requête par seconde, déduplique par `cleabs`, garde les seuls champs utiles et range le tout dans `StageInputs.decor`. Le pipeline en tire ensuite, sans réseau, un `StageDecor` dans le plan local de la spéciale : emprises extrudées, arbres placés de façon déterministe, eau, teintes du sol. Le tout est rangé avec la spéciale dans IndexedDB.

**Si la Géoplateforme ne répond pas** : la génération continue, un avertissement le dit, et le décor procédural de la story 1.7 prend le relais. Comme une spéciale dégradée par Overpass, elle n'est pas mise en cache.

## Contrat partagé

- `src/sim/types.ts` : `StageDecor`, `DecorBuilding`, `DecorTree`, `DecorWater`, `StageData.decor?`, `Track.decor?`.
- `src/geo/decor/` : `types.ts` (données brutes, `DecorContext`), `config.ts`, `fetchDecor.ts`, `buildings.ts`, `vegetation.ts`, `landcover.ts`, `index.ts` (`buildDecor`).
- `src/render/palette.ts` : couleurs du décor, réglées par la story 5.1.
- `src/render/decor/` : `DecorView`, `BuildingsView`, `WaterView`.

Les arbres passent par la simulation (`generateScenery`), comme ceux de la story 1.7 : les plus proches de la route ont un collider, et le fantôme doit rejouer le même monde. Sans `decor`, une spéciale reste identique à celle d'avant au bit près.

## Stories

| Story                              | Sujet                    | Vague |
| ---------------------------------- | ------------------------ | ----- |
| [5.1](5.1-direction-artistique.md) | Direction artistique     | 1     |
| [5.2](5.2-batiments.md)            | Bâtiments                | 1     |
| [5.3](5.3-forets-haies.md)         | Forêts et haies          | 1     |
| [5.4](5.4-sol-eau.md)              | Eau et occupation du sol | 1     |
| [5.5](5.5-panneaux-public.md)      | Panneaux et public       | 2     |
| [5.6](5.6-niveaux-detail.md)       | Niveaux de détail        | 2     |
| [5.7](5.7-collisions.md)           | Collisions               | 2     |
| [5.8](5.8-donnees-cache.md)        | Données et cache         | 1     |
| [5.9](5.9-eau-ponts.md)            | Eau praticable et ponts  | 2     |

La vague 1 se développe en parallèle sur des fichiers distincts. La vague 2 part du décor livré par la vague 1.

**Piège du PRD :** forêts et villages denses sont le principal risque de chute de FPS. Mesurer dès 5.2, ne pas attendre 5.6.
