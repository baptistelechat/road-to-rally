// Garde-fous de l'éditeur : les mêmes fonctions que le pipeline, mais tout est signalé au lieu de lever à la première erreur.
// Pure et sans réseau. Le contrôle hors de France arrive avec les altitudes : il n'est pas ici.
import { findRoundabouts } from "./roundabouts";
import { toOsmWays, type HighwaySegment } from "./osm";
import {
  findRoadContact,
  isForkPair,
  roadForkReach,
} from "../sim/track/roadContact";
import {
  LINE_BRANCH_CLEARANCE,
  LINE_BRANCH_DETOUR,
  MAX_STAGE_LENGTH,
  MIN_RADIUS,
  ROUND_TRIP_RETURN_DEVIATION,
  STEP,
  WIDENED_DEVIATION,
  WIDENED_MERGE,
  WIDENED_SEARCH_REACH,
} from "./config";
import { StageError, formatKm } from "./errors";
import {
  axisFromGpx,
  cleanedPlane,
  closestOnPolyline,
  deadEndRefusal,
  detectRoundTrip,
  drivenPath,
  findTraceContact,
  lengthRefusal,
  parseGpx,
  polylineLength,
  project,
  roundTripRefusal,
  runoffMark,
  selfCrossingRefusal,
  uniqueAxis,
  unproject,
  type LatLon,
  type PlanePoint,
  type TracePoints,
} from "./gpx";
import { deduceRoadAttributes } from "./osm";

export type TraceIssueCode =
  | "tooShort"
  | "tooLong"
  | "selfCrossing"
  | "roadContact"
  | "lineTooClose"
  | "widened"
  /** Aller-retour sans rien pour faire demi-tour au bout */
  | "deadEnd"
  /** Boucle d'aller-retour trop serrée, ou départ dans le retournement */
  | "tightLoop"
  /** Non bloquant : la vraie route de retour s'écarte de la recopie de l'aller */
  | "returnDeviation";

export interface TraceIssue {
  code: TraceIssueCode;
  /** Texte en français, à afficher tel quel */
  message: string;
  /** Abscisse en mètres depuis la ligne de départ, négative dans le prolongement */
  s: number;
  /** Endroit fautif. `null` seulement si le GPX ne contient aucun point. */
  position: LatLon | null;
  /** Faux : à signaler, sans empêcher de rouler */
  blocking: boolean;
  /** L'autre abscisse concernée : portion rejointe (`selfCrossing`, `roadContact`) ou branche voisine (`lineTooClose`) */
  otherS?: number;
  /** L'autre endroit concerné. Pour `widened`, le point de la route d'origine. */
  otherPosition?: LatLon;
}

export interface AnalyzedAxis extends TracePoints {
  /** `points` en lat/lon, dans le même ordre. Départ à `runoffPoints`, arrivée à `points.length - 1 - runoffPoints`. */
  latLon: LatLon[];
}

export interface TraceAnalysis {
  /** Axe qui sera roulé. `null` si le GPX est illisible ou d'une longueur sans espoir, sous 250 m ou au-delà de 30 km au total. */
  axis: AnalyzedAxis | null;
  issues: TraceIssue[];
  /** Îlots incassables des ronds-points roulés, comme la spéciale les posera. Absent : aucun. */
  roundabouts?: { position: LatLon; radius: number }[];
}

export type { HighwaySegment } from "./osm";

export interface AnalyzeOptions {
  /** Tags `highway` de BRouter, d'où la largeur estimée. Sans eux, la largeur par défaut partout. */
  widthsByHighway?: HighwaySegment[];
  /** Vraie route de retour d'un aller-retour, `splitRoundTrip().realReturn` : l'écart avec la recopie est signalé, jamais corrigé. */
  realReturn?: LatLon[];
}

const planeDistance = (a: PlanePoint, b: PlanePoint): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

/** Le GPX n'a pas donné d'axe : le refus se place directement sur ses points. */
const hopelessAnalysis = (
  gpxText: string,
  error: StageError,
): TraceAnalysis => {
  const raw = parseGpx(gpxText);
  if (error.code !== "tooLong") {
    const end = raw[raw.length - 1] ?? null;
    const run = runoffMark(gpxText) ?? 0;
    const length = end
      ? polylineLength(raw.map((p) => project(p, raw[0]))) - 2 * run
      : 0;
    return {
      axis: null,
      issues: [
        {
          code: "tooShort",
          message: error.message,
          s: Math.max(0, length),
          position: end,
          blocking: true,
        },
      ],
    };
  }

  // Trop long : là où passe la limite, en suivant le GPX depuis la ligne de départ.
  let remaining = MAX_STAGE_LENGTH + (runoffMark(gpxText) ?? 0);
  let position = raw[0];
  for (let i = 1; i < raw.length && remaining > 0; i++) {
    const step = planeDistance(
      project(raw[i], raw[0]),
      project(raw[i - 1], raw[0]),
    );
    const t = step > 0 ? Math.min(1, remaining / step) : 1;
    position = {
      lat: raw[i - 1].lat + (raw[i].lat - raw[i - 1].lat) * t,
      lon: raw[i - 1].lon + (raw[i].lon - raw[i - 1].lon) * t,
    };
    remaining -= step;
  }
  return {
    axis: null,
    issues: [
      {
        code: "tooLong",
        message: error.message,
        s: MAX_STAGE_LENGTH,
        position,
        blocking: true,
      },
    ],
  };
};

/** Point de l'autre branche le plus proche d'une ligne, `null` au-delà de `LINE_BRANCH_CLEARANCE`. */
const closestBranch = (
  points: PlanePoint[],
  line: number,
): { index: number; distance: number } | null => {
  let best: { index: number; distance: number } | null = null;
  points.forEach((point, index) => {
    const distance = planeDistance(point, points[line]);
    if (
      distance < LINE_BRANCH_CLEARANCE &&
      Math.abs(index - line) * STEP > LINE_BRANCH_DETOUR * distance &&
      (!best || distance < best.distance)
    )
      best = { index, distance };
  });
  return best;
};

/**
 * Distance de chaque point de `from` à la polyligne `to`, en la suivant dans le même sens pour ne pas
 * s'accrocher à une branche voisine. `from` et `to` décrivent la même route, sans repartir en arrière.
 */
const followPolyline = (
  from: PlanePoint[],
  to: PlanePoint[],
): { distance: number; index: number; point: PlanePoint }[] => {
  let cursor = 0;
  return from.map((p, i) => {
    // Un GPX peut sauter des centaines de mètres entre deux points : la portée suit le pas.
    const stride = i > 0 ? planeDistance(p, from[i - 1]) : 0;
    const reach = WIDENED_SEARCH_REACH + 1.5 * stride;
    let best = { distance: Infinity, index: cursor, point: to[cursor] };
    let walked = 0;
    for (let j = cursor; j < to.length - 1 && walked < reach; j++) {
      const a = to[j];
      const b = to[j + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      const t =
        len2 > 0
          ? Math.max(
              0,
              Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2),
            )
          : 0;
      const point = { x: a.x + dx * t, z: a.z + dz * t };
      const distance = planeDistance(p, point);
      if (distance < best.distance) best = { distance, index: j, point };
      // La portion du curseur ne compte pas : assez longue, elle cacherait la suivante et le suivi resterait bloqué.
      if (j > cursor) walked += Math.sqrt(len2);
    }
    cursor = best.index;
    return best;
  });
};

/** Portions où l'axe s'écarte de la route d'origine, repérées à l'écart le plus grand de chacune. */
const findWidened = (
  gpxText: string,
  trace: TracePoints,
): { index: number; deviation: number; road: PlanePoint }[] => {
  const raw = parseGpx(gpxText);
  const trip = detectRoundTrip(raw);
  // Le retour d'un aller-retour n'a rien à apprendre : il recopie l'aller. Deux chaussées : chacune sur sa droite.
  const road = trace.dual
    ? drivenPath(cleanedPlane(raw, trace.origin)).path
    : (trip?.kind === "loop" ? raw.slice(0, raw.length - trip.armEnd) : raw).map(
        (p) => project(p, trace.origin),
      );
  // Le prolongement inventé d'un GPX sans marquage n'a pas de route d'origine.
  const first = trace.realRunoff ? 0 : trace.runoffPoints;
  const axis = trace.roundTrip
    ? uniqueAxis(trace).slice(first)
    : trace.points.slice(first, trace.points.length - first);

  const deviation = followPolyline(axis, road).map(({ distance, point }) => ({
    distance,
    road: point,
  }));
  // Dans les deux sens : à la pointe d'un angle vif, l'axe arrondi reste près des côtés mais loin de la pointe.
  followPolyline(road, axis).forEach(({ distance, index }, i) => {
    if (distance > deviation[index].distance)
      deviation[index] = { distance, road: road[i] };
  });

  const portions: { index: number; deviation: number; road: PlanePoint }[] = [];
  let lastOver = -Infinity;
  deviation.forEach(({ distance, road: nearest }, i) => {
    if (distance <= WIDENED_DEVIATION) return;
    const current = portions[portions.length - 1];
    if (!current || (i - lastOver) * STEP > WIDENED_MERGE)
      portions.push({ index: i + first, deviation: distance, road: nearest });
    else if (distance > current.deviation) {
      current.index = i + first;
      current.deviation = distance;
      current.road = nearest;
    }
    lastOver = i;
  });
  return portions;
};

/** Plus grand écart entre le bras recopié et la vraie route de retour, en sens inverse de l'axe. */
const returnDeviation = (
  trace: TracePoints,
  realReturn: LatLon[],
): { index: number; deviation: number; road: PlanePoint } | null => {
  const armEnd = trace.roundTrip?.armEnd ?? 0;
  const first = trace.realRunoff ? 0 : trace.runoffPoints;
  const road = realReturn.map((p) => project(p, trace.origin));
  if (road.length < 2 || armEnd <= first) return null;
  let worst: { index: number; deviation: number; road: PlanePoint } | null =
    null;
  for (let index = first; index <= armEnd; index++) {
    const { distance, point } = closestOnPolyline(trace.points[index], road);
    if (!worst || distance > worst.deviation)
      worst = { index, deviation: distance, road: point };
  }
  return worst;
};

export const analyzeTrace = (
  gpxText: string,
  { widthsByHighway, realReturn }: AnalyzeOptions = {},
): TraceAnalysis => {
  let trace: TracePoints;
  try {
    trace = axisFromGpx(gpxText);
  } catch (error) {
    if (error instanceof StageError) return hopelessAnalysis(gpxText, error);
    throw error;
  }

  const { origin, points, runoffPoints, length } = trace;
  const latLon = points.map((p) => unproject(p, origin));
  const at = (index: number): LatLon =>
    latLon[Math.max(0, Math.min(latLon.length - 1, index))];
  const startOf = (index: number): number => (index - runoffPoints) * STEP;
  const issues: TraceIssue[] = [];

  const refusal = lengthRefusal(length);
  if (refusal?.code === "tooShort")
    issues.push({
      code: "tooShort",
      message: refusal.message,
      s: length,
      position: at(points.length - 1 - runoffPoints),
      blocking: true,
    });
  if (refusal?.code === "tooLong")
    issues.push({
      code: "tooLong",
      message: refusal.message,
      s: MAX_STAGE_LENGTH,
      position: at(runoffPoints + Math.round(MAX_STAGE_LENGTH / STEP)),
      blocking: true,
    });

  const deadEnd = deadEndRefusal(gpxText, trace);
  if (deadEnd)
    issues.push({
      code: "deadEnd",
      message: deadEnd.error.message,
      s: startOf(deadEnd.index),
      position: at(deadEnd.index),
      blocking: true,
    });
  const roundTrip = trace.roundTrip;
  const tight = roundTripRefusal(trace);
  if (roundTrip && tight)
    issues.push({
      code: "tightLoop",
      message: tight.message,
      s: startOf(roundTrip.armEnd),
      position: at(roundTrip.armEnd),
      blocking: true,
    });

  // Un cul-de-sac revient forcément sur lui-même : le refus ci-dessus le dit mieux.
  const crossing = deadEnd ? null : findTraceContact(trace);
  if (crossing)
    issues.push({
      code: "selfCrossing",
      message: selfCrossingRefusal(crossing, runoffPoints).message,
      s: startOf(crossing.a),
      position: at(crossing.a),
      blocking: true,
      otherS: startOf(crossing.b),
      otherPosition: at(crossing.b),
    });
  else if (!deadEnd) {
    // Comme le pipeline : un croisement refuse le tracé avant de regarder les chaussées, qui le signaleraient aussi.
    const { widths } = deduceRoadAttributes(
      trace,
      widthsByHighway ? toOsmWays(widthsByHighway) : null,
    );
    const unique = uniqueAxis(trace);
    const reach = roundTrip
      ? roadForkReach(unique, widths, roundTrip.armEnd, roundTrip.returnStart)
      : 0;
    const contact = findRoadContact(
      unique.map((p) => ({ x: p.x, y: 0, z: p.z })),
      widths.slice(0, unique.length),
      roundTrip &&
        ((i, j) =>
          isForkPair(i, j, roundTrip.armEnd, roundTrip.returnStart, reach)),
    );
    if (contact) {
      const a = Math.round(contact.sA / STEP);
      const b = Math.round(contact.sB / STEP);
      issues.push({
        code: "roadContact",
        message: `Deux portions de route se touchent : le ${formatKm(startOf(a))} rejoint le ${formatKm(startOf(b))}. Éloigne-les en déplaçant un point.`,
        s: startOf(a),
        position: at(a),
        blocking: true,
        otherS: startOf(b),
        otherPosition: at(b),
      });
    }
  }

  const lines = [
    { index: runoffPoints, name: "de départ", s: 0, fix: "le début" },
    {
      index: points.length - 1 - runoffPoints,
      name: "d'arrivée",
      s: length,
      fix: "la fin",
    },
  ];
  for (const { index, name, s, fix } of lines) {
    // Aller-retour : l'arrivée tombe sur le départ, et seule la portion unique compte comme autre branche.
    if (roundTrip && index !== runoffPoints) continue;
    const branch = closestBranch(uniqueAxis(trace), index);
    if (branch)
      issues.push({
        code: "lineTooClose",
        message: `La ligne ${name} n'est qu'à ${Math.round(branch.distance)} m d'une autre portion de la route, au ${formatKm(startOf(branch.index))} : il en faut au moins ${LINE_BRANCH_CLEARANCE}. Déplace ${fix} du tracé.`,
        s,
        position: at(index),
        blocking: true,
        otherS: startOf(branch.index),
        otherPosition: at(branch.index),
      });
  }

  for (const { index, deviation, road } of findWidened(gpxText, trace))
    issues.push({
      code: "widened",
      message: `Au ${formatKm(startOf(index))}, le virage est arrondi à ${MIN_RADIUS} m de rayon : la route roulée s'écarte de ${Math.round(deviation)} m de la route réelle.`,
      s: startOf(index),
      position: at(index),
      blocking: false,
      otherPosition: unproject(road, origin),
    });

  const gap =
    roundTrip && realReturn ? returnDeviation(trace, realReturn) : null;
  if (gap && gap.deviation > ROUND_TRIP_RETURN_DEVIATION)
    issues.push({
      code: "returnDeviation",
      message: `Au ${formatKm(startOf(gap.index))}, la vraie route de retour passe à ${Math.round(gap.deviation)} m de la route de l'aller : le retour reprend quand même l'aller, en sens inverse.`,
      s: startOf(gap.index),
      position: at(gap.index),
      blocking: false,
      otherPosition: unproject(gap.road, origin),
    });

  const osmWays = widthsByHighway ? toOsmWays(widthsByHighway) : null;
  const roundabouts = findRoundabouts(
    uniqueAxis(trace),
    deduceRoadAttributes(trace, osmWays).widths,
    osmWays,
    origin,
  ).map(({ x, z, radius }) => ({
    position: unproject({ x, z }, origin),
    radius,
  }));

  return { axis: { ...trace, latLon }, issues, roundabouts };
};
