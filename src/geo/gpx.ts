import { CatmullRomCurve3, Vector3 } from "three";
import {
  ARC_LENGTH_RESOLUTION,
  GPX_MIN_SPACING,
  MAX_STAGE_LENGTH,
  MIN_RADIUS,
  MIN_STAGE_LENGTH,
  RADIUS_MARGIN,
  SELF_CONTACT_DISTANCE,
  RUNOFF_CLEARANCE,
  RUNOFF_ROOT,
  STAGE_RUNOFFS,
  STEP,
  WIDEN_GAIN,
  WIDEN_MAX_ITERATIONS,
  WIDEN_SMOOTH_RADIUS,
} from "./config";
import { StageError, formatKm } from "./errors";
import { boxSmooth } from "./smooth";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface PlanePoint {
  x: number;
  z: number;
}

export interface TracePoints {
  origin: LatLon;
  /** Axe à 2 m, prolongement compris, arrondi au millimètre */
  points: PlanePoint[];
  /** Nombre de points de prolongement à chaque bout */
  runoffPoints: number;
  /** Le prolongement est la vraie route du GPX, pas une ligne droite ajoutée */
  realRunoff: boolean;
  /** Longueur hors prolongement, en mètres */
  length: number;
}

const METERS_PER_DEGREE = 111320;

export const roundMm = (value: number): number =>
  Math.round(value * 1000) / 1000;

/** Projection équirectangulaire locale : x vers l'est, z vers le sud. L'erreur reste négligeable sur 15 km. */
export const project = (point: LatLon, origin: LatLon): PlanePoint => ({
  x:
    (point.lon - origin.lon) *
    METERS_PER_DEGREE *
    Math.cos((origin.lat * Math.PI) / 180),
  z: -(point.lat - origin.lat) * METERS_PER_DEGREE,
});

export const unproject = (point: PlanePoint, origin: LatLon): LatLon => ({
  lat: origin.lat - point.z / METERS_PER_DEGREE,
  lon:
    origin.lon +
    point.x / (METERS_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180)),
});

const attribute = (attributes: string, name: string): number => {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`).exec(
    attributes,
  );
  return match ? Number(match[1]) : NaN;
};

/** Sans parseur XML : ni Node ni un Web Worker n'en ont, et les attributs `lat` et `lon` suffisent. */
export const parseGpx = (gpxText: string): LatLon[] => {
  const points: LatLon[] = [];
  for (const [, attributes] of gpxText.matchAll(/<trkpt\b([^>]*)>/g)) {
    const lat = attribute(attributes, "lat");
    const lon = attribute(attributes, "lon");
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) points.push({ lat, lon });
  }
  return points;
};

const polylineLength = (points: PlanePoint[]): number => {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].z - points[i - 1].z,
    );
  return length;
};

/** Points régulièrement espacés le long de la polyligne, extrémités conservées. */
const resample = (points: PlanePoint[], count: number): PlanePoint[] => {
  const spacing = polylineLength(points) / count;
  const result: PlanePoint[] = [points[0]];
  let segment = 1;
  let segmentStart = 0;
  let segmentLength = Math.hypot(
    points[1].x - points[0].x,
    points[1].z - points[0].z,
  );
  for (let i = 1; i < count; i++) {
    const target = i * spacing;
    while (
      target > segmentStart + segmentLength &&
      segment < points.length - 1
    ) {
      segmentStart += segmentLength;
      segment++;
      segmentLength = Math.hypot(
        points[segment].x - points[segment - 1].x,
        points[segment].z - points[segment - 1].z,
      );
    }
    const t = segmentLength > 0 ? (target - segmentStart) / segmentLength : 0;
    const a = points[segment - 1];
    const b = points[segment];
    result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  result.push(points[points.length - 1]);
  return result;
};

/** Courbure signée au point i par les trois points voisins. Positive quand la route tourne vers (-tz, tx). */
export const curvatureAt = (points: PlanePoint[], i: number): number => {
  const a = points[i - 1];
  const b = points[i];
  const c = points[i + 1];
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const bcx = c.x - b.x;
  const bcz = c.z - b.z;
  const product =
    Math.hypot(abx, abz) *
    Math.hypot(bcx, bcz) *
    Math.hypot(c.x - a.x, c.z - a.z);
  return product > 0 ? (2 * (abx * bcz - abz * bcx)) / product : 0;
};

/** Rayon le plus serré de l'axe, en mètres. */
export const minPlanRadius = (points: PlanePoint[]): number => {
  let max = 0;
  for (let i = 1; i < points.length - 1; i++)
    max = Math.max(max, Math.abs(curvatureAt(points, i)));
  return max > 0 ? 1 / max : Infinity;
};

/**
 * Élargit les virages trop serrés. Couper le virage par l'intérieur ne suffit pas : une épingle dont les branches
 * sont à 12 m l'une de l'autre garderait un rayon de 6 m. On pousse donc le virage vers l'extérieur, car une
 * courbe décalée de d vers l'extérieur gagne d de rayon, et les branches s'écartent d'autant.
 */
const widenTightTurns = (
  input: PlanePoint[],
  minRadius: number,
): PlanePoint[] => {
  const target = minRadius * RADIUS_MARGIN;
  const count = input.length - 1;
  let points = input;
  for (let iteration = 0; iteration < WIDEN_MAX_ITERATIONS; iteration++) {
    const deficit = new Array<number>(points.length).fill(0);
    let tight = false;
    for (let i = 1; i < points.length - 1; i++) {
      const curvature = curvatureAt(points, i);
      if (Math.abs(curvature) * target <= 1) continue;
      tight = true;
      deficit[i] = Math.sign(curvature) * (target - 1 / Math.abs(curvature));
    }
    if (!tight) return points;

    const push = boxSmooth(
      boxSmooth(deficit, WIDEN_SMOOTH_RADIUS),
      WIDEN_SMOOTH_RADIUS,
    );
    const moved = points.map((point, i) => {
      // Les extrémités restent en place : le tracé garde son départ et son arrivée.
      if (i === 0 || i === points.length - 1) return point;
      const previous = points[i - 1];
      const next = points[i + 1];
      const tx = next.x - previous.x;
      const tz = next.z - previous.z;
      const norm = Math.hypot(tx, tz) || 1;
      // Le voisinage immédiat d'un point trop serré se rapproche aussi de ses voisins : ça efface les angles vifs d'OSM.
      const corner = deficit[i] !== 0 ? 0.25 : 0;
      const offset = WIDEN_GAIN * push[i];
      return {
        x:
          point.x +
          corner * ((previous.x + next.x) / 2 - point.x) +
          (offset * tz) / norm,
        z:
          point.z +
          corner * ((previous.z + next.z) / 2 - point.z) -
          (offset * tx) / norm,
      };
    });
    points = resample(moved, count);
  }
  return points;
};

const extendStraight = (
  from: PlanePoint,
  towards: PlanePoint,
  count: number,
): PlanePoint[] => {
  const dx = from.x - towards.x;
  const dz = from.z - towards.z;
  const norm = Math.hypot(dx, dz) || 1;
  return Array.from({ length: count }, (_, i) => ({
    x: from.x + (dx / norm) * STEP * (i + 1),
    z: from.z + (dz / norm) * STEP * (i + 1),
  }));
};

/**
 * Deux points d'un axe à 2 m : tout croisement met deux sommets à moins de √2 m, et le rayon minimal garantit que
 * deux sommets non consécutifs d'une même portion restent à plus de 3 m. Un test de distance suffit donc.
 */
export const findSelfContact = (
  points: PlanePoint[],
): { a: number; b: number } | null => {
  for (let a = 0; a < points.length; a++) {
    for (let b = a + 2; b < points.length; ) {
      const distance = Math.hypot(
        points[a].x - points[b].x,
        points[a].z - points[b].z,
      );
      if (distance < SELF_CONTACT_DISTANCE) return { a, b };
      // L'axe avance d'au plus un pas à chaque point : inutile de regarder ceux qui ne peuvent pas encore revenir.
      b += Math.max(1, Math.floor((distance - SELF_CONTACT_DISTANCE) / STEP));
    }
  }
  return null;
};

export const traceFromGpx = (
  gpxText: string,
  minRadius: number = MIN_RADIUS,
): TracePoints => {
  const raw = parseGpx(gpxText);
  if (raw.length < 2)
    throw new StageError(
      "empty",
      "Ce fichier GPX ne contient pas de tracé lisible : il faut au moins 2 points.",
    );
  const origin = raw[0];

  const cleaned: PlanePoint[] = [project(raw[0], origin)];
  for (const point of raw.slice(1)) {
    const planar = project(point, origin);
    const last = cleaned[cleaned.length - 1];
    if (Math.hypot(planar.x - last.x, planar.z - last.z) >= GPX_MIN_SPACING)
      cleaned.push(planar);
  }
  const rawLength = polylineLength(cleaned);
  const tooShort = (length: number): StageError =>
    new StageError(
      "tooShort",
      `Ce tracé fait ${(length / 1000).toFixed(2).replace(".", ",")} km : il en faut au moins ${MIN_STAGE_LENGTH / 1000}.`,
    );
  const tooLong = (length: number): StageError =>
    new StageError(
      "tooLong",
      `Ce tracé fait ${(length / 1000).toFixed(1).replace(".", ",")} km : il en faut au plus ${MAX_STAGE_LENGTH / 1000}.`,
    );
  if (cleaned.length < 2 || rawLength < MIN_STAGE_LENGTH / 2)
    throw tooShort(rawLength);
  // Une montre bruitée allonge le tracé brut : on ne tranche qu'après lissage, sauf si c'est sans espoir.
  if (rawLength > MAX_STAGE_LENGTH * 2) throw tooLong(rawLength);

  const curve = new CatmullRomCurve3(
    cleaned.map((p) => new Vector3(p.x, 0, p.z)),
    false,
    "centripetal",
  );
  // Sans ça, l'abaque de longueur (200 divisions par défaut) laisse le pas varier dans les virages.
  curve.arcLengthDivisions = Math.ceil(rawLength / ARC_LENGTH_RESOLUTION);
  const divisions = Math.round(curve.getLength() / STEP);
  const smooth = widenTightTurns(
    curve.getSpacedPoints(divisions).map((p) => ({ x: p.x, z: p.z })),
    minRadius,
  );

  // Un GPX peut porter sa propre route avant le départ et après l'arrivée : `<desc>rally-runoff=250</desc>`.
  const marked = /<desc>rally-runoff=(\d+)<\/desc>/.exec(gpxText);
  const markedPoints = marked ? Math.round(Number(marked[1]) / STEP) : 0;
  const length = polylineLength(
    marked ? smooth.slice(markedPoints, -markedPoints) : smooth,
  );
  if (length < MIN_STAGE_LENGTH) throw tooShort(length);
  if (length > MAX_STAGE_LENGTH) throw tooLong(length);
  if (marked)
    return {
      origin,
      points: smooth.map((p) => ({ x: roundMm(p.x), z: roundMm(p.z) })),
      runoffPoints: markedPoints,
      realRunoff: true,
      length,
    };

  const extensions = (runoff: number): [PlanePoint[], PlanePoint[]] => [
    extendStraight(smooth[0], smooth[1], Math.round(runoff / STEP)).reverse(),
    extendStraight(
      smooth[smooth.length - 1],
      smooth[smooth.length - 2],
      Math.round(runoff / STEP),
    ),
  ];
  const root = Math.round(RUNOFF_ROOT / STEP);
  const clears = (extension: PlanePoint[], others: PlanePoint[]): boolean =>
    extension.every((e) =>
      others.every((p) => Math.hypot(e.x - p.x, e.z - p.z) >= RUNOFF_CLEARANCE),
    );
  const runoff =
    STAGE_RUNOFFS.find((candidate) => {
      const [head, tail] = extensions(candidate);
      return (
        clears(head, smooth.slice(root)) &&
        clears(tail, smooth.slice(0, -root)) &&
        clears(head, tail)
      );
    }) ?? STAGE_RUNOFFS[STAGE_RUNOFFS.length - 1];
  const runoffPoints = Math.round(runoff / STEP);
  const [before, after] = extensions(runoff);
  const points = [...before, ...smooth, ...after].map((p) => ({
    x: roundMm(p.x),
    z: roundMm(p.z),
  }));

  const contact = findSelfContact(points);
  if (contact)
    throw new StageError(
      "selfCrossing",
      `Le tracé se croise ou repasse sur lui-même : le ${formatKm((contact.a - runoffPoints) * STEP)} rejoint le ${formatKm((contact.b - runoffPoints) * STEP)}.`,
    );

  return { origin, points, runoffPoints, realRunoff: false, length };
};
