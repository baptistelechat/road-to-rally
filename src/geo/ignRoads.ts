// Tronçons de route de la BD TOPO (IGN), présentés comme des voies OSM : ponts, tunnels, classes et ronds-points sans Overpass.
// Même service que le décor (CORS ouvert, une requête par seconde), bien plus fiable qu'Overpass, saturé en 2026.
import { OVERPASS_MARGIN } from "./config";
import {
  WFS_MAX_PAGES,
  WFS_MAX_RETRIES,
  WFS_MIN_INTERVAL,
  WFS_PAGE_SIZE,
  WFS_RETRY_DELAY,
  WFS_TIMEOUT,
  WFS_URL,
} from "./decor/config";
import { StageError } from "./errors";
import {
  unproject,
  uniqueAxis,
  type LatLon,
  type PlanePoint,
  type TracePoints,
} from "./gpx";
import {
  defaultSleep,
  requestText,
  throwIfAborted,
  type HttpOptions,
  type RetryPolicy,
} from "./http";
import type { OsmWay } from "./osm";

const LAYER = "BDTOPO_V3:troncon_de_route";
const PROPERTIES =
  "cleabs,nature,importance,position_par_rapport_au_sol,nombre_de_voies,sens_de_circulation,urbain,geometrie";
/** Longueur d'axe couverte par une boîte, en mètres : une seule boîte serait immense sur un tracé en diagonale */
const CHUNK_LENGTH = 2500;

const POLICY: RetryPolicy = {
  service: "Le service des routes de l'IGN",
  retries: WFS_MAX_RETRIES,
  delay: (attempt) => WFS_RETRY_DELAY * (attempt + 1),
  timeout: WFS_TIMEOUT,
  shouldRetry: (status) => status === 429 || status >= 500,
};

/** Classe `importance` de la BD TOPO (1 la plus grande) vers la classe OSM de largeur type comparable. */
const HIGHWAY_BY_IMPORTANCE: Readonly<Record<string, string>> = {
  "1": "trunk",
  "2": "primary",
  "3": "secondary",
  "4": "tertiary",
  "5": "unclassified",
  "6": "residential",
};

/** `null` : pas une route où passe une voiture (sentier, escalier, piste cyclable, bac). */
export const highwayOf = (
  nature: string,
  importance: string,
): string | null => {
  switch (nature) {
    case "Type autoroutier":
      return "motorway";
    case "Bretelle":
      return "primary_link";
    case "Route à 1 chaussée":
    case "Route à 2 chaussées":
    case "Rond-point":
      return HIGHWAY_BY_IMPORTANCE[importance] ?? "unclassified";
    case "Route empierrée":
    case "Chemin":
      return "track";
    default:
      return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const positiveNumber = (value: unknown): number | null => {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) && number > 0
    ? number
    : null;
};

/** Coordonnées `[lon, lat, z]` de la BD TOPO. */
const toLines = (geometry: unknown): LatLon[][] => {
  if (!isRecord(geometry) || !Array.isArray(geometry.coordinates)) return [];
  const lines: unknown[] =
    geometry.type === "LineString"
      ? [geometry.coordinates]
      : geometry.type === "MultiLineString"
        ? geometry.coordinates
        : [];
  return lines
    .map((line) =>
      Array.isArray(line)
        ? line.flatMap((point: unknown): LatLon[] =>
            Array.isArray(point) &&
            typeof point[0] === "number" &&
            typeof point[1] === "number"
              ? [{ lat: point[1], lon: point[0] }]
              : [],
          )
        : [],
    )
    .filter((line) => line.length >= 2);
};

/** Un tronçon BD TOPO en voies au format OSM, sans identifiant. Vide si ce n'est pas une route. */
export const toIgnWays = (
  properties: Record<string, unknown>,
  geometry: unknown,
): Omit<OsmWay, "id">[] => {
  const text = (key: string): string => {
    const value = properties[key];
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";
  };
  const highway = highwayOf(text("nature"), text("importance"));
  if (!highway) return [];
  const tags: Record<string, string> = { highway };
  // ponytail: `largeur_de_chaussee` ignorée : 5,5 m uniformes sur toute une départementale (Turini, Landes, 21/11),
  // une valeur par défaut plutôt qu'une mesure, et 1 m plus étroite que les routes du réglage. La classe et les voies suffisent.
  const lanes = positiveNumber(properties.nombre_de_voies);
  if (lanes !== null && Number.isInteger(lanes)) tags.lanes = String(lanes);
  // 1 à 3 : pont (niveaux superposés), -1 à -3 : tunnel, 0 : au sol.
  const level = Number(text("position_par_rapport_au_sol"));
  if (level > 0) tags.bridge = "yes";
  if (level < 0) tags.tunnel = "yes";
  if (text("nature") === "Rond-point") tags.junction = "roundabout";
  // En agglomération : sert au style des ponts (pierre dans les bourgs).
  if (properties.urbain === true || text("urbain") === "true") tags.urban = "yes";
  const direction = text("sens_de_circulation");
  const reversed = direction === "Sens inverse";
  if (direction === "Sens direct" || reversed) tags.oneway = "yes";
  // Sens inverse : la ligne est retournée, et `oneway=yes` suit alors son sens de tracé, comme dans OSM.
  return toLines(geometry).map((line) => ({
    tags,
    geometry: reversed ? [...line].reverse() : line,
  }));
};

/** Une boîte `ouest,sud,est,nord` par tronçon de `CHUNK_LENGTH` m d'axe, élargie de la marge d'Overpass. */
const chunkBoxes = (axis: PlanePoint[], origin: LatLon): string[] => {
  const boxes: string[] = [];
  let start = 0;
  let length = 0;
  for (let i = 1; i < axis.length; i++) {
    length += Math.hypot(axis[i].x - axis[i - 1].x, axis[i].z - axis[i - 1].z);
    if (length < CHUNK_LENGTH && i < axis.length - 1) continue;
    const chunk = axis.slice(start, i + 1);
    const xs = chunk.map((p) => p.x);
    const zs = chunk.map((p) => p.z);
    // z vers le sud : le plus grand z donne le sud.
    const southWest = unproject(
      {
        x: Math.min(...xs) - OVERPASS_MARGIN,
        z: Math.max(...zs) + OVERPASS_MARGIN,
      },
      origin,
    );
    const northEast = unproject(
      {
        x: Math.max(...xs) + OVERPASS_MARGIN,
        z: Math.min(...zs) - OVERPASS_MARGIN,
      },
      origin,
    );
    boxes.push(
      [southWest.lon, southWest.lat, northEast.lon, northEast.lat]
        .map((v) => v.toFixed(6))
        .join(","),
    );
    start = i;
    length = 0;
  }
  return boxes;
};

const pageUrl = (bbox: string, startIndex: number): string =>
  `${WFS_URL}?${new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: LAYER,
    SRSNAME: "EPSG:4326",
    OUTPUTFORMAT: "application/json",
    // Longitude puis latitude sur ce service, vérifié le 21/11.
    BBOX: `${bbox},EPSG:4326`,
    PROPERTYNAME: PROPERTIES,
    COUNT: String(WFS_PAGE_SIZE),
    STARTINDEX: String(startIndex),
  }).toString()}`;

interface RoadFeature {
  id: string;
  properties: Record<string, unknown>;
  geometry: unknown;
}

/** `null` si la page n'a pas la forme d'une réponse WFS. */
const parsePage = (body: string): RoadFeature[] | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.features)) return null;
  return parsed.features.flatMap((feature: unknown): RoadFeature[] => {
    if (!isRecord(feature) || !isRecord(feature.properties)) return [];
    const id = feature.properties.cleabs ?? feature.id;
    return typeof id === "string"
      ? [{ id, properties: feature.properties, geometry: feature.geometry }]
      : [];
  });
};

/**
 * Les routes du couloir, au format OSM. `null` si la Géoplateforme ne répond pas ou répond mal :
 * le pipeline essaie alors Overpass. Seule une annulation remonte.
 */
export const fetchIgnWays = async (
  trace: TracePoints,
  options: HttpOptions,
): Promise<OsmWay[] | null> => {
  const axis = uniqueAxis(trace);
  if (axis.length < 2) return null;
  const sleep = options.sleep ?? defaultSleep;
  const features = new Map<string, Omit<OsmWay, "id">[]>();
  let lastRequest = -Infinity;
  try {
    for (const bbox of chunkBoxes(axis, trace.origin))
      for (let page = 0; page < WFS_MAX_PAGES; page++) {
        throwIfAborted(options.signal);
        // Une requête par seconde au plus, comme le décor.
        const wait = lastRequest + WFS_MIN_INTERVAL - Date.now();
        if (wait > 0) await sleep(wait, options.signal);
        lastRequest = Date.now();
        const items = parsePage(
          await requestText(
            pageUrl(bbox, page * WFS_PAGE_SIZE),
            {},
            POLICY,
            options,
          ),
        );
        if (items === null) return null;
        for (const { id, properties, geometry } of items)
          features.set(id, toIgnWays(properties, geometry));
        if (items.length < WFS_PAGE_SIZE) break;
      }
  } catch (error) {
    if (!(error instanceof StageError) || error.code === "aborted") throw error;
    return null;
  }
  // Ordre fixe par identifiant : mêmes données, mêmes voies, même résultat.
  const ids = [...features.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let next = 0;
  return ids.flatMap((id) =>
    (features.get(id) ?? []).map((way) => ({ id: next++, ...way })),
  );
};
