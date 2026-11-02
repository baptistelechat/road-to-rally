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

// --- Routage de l'éditeur (story 3.2) ---

export const BROUTER_URL = "https://brouter.de/brouter";
export const BROUTER_PROFILE = "car-fast";
export const BROUTER_TIMEOUT = 15000;
/** Une seule reprise : le serveur public n'a pas de limite publiée et le joueur attend */
export const BROUTER_MAX_RETRIES = 1;
export const BROUTER_RETRY_DELAY = 1000;
/** Au-delà, un point est refusé : BRouter accroche sans prévenir jusqu'à 280 m, en mètres */
export const ANCHOR_MAX_SNAP = 150;
/** Écart toléré entre deux segments à leur point commun, recollé ensuite : au-delà, ils ne suivent pas la même route, en mètres */
export const ANCHOR_JUNCTION_TOLERANCE = 5;
/** Vraie route gardée avant le départ et après l'arrivée, en mètres : le `rally-runoff` des GPX produits */
export const EDITOR_RUNOFF = 250;

// --- Garde-fous de l'éditeur (story 3.3). Ils jugent le tracé sans modifier la spéciale. ---

/** Une ligne de départ ou d'arrivée plus proche que ça d'une autre branche est refusée, en mètres (LRN-20261101163654-5) */
export const LINE_BRANCH_CLEARANCE = 25;
/**
 * Un point est sur une autre branche si la route fait ce détour pour y arriver : abscisse / distance à vol d'oiseau.
 * Un angle droit monte à √2 et reste la même branche, une épingle commence à π/2.
 */
export const LINE_BRANCH_DETOUR = 1.5;
/** Au-delà, l'écart entre l'axe roulé et la route d'origine est signalé, en mètres */
export const WIDENED_DEVIATION = 5;
/** Deux écarts plus proches que ça le long de l'axe forment une seule portion signalée, en mètres */
export const WIDENED_MERGE = 50;
/** Portée de la recherche du point le plus proche, de part et d'autre de la dernière position, en mètres */
export const WIDENED_SEARCH_REACH = 60;

// --- Profil et score du tracé dans l'éditeur (stories 3.5 et 3.6). Aucune de ces valeurs ne touche à la spéciale générée. ---

/** Un point d'altitude IGN tous les combien de mètres pour l'aperçu */
export const PREVIEW_ALTITUDE_SPACING = 20;
/** Rayon de la moyenne sur la courbure, en points de part et d'autre */
export const TRACE_CURVATURE_SMOOTH_RADIUS = 4;
/** Au-dessus de ce rayon, en mètres, la route ne tourne pas assez pour compter un virage */
export const TRACE_TURN_MAX_RADIUS = 150;
/** Changement de cap minimal d'un virage, en degrés */
export const TRACE_TURN_MIN_ANGLE = 25;
/** Deux virages du même côté plus proches que ça comptent pour un, en mètres */
export const TRACE_TURN_MERGE_GAP = 60;
/** Une épingle tourne d'au moins cet angle, en degrés, sous ce rayon, en mètres */
export const TRACE_HAIRPIN_MIN_ANGLE = 150;
export const TRACE_HAIRPIN_MAX_RADIUS = 25;
/** Au-dessus de ce rayon, en mètres, la portion compte comme une ligne droite */
export const TRACE_STRAIGHT_MIN_RADIUS = 400;
/** Verdict selon les virages par km : en dessous, « roulante » ; puis « sinueuse » ; au-delà, « très sinueuse » */
export const TRACE_VERDICT_ROLLING_MAX = 2;
export const TRACE_VERDICT_WINDING_MAX = 5;

// --- Chicanes (story 3.8) ---

/** Une ligne droite ne s'écarte jamais de plus que ça de sa corde, en mètres : à 2 m, on la passe sans tourner dans la largeur de `road` */
export const CHICANE_STRAIGHT_TOLERANCE = 2;
/** Longueur à partir de laquelle une ligne droite reçoit une chicane, en mètres */
export const CHICANE_MIN_STRAIGHT = 400;
/** Écart minimal entre deux chicanes, en mètres : c'est le plafond d'une par km */
export const CHICANE_SPACING = 1000;
/** Distance gardée avec les lignes de départ et d'arrivée, en mètres */
export const CHICANE_LINE_CLEARANCE = 150;
/** Distance gardée avec les plages exclues (ponts, jonctions), en mètres */
export const CHICANE_EXCLUDED_CLEARANCE = 60;
/** Distance gardée avec les extrémités de la ligne droite, pour voir la chicane arriver, en mètres */
export const CHICANE_STRAIGHT_MARGIN = 100;
/** Distance entre les centres des deux blocs le long de la route, en mètres : à régler au volant */
export const CHICANE_GAP = 24;
/** Passage libre minimal, en mètres : 1,8 m de voiture, roues comprises, et 0,6 m de marge de chaque côté */
export const CHICANE_MIN_PASSAGE = 3;
/** Part de la largeur laissée libre : la chicane reste aussi serrée sur une route large */
export const CHICANE_PASSAGE_RATIO = 0.5;
/** Largeur de route que chaque bloc doit couvrir pour forcer un écart, en mètres. Avec le passage minimal : route de 5 m au moins. */
export const CHICANE_MIN_BLOCKED = 2;
/** Prolongement du bloc au-delà du bord de la route, en mètres : pas de contournement par le bas-côté */
export const CHICANE_SHOULDER_OVERHANG = 3;
/** Épaisseur d'un bloc le long de la route, barrières comprises, en mètres */
export const CHICANE_BLOCK_DEPTH = 2.2;
/** Épaisseur de la pile de bottes, entre les deux barrières, en mètres */
export const CHICANE_STACK_DEPTH = 1.2;
/** Hauteur de la pile au-dessus de la route, en mètres : dépasse les 2,94 m de l'œil de la caméra de poursuite, donc cache toute la sortie */
export const CHICANE_STACK_HEIGHT = 3.3;
/** Hauteur de la barrière de rubalise, en mètres */
export const CHICANE_BARRIER_HEIGHT = 1.2;
/** Partie enterrée des modèles sous le niveau de la route, en mètres : rien ne flotte en pente ni sur un bas-côté en contrebas */
export const CHICANE_SKIRT = 0.6;
/** Écart toléré entre une chicane demandée et l'axe, en mètres : au-delà, elle est retirée plutôt que déplacée */
export const CHICANE_SNAP_TOLERANCE = 15;
/** Écart minimal entre deux chicanes demandées, en mètres : plus près, la seconde gênerait la sortie de la première */
export const CHICANE_MIN_SEPARATION = 100;

// --- Aller-retour (story 3.7) ---

/** Un point du GPX recopie un autre s'il en est à moins de ça, en mètres : l'éditeur écrit deux fois les mêmes coordonnées */
export const ROUND_TRIP_COPY_TOLERANCE = 0.01;
/** Bras commun minimal pour reconnaître un aller-retour, en mètres : en dessous, c'est une simple boucle fermée */
export const ROUND_TRIP_MIN_ARM = 20;
/** En dessous, en mètres, ce qui reste entre l'aller et le retour n'est pas une boucle mais un cul-de-sac. Au-dessus, c'est le rayon qui tranche. */
export const ROUND_TRIP_MIN_LOOP = 20;
/** Écart de hauteur toléré entre aller et retour dans la fourche, en mètres : à confirmer au volant */
export const ROUND_TRIP_MAX_FORK_GAP = 0.05;
/** Fondu autour de la fourche, en points : au-delà, chaque passage retrouve sa propre altitude */
export const ROUND_TRIP_FORK_FADE = 15;
/** Écart signalé entre la vraie route de retour et la recopie de l'aller, en mètres */
export const ROUND_TRIP_RETURN_DEVIATION = 5;
/** Écart aller / retour réels sous lequel leur route est commune, en mètres. La seconde si la première ne laisse aucun bras : voies séparées par un îlot. */
export const ROUND_TRIP_FORK_TOLERANCES = [1.5, 5];
/** Largeur de route supposée pour juger si les deux côtés d'une boucle ont la place de coexister, en mètres */
export const ROUND_TRIP_SPLIT_WIDTH = 6.5;
/** Longueur sur laquelle le vrai retour est rabattu sur la jonction, en mètres */
export const ROUND_TRIP_REJOIN = 30;
/** Points du bras pris en compte pour la courbure à la jonction : elle n'est pas un bout de route */
export const WIDEN_ARM_CONTEXT = 8;

// --- Éditeur : retour, chicanes du joueur et variantes (stories 3.7, 3.9 et 3.10). Rien ici ne touche à la spéciale générée. ---

/** Le retour réel n'est demandé à BRouter que sur cette distance après le retournement, en mètres : au-delà, il recopie l'aller */
export const EDITOR_RETURN_PROBE = 500;
/** Bras donné comme commun avant ce point : deux voies séparées jusque-là font quand même une jonction, en mètres */
export const EDITOR_RETURN_LEAD = 100;
/** Écart minimal entre deux chicanes le long du tracé, en mètres : une chicane en mesure 26 */
export const EDITOR_CHICANE_MIN_GAP = 80;
/** Une chicane du joueur se recale à cette distance au plus, en mètres : une branche voisine, plus loin, ne la récupère pas */
export const EDITOR_CHICANE_SETTLE_REACH = 10;
/** Une chicane automatique à cette distance d'une chicane supprimée ne revient pas, en mètres */
export const EDITOR_CHICANE_REMOVED_REACH = 100;
/** Pas d'un déplacement au clavier, en mètres */
export const EDITOR_CHICANE_NUDGE = 20;
/** Requêtes par recherche de variantes, `alternativeidx` de 0 à 3 */
export const VARIANT_REQUESTS = 4;
/** Deux routes qui ne s'écartent jamais de plus que ça sont la même, en mètres */
export const VARIANT_SAME_ROUTE_GAP = 25;
