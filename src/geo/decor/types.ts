// Données brutes du décor, telles que la Géoplateforme IGN les renvoie, réduites aux champs utiles.
// Rangées dans `StageInputs.decor` : `buildDecor` en tire le décor sans plus jamais appeler le réseau.
import type { LatLon } from "../gpx";
import type { Vec3 } from "../../sim/types";

/** Un polygone : contour extérieur puis trous, chacun sans point répété. */
export type Rings = LatLon[][];

/** `BDTOPO_V3:batiment` */
export interface RawBuilding {
  /** `cleabs`, identifiant IGN stable : sert au tri */
  id: string;
  /** Plusieurs polygones si le bâtiment est un MultiPolygon */
  polygons: Rings[];
  /** `hauteur`, en mètres, `null` si absente */
  height: number | null;
  /** `nombre_d_etages`, `null` si absent */
  floors: number | null;
  /** `usage_1` (« Résidentiel », « Agricole », « Industriel », « Religieux »…), `null` si absent */
  usage: string | null;
  /** `construction_legere` : abri, hangar léger */
  light: boolean;
  /** `nature` (« Indifférenciée », « Église », « Silo », « Serre »…), `null` si absente */
  nature: string | null;
  /** `usage_2`, en secours de `usage_1`, `null` si absent */
  usage2: string | null;
  /** `nombre_de_logements`, `null` si absent */
  dwellings: number | null;
  /** `altitude_minimale_toit` et `altitude_maximale_toit`, en mètres : un écart nul trahit un toit plat */
  roofMin: number | null;
  roofMax: number | null;
  /** `materiaux_de_la_toiture`, code des fichiers fonciers (« 01 » tuiles, « 02 » ardoises…), `null` si absent */
  roofMaterial: string | null;
  /** `materiaux_des_murs`, même codage (« 01 » pierre, « 04 » briques, « 06 » bois…), `null` si absent */
  wallMaterial: string | null;
}

/** `BDTOPO_V3:zone_de_vegetation`, `BDTOPO_V3:surface_hydrographique` ou `RPG.LATEST:parcelles_graphiques` */
export interface RawArea {
  id: string;
  polygons: Rings[];
  /** `nature` (« Bois », « Forêt fermée de conifères », « Haie », « Verger », « Vigne »…) ou, pour une parcelle, `code_group` */
  nature: string;
}

/** `BDTOPO_V3:haie`, ligne */
export interface RawLine {
  id: string;
  line: LatLon[];
}

export interface DecorInputs {
  /** Triés par `id` */
  buildings: RawBuilding[];
  vegetation: RawArea[];
  hedges: RawLine[];
  water: RawArea[];
  /** Parcelles agricoles (RPG) */
  fields: RawArea[];
  /** `code_insee` du département de l'origine (« 29 », « 2A »…), pour les toitures régionales. Absent des anciens caches. */
  department?: string | null;
}

/** Ce que le pipeline sait déjà quand il construit le décor. Tout est dans le plan local de la spéciale. */
export interface DecorContext {
  origin: LatLon;
  /** Axe unique (sans le retour d'un aller-retour), altitudes du repère de la spéciale */
  axis: Vec3[];
  widths: number[];
  /** Altitude réelle de y = 0 */
  baseAltitude: number;
  /** Distance horizontale au bord de la route la plus proche (négative sur la chaussée) */
  roadClearance: (x: number, z: number) => number;
  /** Altitude du sol (terrain, ruban, bas-côtés) dans le repère de la spéciale, `null` hors couloir */
  groundAt: (x: number, z: number) => number | null;
}
