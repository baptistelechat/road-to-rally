// Tous les seuils du pipeline géo. Changer une valeur qui modifie le résultat impose d'incrémenter PIPELINE_VERSION.

/** Version du pipeline, recopiée dans `StageData.pipelineVersion` */
export const PIPELINE_VERSION = 5;

// --- Axe (story 2.1) ---

/** Pas de l'axe en mètres, le même que le sandbox */
export const STEP = 2;
/** Longueur autorisée, prolongement exclu, en mètres */
export const MIN_STAGE_LENGTH = 2000;
export const MAX_STAGE_LENGTH = 15000;
/**
 * GPX sans route au-delà de ses lignes : ligne droite ajoutée avant le départ et après l'arrivée, pour s'arrêter à fond.
 * On prend la première longueur qui ne vient pas buter sur une autre portion de la route.
 */
export const STAGE_RUNOFFS = [250, 125, 60, 40, 20];
/** Distance minimale entre le prolongement et le reste de la route, en mètres */
export const RUNOFF_CLEARANCE = 16;
/** Pente maximale d'un prolongement inventé, vertical / horizontal */
export const RUNOFF_MAX_SLOPE = 0.05;
/** Le début du tracé, sur cette longueur, ne compte pas : le prolongement en part forcément, en mètres */
export const RUNOFF_ROOT = 40;
/** Deux points GPX plus proches que ça sont confondus, en mètres */
export const GPX_MIN_SPACING = 1;
/** Une entrée de l'abaque de longueur tous les combien de mètres : le pas reste régulier dans les virages */
export const ARC_LENGTH_RESOLUTION = 0.25;
/** Rayon de virage minimal en mètres, à confirmer au volant en 2.3 */
export const MIN_RADIUS = 8;
/** Marge visée au-dessus du rayon minimal, pour absorber le rééchantillonnage et l'arrondi au millimètre */
export const RADIUS_MARGIN = 1.03;
/** Part du manque de rayon rattrapée à chaque itération */
export const WIDEN_GAIN = 0.35;
/** Rayon du lissage de la poussée, en points : 8 points = 16 m, de quoi écarter toute une épingle */
export const WIDEN_SMOOTH_RADIUS = 8;
export const WIDEN_MAX_ITERATIONS = 800;
/** Sous cette distance, deux points non consécutifs signalent un croisement ou une superposition, en mètres */
export const SELF_CONTACT_DISTANCE = 1.5;

// --- Relief (story 2.2) ---

export const IGN_URL =
  "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json";
export const IGN_RESOURCE = "ign_rge_alti_wld";
export const IGN_BATCH_SIZE = 5000;
/** Altitude renvoyée par l'IGN hors couverture */
export const IGN_NO_DATA = -99999;
export const IGN_MAX_RETRIES = 4;
/** Attente avant la première reprise, doublée à chaque fois, en millisecondes */
export const IGN_RETRY_DELAY = 1000;
export const IGN_TIMEOUT = 30000;

/** Fenêtre du filtre médian, en points de part et d'autre */
export const PROFILE_MEDIAN_RADIUS = 2;
/** Rayon du lissage le long de l'axe, en points */
export const PROFILE_SMOOTH_RADIUS = 5;
/** Pente longitudinale maximale */
export const MAX_SLOPE = 0.2;
/** Rayon vertical minimal des crêtes et des creux, en mètres */
export const MIN_VERTICAL_RADIUS = 50;
/** Marge visée sur les deux limites, pour absorber l'arrondi au millimètre */
export const PROFILE_MARGIN = 0.95;
export const PROFILE_MAX_ITERATIONS = 20000;

// --- Largeur et attributs OSM (story 2.4) ---

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
/** Marge autour de l'emprise du tracé, en mètres */
export const OVERPASS_MARGIN = 30;
export const OVERPASS_SERVER_TIMEOUT = 25;
export const OVERPASS_TIMEOUT = 40000;
/** Après une erreur 429 ou 406, le serveur demande 30 s */
export const OVERPASS_RETRY_DELAY = 30000;
export const OVERPASS_MAX_RETRIES = 1;
/** Au-delà de cette distance, un point de l'axe garde la largeur par défaut */
export const OSM_MATCH_DISTANCE = 15;
/** Pénalité en mètres d'une voie perpendiculaire à l'axe : une voie bien orientée passe devant une voie plus proche */
export const OSM_DIRECTION_WEIGHT = 15;

export const DEFAULT_WIDTH = 5;
export const MIN_WIDTH = 3.5;
export const MAX_WIDTH = 9;
export const LANE_WIDTH = 3;
/** À partir de cette largeur de classe, une route à double sens n'est pas réduite à une voie par `lanes=1` */
export const MAJOR_ROAD_WIDTH = 6;
/** Largeur selon `highway`, en mètres */
export const HIGHWAY_WIDTHS: Readonly<Record<string, number>> = {
  motorway: 9,
  trunk: 8,
  primary: 7,
  secondary: 6.5,
  tertiary: 6,
  motorway_link: 6,
  trunk_link: 6,
  primary_link: 6,
  secondary_link: 5.5,
  tertiary_link: 5,
  unclassified: 5,
  residential: 5,
  living_street: 4.5,
  service: 4,
  track: 3.5,
};
/** Fenêtre du filtre médian des largeurs, en points de part et d'autre : retire une association isolée */
export const WIDTH_MEDIAN_RADIUS = 5;
/** Rayon du lissage des largeurs, en points : deux passes étalent un changement sur environ 80 m */
export const WIDTH_SMOOTH_RADIUS = 10;

// --- Terrain (story 2.6) ---

/** Couloir d'altitudes de part et d'autre de l'axe, en mètres */
export const CORRIDOR_HALF_WIDTH = 300;
/** Maille de la grille, en mètres, alignée sur l'origine locale */
export const CORRIDOR_CELL = 16;
/** Mailles plus larges autour du couloir : le relief continue jusque dans le brouillard, sans falaise ni vide au bord */
export const TERRAIN_OUTER_TIERS = [
  { cell: 32, reach: 650 },
  { cell: 64, reach: 1500 },
];
/** Un sommet ajouté plus proche que ça du bord d'un bas-côté est retiré : pas de nœud sous une contrainte */
export const TERRAIN_ROAD_CLEARANCE = 2;
/** Rangées de sommets le long des bas-côtés, pour passer sans éventail des 2 m de la route aux 16 m de la grille */
export const TERRAIN_ROWS = [
  { offset: 3, stride: 3 },
  { offset: 8, stride: 6 },
];
/** Deux sommets de rangées plus proches que ça : le second est retiré, en mètres */
export const TERRAIN_ROW_MIN_GAP = 2.5;
/** Un nœud de grille plus proche que ça du bord du bas-côté est retiré : les rangées y prennent le relais */
export const TERRAIN_GRID_CLEARANCE = 11;
/** Pente permise au bord du bas-côté, vertical / horizontal */
export const TERRAIN_BLEND_SLOPE = 0.25;
/** Raidissement de cette limite par mètre : 0,75 à 25 m du bord, soit 30 m de l'axe, puis le relief reprend la main */
export const TERRAIN_BLEND_GROWTH = 0.01;
/** Au-delà, une portion de route ne contraint plus le relief : sa limite y dépasse déjà 450 m */
export const TERRAIN_BLEND_REACH = 200;
/** Arête maximale d'un triangle entre nœuds, 1,5 diagonale de la plus grande maille : au-delà, il bouche un creux au bord */
export const TERRAIN_MAX_NODE_EDGE = 136;
