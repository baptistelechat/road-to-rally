# Fixtures des spéciales

| Id         | Route                                            | Source                                                                                 |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `mountain` | De La Bollène-Vésubie vers le col de Turini      | BRouter, `lonlats=7.3345,43.9925\|7.3909,43.9776`, profil `car-fast`, de 2,5 à 7,68 km, plus 250 m avant et après |
| `road`     | Dans les Landes, de Labouheyre vers Sabres       | BRouter, `lonlats=-0.921,44.213\|-0.743,44.148`, profil `car-fast`, de 4,8 à 10,26 km, plus 250 m avant et après  |

Les itinéraires ont été générés une seule fois le 01/11/2026, puis coupés aux abscisses indiquées pour garder environ 5 km.

- `<id>.gpx` : l'itinéraire, sans altitude. `<desc>rally-runoff=250</desc>` place les lignes à 250 m de chaque bout : ce surplus est de la vraie route. Un GPX sans ce marquage reçoit une ligne droite.
- `<id>.inputs.json` : réponses brutes de l'IGN et d'Overpass, pour tout rejouer sans réseau.

`pnpm bake:stages` régénère `public/stages/` sans réseau. Si un seuil change l'axe, le bake refuse les altitudes en cache et demande `pnpm bake:stages --refresh`.

## Attribution

Les tracés et les attributs de route viennent d'[OpenStreetMap](https://www.openstreetmap.org/copyright), © les contributeurs OpenStreetMap, sous licence [ODbL](https://opendatacommons.org/licenses/odbl/). Itinéraires calculés par [BRouter](https://brouter.de/).

Les altitudes viennent du RGE ALTI de l'IGN, via la [Géoplateforme](https://geoservices.ign.fr/).
