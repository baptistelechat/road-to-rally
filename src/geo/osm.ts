import {
  DEFAULT_WIDTH,
  HIGHWAY_WIDTHS,
  LANE_WIDTH,
  MAJOR_ROAD_WIDTH,
  MAX_WIDTH,
  MIN_WIDTH,
  OSM_DIRECTION_WEIGHT,
  OSM_MATCH_DISTANCE,
  OVERPASS_MARGIN,
  OVERPASS_MAX_RETRIES,
  OVERPASS_RETRY_DELAY,
  OVERPASS_SERVER_TIMEOUT,
  OVERPASS_TIMEOUT,
  OVERPASS_URL,
  WIDTH_MEDIAN_RADIUS,
  WIDTH_SMOOTH_RADIUS,
} from "./config";
import { StageError } from "./errors";
import {
  project,
  roundMm,
  unproject,
  type LatLon,
  type PlanePoint,
  type TracePoints,
} from "./gpx";
import { requestText, type HttpOptions, type RetryPolicy } from "./http";
import { boxSmooth, medianFilter } from "./smooth";

/** Une voie telle qu'Overpass la renvoie, réduite aux tags utiles */
export interface OsmWay {
  id: number;
  tags: Record<string, string>;
  geometry: LatLon[];
}

const USEFUL_TAGS = ["highway", "lanes", "width", "bridge", "tunnel", "oneway"];
/** Voies où une voiture ne passe pas : un sentier le long de la route ne doit pas lui voler sa largeur */
const NOT_DRIVABLE =
  "footway|path|steps|cycleway|pedestrian|bridleway|corridor|platform|proposed|construction|raceway|bus_guideway";

const POLICY: RetryPolicy = {
  service: "Le service des routes OpenStreetMap",
  retries: OVERPASS_MAX_RETRIES,
  delay: () => OVERPASS_RETRY_DELAY,
  timeout: OVERPASS_TIMEOUT,
  shouldRetry: (status) => status === 429 || status === 406 || status >= 500,
};

const overpassQuery = (trace: TracePoints): string => {
  const corners = trace.points.map((p) => unproject(p, trace.origin));
  const margin = unproject(
    { x: OVERPASS_MARGIN, z: -OVERPASS_MARGIN },
    trace.origin,
  );
  const dLat = margin.lat - trace.origin.lat;
  const dLon = margin.lon - trace.origin.lon;
  const south = Math.min(...corners.map((c) => c.lat)) - dLat;
  const north = Math.max(...corners.map((c) => c.lat)) + dLat;
  const west = Math.min(...corners.map((c) => c.lon)) - dLon;
  const east = Math.max(...corners.map((c) => c.lon)) + dLon;
  const bbox = [south, west, north, east].map((v) => v.toFixed(6)).join(",");
  return `[out:json][timeout:${OVERPASS_SERVER_TIMEOUT}];way["highway"]["highway"!~"^(${NOT_DRIVABLE})$"](${bbox});out tags geom;`;
};

/** Réponse d'un service tiers : tout ce qui n'a pas la forme attendue est écarté. `null` si elle est inutilisable. */
export const parseOverpass = (body: string): OsmWay[] | null => {
  let parsed: { elements?: unknown; remark?: unknown };
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    return null;
  }
  // `remark` : le serveur a coupé la requête, la réponse est peut-être partielle.
  if (!Array.isArray(parsed.elements) || parsed.remark) return null;
  const ways: OsmWay[] = [];
  for (const element of parsed.elements as {
    id?: unknown;
    tags?: Record<string, unknown>;
    geometry?: { lat?: unknown; lon?: unknown }[];
  }[]) {
    if (typeof element.id !== "number" || !Array.isArray(element.geometry))
      continue;
    const tags: Record<string, string> = {};
    for (const key of USEFUL_TAGS) {
      const value = element.tags?.[key];
      if (typeof value === "string") tags[key] = value;
    }
    const geometry = element.geometry.flatMap(({ lat, lon }) =>
      typeof lat === "number" && typeof lon === "number" ? [{ lat, lon }] : [],
    );
    if (geometry.length >= 2) ways.push({ id: element.id, tags, geometry });
  }
  return ways;
};

/**
 * Une seule tentative de plus, après 30 s comme le demande le serveur. Indisponible : `null`, la génération continue
 * avec la largeur par défaut. Seule une annulation remonte.
 */
export const fetchOsmWays = async (
  trace: TracePoints,
  options: HttpOptions,
): Promise<OsmWay[] | null> => {
  try {
    const body = await requestText(
      OVERPASS_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: overpassQuery(trace) }).toString(),
      },
      POLICY,
      options,
    );
    return parseOverpass(body);
  } catch (error) {
    if (!(error instanceof StageError) || error.code === "aborted") throw error;
    return null;
  }
};

/** Mètres écrits simplement (`5`, `5 m`, `3,5`). Le reste, dont `narrow` et les pieds, est ignoré. */
export const parseWidthTag = (value: string): number | null => {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*m?\s*$/.exec(value);
  if (!match) return null;
  const width = Number(match[1].replace(",", "."));
  return width > 0 ? width : null;
};

export const widthFromTags = (tags: Record<string, string>): number => {
  const width = tags.width === undefined ? null : parseWidthTag(tags.width);
  const byClass = HIGHWAY_WIDTHS[tags.highway ?? ""];
  const laneCount = /^\s*[1-9]\d*\s*$/.test(tags.lanes ?? "")
    ? Number(tags.lanes)
    : null;
  const oneWay = tags.oneway !== undefined && tags.oneway !== "no";
  // À double sens, `lanes=1` sur une grande route compte souvent une voie par sens : la D763 le porte, par exemple.
  const lanes =
    laneCount === null ||
    (laneCount === 1 && byClass >= MAJOR_ROAD_WIDTH && !oneWay)
      ? null
      : laneCount * LANE_WIDTH;
  const value = width ?? lanes ?? byClass ?? DEFAULT_WIDTH;
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value));
};

const isStructure = (value: string | undefined): boolean =>
  value !== undefined && value !== "no";

export interface RoadAttributes {
  /** Largeur lissée en chaque point de l'axe */
  widths: number[];
  /** Vrai sur un pont ou un tunnel : l'IGN y donne le terrain, pas la route */
  structures: boolean[];
}

interface PlaneWay {
  way: OsmWay;
  points: PlanePoint[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const toPlaneWay = (way: OsmWay, origin: LatLon): PlaneWay => {
  const points = way.geometry.map((p) => project(p, origin));
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  return {
    way,
    points,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
};

/** Voie retenue au point i : proche et dans la même direction que l'axe. */
const matchWay = (
  point: PlanePoint,
  tangentX: number,
  tangentZ: number,
  ways: PlaneWay[],
): OsmWay | null => {
  let best: OsmWay | null = null;
  let bestScore = Infinity;
  for (const candidate of ways) {
    if (
      point.x < candidate.minX - OSM_MATCH_DISTANCE ||
      point.x > candidate.maxX + OSM_MATCH_DISTANCE ||
      point.z < candidate.minZ - OSM_MATCH_DISTANCE ||
      point.z > candidate.maxZ + OSM_MATCH_DISTANCE
    )
      continue;
    for (let i = 1; i < candidate.points.length; i++) {
      const a = candidate.points[i - 1];
      const b = candidate.points[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      if (len2 === 0) continue;
      const t = Math.max(
        0,
        Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / len2),
      );
      const distance = Math.hypot(
        a.x + dx * t - point.x,
        a.z + dz * t - point.z,
      );
      if (distance > OSM_MATCH_DISTANCE) continue;
      // 0 si la voie suit l'axe, dans un sens ou dans l'autre, 1 si elle le coupe à angle droit.
      const misalignment =
        1 - Math.abs(dx * tangentX + dz * tangentZ) / Math.sqrt(len2);
      const score = distance + OSM_DIRECTION_WEIGHT * misalignment;
      if (score < bestScore) {
        bestScore = score;
        best = candidate.way;
      }
    }
  }
  return best;
};

/** Sans voie (`ways` nul ou trop loin), la largeur par défaut. */
export const deduceRoadAttributes = (
  trace: TracePoints,
  ways: OsmWay[] | null,
): RoadAttributes => {
  const planeWays = (ways ?? []).map((way) => toPlaneWay(way, trace.origin));
  const raw: number[] = [];
  const structures: boolean[] = [];
  const { points } = trace;
  points.forEach((point, i) => {
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const norm = Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
    const way = matchWay(
      point,
      (next.x - previous.x) / norm,
      (next.z - previous.z) / norm,
      planeWays,
    );
    raw.push(way ? widthFromTags(way.tags) : DEFAULT_WIDTH);
    structures.push(
      way !== null &&
        (isStructure(way.tags.bridge) || isStructure(way.tags.tunnel)),
    );
  });
  // Le prolongement ne suit aucune voie réelle : il garde la largeur de la route qu'il continue.
  const last = points.length - 1 - trace.runoffPoints;
  for (let i = 0; i < points.length && !trace.realRunoff; i++) {
    if (i >= trace.runoffPoints && i <= last) continue;
    raw[i] = raw[i < trace.runoffPoints ? trace.runoffPoints : last];
    structures[i] = false;
  }
  const smoothed = boxSmooth(
    boxSmooth(medianFilter(raw, WIDTH_MEDIAN_RADIUS), WIDTH_SMOOTH_RADIUS),
    WIDTH_SMOOTH_RADIUS,
  );
  return { widths: smoothed.map(roundMm), structures };
};
