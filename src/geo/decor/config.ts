// Seuils du décor (epic 5). Changer une valeur qui modifie le décor produit impose d'incrémenter `PIPELINE_VERSION`.

/** WFS de la Géoplateforme IGN : CORS ouvert, sans clé. Testé le 15/11/2026. */
export const WFS_URL = "https://data.geopf.fr/wfs/ows";
export const WFS_LAYERS = {
  buildings: "BDTOPO_V3:batiment",
  vegetation: "BDTOPO_V3:zone_de_vegetation",
  hedges: "BDTOPO_V3:haie",
  water: "BDTOPO_V3:surface_hydrographique",
  fields: "RPG.LATEST:parcelles_graphiques",
} as const;

/** Le décor ne s'étend pas au-delà de cette distance à l'axe, en mètres : le couloir fin du terrain fait 300 m */
export const DECOR_HALF_WIDTH = 300;

/** Département de la spéciale : une seule requête, sans géométrie (les contours départementaux pèsent des mégaoctets) */
export const WFS_DEPARTMENT_LAYER = "BDTOPO_V3:departement";
export const WFS_DEPARTMENT_PROPERTY = "code_insee";
/** Demi-côté de la boîte autour de l'origine, en degrés (environ 50 m) */
export const WFS_DEPARTMENT_BOX = 0.0005;

// --- Récupération (story 5.8) ---

/**
 * Champs demandés par couche, géométrie comprise (`geometrie` pour la BD TOPO, `geom` pour le RPG, vérifié le 15/11).
 * Si le service refuse la liste ou renvoie des objets sans géométrie, la couche est redemandée sans `PROPERTYNAME`.
 */
export const WFS_PROPERTIES = {
  buildings:
    "cleabs,nature,usage_1,usage_2,construction_legere,nombre_de_logements,nombre_d_etages,hauteur," +
    "altitude_minimale_toit,altitude_maximale_toit,materiaux_de_la_toiture,materiaux_des_murs,geometrie",
  vegetation: "cleabs,nature,geometrie",
  hedges: "cleabs,geometrie",
  water: "cleabs,nature,geometrie",
  fields: "code_group,geom",
} as const;

/**
 * Longueur d'axe couverte par une requête, en mètres : une boîte par tronçon, élargie de `DECOR_HALF_WIDTH`.
 * Des tuiles de 1 km donneraient 20 à 30 boîtes pour 10 km, soit 100 à 150 requêtes à une par seconde :
 * des tronçons de 2,5 km en font 5, soit 25 requêtes pour les 5 couches, environ 45 s avec la lenteur du RPG.
 */
export const DECOR_CHUNK_LENGTH = 2500;
/** Maille du filtre de couloir, en mètres : un objet est gardé si son emprise touche une maille du couloir */
export const DECOR_CELL_SIZE = 100;
/** Objets par page : la fin se lit dans `numberMatched`, un plafond plus bas du serveur ne fait rien manquer */
export const WFS_PAGE_SIZE = 5000;
/** Pages au plus par boîte et par couche : garde-fou contre une pagination qui ne finirait pas */
export const WFS_MAX_PAGES = 20;
/** Écart minimal entre deux requêtes, en ms : le service en accepte une par seconde (`x-ratelimit-limit-second: 1`) */
export const WFS_MIN_INTERVAL = 1100;
export const WFS_TIMEOUT = 30000;
/** Le RPG répond en plusieurs secondes */
export const WFS_FIELDS_TIMEOUT = 60000;
export const WFS_MAX_RETRIES = 2;
/** Attente avant la reprise n, multipliée par n + 1 : un 429 laisse passer la seconde du service */
export const WFS_RETRY_DELAY = 2000;
/**
 * Au-delà, en ms, on renonce : sans les parcelles si elles seules restent à venir, sans décor sinon.
 * Les parcelles passent en dernier pour qu'un RPG lent ne coûte qu'elles.
 */
export const DECOR_TIME_BUDGET = 120000;
