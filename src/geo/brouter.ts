import type { SegmentWay } from "../editor/types";
import {
  BROUTER_MAX_RETRIES,
  BROUTER_PROFILE,
  BROUTER_RETRY_DELAY,
  BROUTER_TIMEOUT,
  BROUTER_URL,
} from "./config";
import { StageError } from "./errors";
import { project, type LatLon } from "./gpx";
import { requestText, type HttpOptions, type RetryPolicy } from "./http";

export interface BRouterOptions extends HttpOptions {
  /** Index de l'itinéraire, de 0 à 3 (story 3.10) */
  alternativeIdx?: number;
}

export interface BRouterRoute {
  /** Un seul point quand les deux extrémités sont confondues : BRouter renvoie alors l'endroit où il accroche */
  points: LatLon[];
  ways: SegmentWay[];
  /** Longueur en mètres, mesurée comme le pipeline */
  length: number;
}

export type FetchRoute = (
  from: LatLon,
  to: LatLon,
  options?: BRouterOptions,
) => Promise<BRouterRoute>;

/** BRouter a bien répondu mais ne peut pas relier ces points : réessayer ne servirait à rien. */
export class RouteRefused extends StageError {
  constructor(message: string) {
    super("service", message);
    this.name = "RouteRefused";
  }
}

const POLICY: RetryPolicy = {
  service: "Le service d'itinéraire BRouter",
  retries: BROUTER_MAX_RETRIES,
  delay: (attempt) => BROUTER_RETRY_DELAY * 2 ** attempt,
  timeout: BROUTER_TIMEOUT,
  shouldRetry: (status) => status === 429 || status >= 500,
};

const unreadable = (): StageError =>
  new StageError(
    "service",
    "Le service d'itinéraire BRouter a renvoyé une réponse illisible. Réessaie dans un moment.",
  );

/** Texte d'une réponse 400 : `from-position not mapped in existing datafile`, etc. */
const refusalFromText = (text: string): RouteRefused => {
  if (text.includes("from-position"))
    return new RouteRefused(
      "Aucune route près du premier point de ce tronçon : place-le sur une route.",
    );
  if (text.includes("to-position"))
    return new RouteRefused(
      "Aucune route près de ce point (en mer ou trop loin d'une route ?) : place-le sur une route.",
    );
  if (/via\d+-position/.test(text))
    return new RouteRefused(
      "Aucune route près d'un point de passage : place-le sur une route.",
    );
  return new RouteRefused(
    "Aucune route trouvée entre ces deux points : rapproche-les.",
  );
};

/** `requestText` ne donne ni le corps d'une erreur ni la cause d'un échec : une `StageError` levée ici le traverse telle quelle. */
const inspectingFetch =
  (doFetch: typeof fetch): typeof fetch =>
  async (url, init) => {
    let response: Response;
    try {
      response = await doFetch(url, init);
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError")
        throw new StageError(
          "network",
          "Le service d'itinéraire BRouter met trop de temps à répondre. Réessaie dans un moment.",
        );
      throw error;
    }
    if (response.status === 400) throw refusalFromText(await response.text());
    return response;
  };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parsePoints = (coordinates: unknown): LatLon[] => {
  if (!Array.isArray(coordinates) || coordinates.length === 0)
    throw unreadable();
  return coordinates.map((coordinate: unknown) => {
    if (!Array.isArray(coordinate)) throw unreadable();
    const [lon, lat] = coordinate as unknown[];
    if (
      typeof lon !== "number" ||
      typeof lat !== "number" ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      throw unreadable();
    return { lat, lon };
  });
};

const microDegrees = (value: number): number => Math.round(value * 1e6);

const tagsOf = (wayTags: unknown): Omit<SegmentWay, "fromIndex"> => {
  const text = typeof wayTags === "string" ? wayTags : "";
  const highway = /(?:^| )highway=(\S+)/.exec(text)?.[1];
  const surface = /(?:^| )surface=(\S+)/.exec(text)?.[1];
  return {
    ...(highway ? { highway } : {}),
    ...(surface ? { surface } : {}),
  };
};

/**
 * Chaque ligne de `messages` décrit la portion qui se termine à ses coordonnées, en 1e-6 degré.
 * Des tags illisibles laissent une portion sans tags : ils informent, la géométrie seule fait foi.
 */
const parseWays = (messages: unknown, points: LatLon[]): SegmentWay[] => {
  const ways: SegmentWay[] = [];
  const push = (way: SegmentWay): void => {
    const last = ways[ways.length - 1];
    if (!last || last.highway !== way.highway || last.surface !== way.surface)
      ways.push(way);
  };
  const [header, ...rows]: unknown[] = Array.isArray(messages) ? messages : [];
  const columns: unknown[] = Array.isArray(header) ? header : [];
  const lonColumn = columns.indexOf("Longitude");
  const latColumn = columns.indexOf("Latitude");
  const tagsColumn = columns.indexOf("WayTags");
  let start = 0;
  if (lonColumn >= 0 && latColumn >= 0 && tagsColumn >= 0) {
    for (const row of rows) {
      if (!Array.isArray(row)) break;
      const lon = Number(row[lonColumn]);
      const lat = Number(row[latColumn]);
      const end = points.findIndex(
        (point, i) =>
          i > start &&
          microDegrees(point.lon) === lon &&
          microDegrees(point.lat) === lat,
      );
      if (end < 0) break;
      push({ fromIndex: start, ...tagsOf(row[tagsColumn]) });
      start = end;
    }
  }
  if (start < points.length - 1 || ways.length === 0)
    push({ fromIndex: start });
  return ways;
};

const routeLength = (points: LatLon[]): number => {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const { x, z } = project(points[i], points[i - 1]);
    length += Math.hypot(x, z);
  }
  return length;
};

/** Une réponse d'un service tiers : rien n'est supposé sur sa forme. */
export const parseBRouterRoute = (text: string): BRouterRoute => {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw unreadable();
  }
  const feature: unknown =
    isRecord(body) && Array.isArray(body.features) ? body.features[0] : null;
  if (!isRecord(feature) || !isRecord(feature.geometry)) throw unreadable();
  const points = parsePoints(feature.geometry.coordinates);
  const messages = isRecord(feature.properties)
    ? feature.properties.messages
    : null;
  return {
    points,
    ways: parseWays(messages, points),
    length: routeLength(points),
  };
};

const lonLat = (point: LatLon): string =>
  `${point.lon.toFixed(6)},${point.lat.toFixed(6)}`;

export const fetchRoute: FetchRoute = async (from, to, options = {}) => {
  const url =
    `${BROUTER_URL}?lonlats=${lonLat(from)}|${lonLat(to)}&profile=${BROUTER_PROFILE}` +
    `&alternativeidx=${options.alternativeIdx ?? 0}&format=geojson`;
  const text = await requestText(url, {}, POLICY, {
    ...options,
    fetch: inspectingFetch(options.fetch ?? fetch),
  });
  return parseBRouterRoute(text);
};
