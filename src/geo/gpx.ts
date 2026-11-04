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
  ROUND_TRIP_COPY_TOLERANCE,
  ROUND_TRIP_FORK_TOLERANCES,
  ROUND_TRIP_MIN_ARM,
  ROUND_TRIP_MIN_LOOP,
  ROUND_TRIP_REJOIN,
  ROUND_TRIP_SPLIT_WIDTH,
  RUNOFF_ROOT,
  STAGE_RUNOFFS,
  STEP,
  WIDEN_ARM_CONTEXT,
  WIDEN_GAIN,
  WIDEN_MAX_ITERATIONS,
  WIDEN_SMOOTH_RADIUS,
} from "./config";
import {
  findRoadContact,
  forkReach,
  isForkPair,
} from "../sim/track/roadContact";
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

/** Aller-retour : `points[returnStart + k]` recopie `points[armEnd - k]`, jusqu'au bout de l'axe. */
export interface RoundTripAxis {
  /** Index de la jonction à l'aller */
  armEnd: number;
  /** Index de la jonction au retour, mêmes coordonnées */
  returnStart: number;
  /** Rayon le plus serré de la boucle après élargissement, jonction comprise, en mètres */
  loopRadius: number;
}

export interface TracePoints {
  origin: LatLon;
  /** Axe à 2 m, prolongement compris, arrondi au millimètre */
  points: PlanePoint[];
  /** Nombre de points de prolongement à chaque bout */
  runoffPoints: number;
  /** Le prolongement est la vraie route du GPX, pas une ligne droite ajoutée */
  realRunoff: boolean;
  /** Longueur hors prolongement, en mètres. Ce qui se roule deux fois compte deux fois. */
  length: number;
  /** Présent si le retour du GPX recopie l'aller */
  roundTrip?: RoundTripAxis;
}

/** Points qui n'existent qu'une fois : tout l'axe, ou le bras et la boucle d'un aller-retour. */
export const uniqueAxis = (trace: TracePoints): PlanePoint[] =>
  trace.roundTrip
    ? trace.points.slice(0, trace.roundTrip.returnStart + 1)
    : trace.points;

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

export const polylineLength = (points: PlanePoint[]): number => {
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
  /** Boucle d'un aller-retour : les points du bras avant la jonction. Ils ne bougent pas, mais la jonction n'est pas un bout de route. */
  arm: PlanePoint[] = [],
): PlanePoint[] => {
  const target = minRadius * RADIUS_MARGIN;
  const count = input.length - 1;
  const lead = arm.length;
  const armBack = [...arm].reverse();
  let points = input;
  for (let iteration = 0; iteration < WIDEN_MAX_ITERATIONS; iteration++) {
    const all = lead > 0 ? [...arm, ...points, ...armBack] : points;
    const deficit = new Array<number>(all.length).fill(0);
    let tight = false;
    // Les bouts de la boucle sont les jonctions : leur angle compte, et leurs voisins peuvent le corriger.
    const first = Math.max(1, lead);
    const last = Math.min(all.length - 2, lead + count);
    for (let i = first; i <= last; i++) {
      const curvature = curvatureAt(all, i);
      if (Math.abs(curvature) * target <= 1) continue;
      tight = true;
      deficit[i] = Math.sign(curvature) * (target - 1 / Math.abs(curvature));
    }
    if (!tight) return points;

    const push = boxSmooth(
      boxSmooth(deficit, WIDEN_SMOOTH_RADIUS),
      WIDEN_SMOOTH_RADIUS,
    );
    const moved = points.map((point, k) => {
      // Les extrémités restent en place : le tracé garde son départ et son arrivée, l'aller-retour sa jonction.
      if (k === 0 || k === points.length - 1) return point;
      const i = k + lead;
      const previous = all[i - 1];
      const next = all[i + 1];
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

/** Sous-ensemble plan du GPX, sans les points confondus. */
const thinned = (plane: PlanePoint[]): PlanePoint[] => {
  const cleaned: PlanePoint[] = [plane[0]];
  for (const planar of plane.slice(1)) {
    const last = cleaned[cleaned.length - 1];
    if (Math.hypot(planar.x - last.x, planar.z - last.z) >= GPX_MIN_SPACING)
      cleaned.push(planar);
  }
  return cleaned;
};

/** Courbe lissée à pas constant par les points donnés. */
const smoothedAxis = (cleaned: PlanePoint[]): PlanePoint[] => {
  const curve = new CatmullRomCurve3(
    cleaned.map((p) => new Vector3(p.x, 0, p.z)),
    false,
    "centripetal",
  );
  // Sans ça, l'abaque de longueur (200 divisions par défaut) laisse le pas varier dans les virages.
  curve.arcLengthDivisions = Math.ceil(
    polylineLength(cleaned) / ARC_LENGTH_RESOLUTION,
  );
  const divisions = Math.round(curve.getLength() / STEP);
  return curve.getSpacedPoints(divisions).map((p) => ({ x: p.x, z: p.z }));
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
  /** Couples recouverts par construction, à ignorer */
  skip?: (a: number, b: number) => boolean,
): { a: number; b: number } | null => {
  for (let a = 0; a < points.length; a++) {
    for (let b = a + 2; b < points.length; ) {
      const distance = Math.hypot(
        points[a].x - points[b].x,
        points[a].z - points[b].z,
      );
      if (distance < SELF_CONTACT_DISTANCE && !skip?.(a, b)) return { a, b };
      // L'axe avance d'au plus un pas à chaque point : inutile de regarder ceux qui ne peuvent pas encore revenir.
      b += Math.max(1, Math.floor((distance - SELF_CONTACT_DISTANCE) / STEP));
    }
  }
  return null;
};

/** Un GPX peut porter sa propre route avant le départ et après l'arrivée : `<desc>rally-runoff=250</desc>`. En mètres. */
export const runoffMark = (gpxText: string): number | null => {
  const marked = /<desc>rally-runoff=(\d+)<\/desc>/.exec(gpxText);
  return marked ? Number(marked[1]) : null;
};

const tooShort = (length: number): StageError =>
  new StageError(
    "tooShort",
    `Ce tracé fait ${(length / 1000).toFixed(2).replace(".", ",")} km : il en faut au moins ${String(MIN_STAGE_LENGTH / 1000).replace(".", ",")}.`,
  );

const tooLong = (length: number): StageError =>
  new StageError(
    "tooLong",
    `Ce tracé fait ${(length / 1000).toFixed(1).replace(".", ",")} km : il en faut au plus ${MAX_STAGE_LENGTH / 1000}.`,
  );

/** Refus de longueur d'un axe, `null` s'il convient. */
export const lengthRefusal = (length: number): StageError | null =>
  length < MIN_STAGE_LENGTH
    ? tooShort(length)
    : length > MAX_STAGE_LENGTH
      ? tooLong(length)
      : null;

export type RawRoundTrip =
  | { kind: "loop"; armEnd: number }
  | { kind: "deadEnd"; turn: number };

/**
 * Un GPX est un aller-retour si sa fin recopie son début, point pour point, en sens inverse : aucune marque à poser.
 * Passé la recopie, il reste la boucle du retournement. Trop courte pour en être une : un cul-de-sac.
 * Un GPS ne repasse jamais sur ses points au centimètre : un tracé enregistré ne tombe pas ici par hasard.
 */
export const detectRoundTrip = (raw: LatLon[]): RawRoundTrip | null => {
  const n = raw.length;
  if (n < 3) return null;
  const plane = raw.map((p) => project(p, raw[0]));
  const same = (i: number, j: number): boolean =>
    Math.hypot(plane[i].x - plane[j].x, plane[i].z - plane[j].z) <=
    ROUND_TRIP_COPY_TOLERANCE;
  if (!same(0, n - 1)) return null;
  let armEnd = 0;
  while (armEnd + 1 < n - 2 - armEnd && same(armEnd + 1, n - 2 - armEnd))
    armEnd++;
  if (polylineLength(plane.slice(0, armEnd + 1)) < ROUND_TRIP_MIN_ARM)
    return null;
  return polylineLength(plane.slice(armEnd, n - armEnd)) < ROUND_TRIP_MIN_LOOP
    ? { kind: "deadEnd", turn: Math.floor((n - 1) / 2) }
    : { kind: "loop", armEnd };
};

/** Point d'une polyligne le plus proche de `p`. */
export const closestOnPolyline = (
  p: PlanePoint,
  line: PlanePoint[],
): { distance: number; point: PlanePoint } => {
  let best = { distance: Infinity, point: p };
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t =
      len2 > 0
        ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2))
        : 0;
    const point = { x: a.x + dx * t, z: a.z + dz * t };
    const distance = Math.hypot(point.x - p.x, point.z - p.z);
    if (distance < best.distance) best = { distance, point };
  }
  return best;
};

export interface RoundTripPath {
  /** Bras, boucle, puis bras recopié en sens inverse : ce qu'il faut écrire dans le GPX, tel quel */
  path: LatLon[];
  /** Index de la jonction dans `path` */
  armEnd: number;
  /** Vraie route de retour de BRouter : à passer à `analyzeTrace`, pour signaler l'écart avec la recopie */
  realReturn: LatLon[];
}

/**
 * Coupe une réponse de BRouter `bras | tour | bras` en aller-retour : la jonction se place là où le vrai retour rejoint
 * l'aller, le retour est la recopie de l'aller. `via` : index du point de `route` le plus proche du tour.
 * `null` si le vrai retour ne rejoint jamais l'aller, et sur une route sans boucle : c'est un cul-de-sac.
 */
export const splitRoundTrip = (
  route: LatLon[],
  via: number,
): RoundTripPath | null => {
  const origin = route[0];
  const plane = route.map((p) => project(p, origin));
  const metric = (line: PlanePoint[]): PlanePoint[] =>
    resample(line, Math.max(1, Math.round(polylineLength(line))));
  const go = metric(plane.slice(0, via + 1));
  const back = metric(plane.slice(via));
  const gaps = go.map((p) => closestOnPolyline(p, back).distance);

  /** Point du vrai retour le plus proche de la jonction : la boucle s'arrête là. */
  const exitOf = (j: PlanePoint): number => {
    let exit = back.length - 1;
    let closest = Infinity;
    back.forEach((p, i) => {
      const distance = Math.hypot(p.x - j.x, p.z - j.z);
      if (distance < closest) {
        closest = distance;
        exit = i;
      }
    });
    return exit;
  };
  /** Les deux côtés de la boucle se touchent au-delà de la fourche : ce sont deux voies d'une même route, pas un tour. */
  const pinched = (loop: PlanePoint[]): boolean => {
    const last = loop.length - 1;
    const reach = forkReach(loop, 0, last, () => ROUND_TRIP_SPLIT_WIDTH);
    return (
      findRoadContact(
        loop.map((p) => ({ x: p.x, y: 0, z: p.z })),
        loop.map(() => ROUND_TRIP_SPLIT_WIDTH),
        (a, b) => isForkPair(a, b, 0, last, reach),
      ) !== null
    );
  };

  // Depuis le tour, où l'écart est nul, on remonte l'aller jusqu'à l'autre côté du tour, puis jusqu'au bras commun.
  // Une tolérance plus large si la première ne laisse aucun bras ou enferme dans la boucle des voies séparées par un îlot.
  let fork = 0;
  for (const tolerance of ROUND_TRIP_FORK_TOLERANCES) {
    fork = gaps.length - 1;
    while (fork > 0 && gaps[fork] <= tolerance) fork--;
    while (fork > 0 && gaps[fork] > tolerance) fork--;
    if (
      fork >= ROUND_TRIP_MIN_ARM &&
      !pinched([
        ...go.slice(fork),
        ...back.slice(1, exitOf(go[fork])),
        go[fork],
      ])
    )
      break;
  }
  if (fork < ROUND_TRIP_MIN_ARM) return null;

  const j = go[fork];
  const exit = exitOf(j);
  if (
    polylineLength([...go.slice(fork), ...back.slice(1, exit), j]) <
    ROUND_TRIP_MIN_LOOP
  )
    return null;
  // Le vrai retour arrive à côté de la jonction : on le rabat dessus plutôt que d'y faire un saut latéral.
  const dx = j.x - back[exit].x;
  const dz = j.z - back[exit].z;
  const tail = back.slice(1, exit).map((p, i, all) => {
    const w = Math.max(0, 1 - (all.length - i) / ROUND_TRIP_REJOIN);
    return { x: p.x + dx * w, z: p.z + dz * w };
  });
  const arm = go.slice(0, fork + 1).map((p) => unproject(p, origin));
  return {
    path: [
      ...arm,
      ...go.slice(fork + 1).map((p) => unproject(p, origin)),
      ...tail.map((p) => unproject(p, origin)),
      ...arm.slice().reverse(),
    ],
    armEnd: fork,
    realReturn: route.slice(via),
  };
};

/** Bras et boucle lissés une seule fois, la jonction épinglée : l'élargissement ne peut pas écarter l'aller du retour. */
const roundTripAxis = (
  plane: PlanePoint[],
  origin: LatLon,
  rawArmEnd: number,
  mark: number | null,
  minRadius: number,
): TracePoints => {
  const arm = widenTightTurns(
    smoothedAxis(thinned(plane.slice(0, rawArmEnd + 1))),
    minRadius,
  );
  const j = arm[arm.length - 1];
  const smoothed = smoothedAxis(
    thinned(plane.slice(rawArmEnd, plane.length - rawArmEnd)),
  );
  smoothed[0] = j;
  smoothed[smoothed.length - 1] = j;
  const context = arm.slice(-WIDEN_ARM_CONTEXT - 1, -1);
  const loop = widenTightTurns(smoothed, minRadius, context);

  const measured = [...context, ...loop, ...[...context].reverse()];
  let tightest = 0;
  loop.forEach((_, k) => {
    tightest = Math.max(
      tightest,
      Math.abs(curvatureAt(measured, k + context.length)),
    );
  });

  // Un GPX sans marquage reçoit sa ligne droite une fois : le retour repart dessus. Le dégagement ne regarde que l'aller.
  const body = [...arm, ...loop.slice(1)];
  const root = Math.round(RUNOFF_ROOT / STEP);
  const head = (runoff: number): PlanePoint[] =>
    extendStraight(arm[0], arm[1], Math.round(runoff / STEP));
  const clears = (runoff: number): boolean =>
    head(runoff).every((e) =>
      body
        .slice(root)
        .every((p) => Math.hypot(e.x - p.x, e.z - p.z) >= RUNOFF_CLEARANCE),
    );
  const before =
    mark === null
      ? head(
          STAGE_RUNOFFS.find(clears) ?? STAGE_RUNOFFS[STAGE_RUNOFFS.length - 1],
        ).reverse()
      : [];
  const unique = [...before, ...body].map((p) => ({
    x: roundMm(p.x),
    z: roundMm(p.z),
  }));
  const armEnd = before.length + arm.length - 1;
  const points = [...unique, ...unique.slice(0, armEnd).reverse()];
  const runoffPoints = mark === null ? before.length : Math.round(mark / STEP);
  return {
    origin,
    points,
    runoffPoints,
    realRunoff: mark !== null,
    length: polylineLength(
      points.slice(runoffPoints, points.length - runoffPoints),
    ),
    roundTrip: {
      armEnd,
      returnStart: unique.length - 1,
      loopRadius: tightest > 0 ? 1 / tightest : Infinity,
    },
  };
};

/** Portion refusée d'un aller-retour : ce qui se touche hors de la fourche, par construction recouverte. */
export const findTraceContact = (
  trace: TracePoints,
): { a: number; b: number } | null => {
  if (!trace.roundTrip) return findSelfContact(trace.points);
  const { armEnd, returnStart } = trace.roundTrip;
  const points = uniqueAxis(trace);
  const reach = forkReach(
    points,
    armEnd,
    returnStart,
    () => SELF_CONTACT_DISTANCE,
  );
  return findSelfContact(points, (a, b) =>
    isForkPair(a, b, armEnd, returnStart, reach),
  );
};

/** Cul-de-sac : le GPX revient par ses propres points sans boucle au bout. */
export const deadEndRefusal = (
  gpxText: string,
  trace: TracePoints,
): { error: StageError; index: number } | null => {
  const raw = parseGpx(gpxText);
  const trip = detectRoundTrip(raw);
  if (trip?.kind !== "deadEnd") return null;
  const turn = project(raw[trip.turn], trace.origin);
  let index = 0;
  trace.points.forEach((p, i) => {
    const best = trace.points[index];
    if (
      Math.hypot(p.x - turn.x, p.z - turn.z) <
      Math.hypot(best.x - turn.x, best.z - turn.z)
    )
      index = i;
  });
  return {
    index,
    error: new StageError(
      "selfCrossing",
      `Le tracé revient sur ses pas au ${formatKm((index - trace.runoffPoints) * STEP)} sans rien pour faire demi-tour : il faut un rond-point ou une boucle au bout de la route.`,
    ),
  };
};

/** Boucle trop serrée, ou ligne de départ au-delà de la jonction. `null` si l'aller-retour convient, ou s'il n'y en a pas. */
export const roundTripRefusal = (
  trace: TracePoints,
  minRadius: number = MIN_RADIUS,
): StageError | null => {
  if (!trace.roundTrip) return null;
  const { armEnd, loopRadius } = trace.roundTrip;
  const at = formatKm((armEnd - trace.runoffPoints) * STEP);
  if (trace.runoffPoints >= armEnd)
    return new StageError(
      "roadContact",
      "La ligne de départ tombe dans le retournement : éloigne le début du tracé du rond-point.",
    );
  return loopRadius < minRadius
    ? new StageError(
        "roadContact",
        `Le retournement du ${at} est trop serré : ${loopRadius.toFixed(1).replace(".", ",")} m de rayon, il en faut au moins ${minRadius}.`,
      )
    : null;
};

export const selfCrossingRefusal = (
  contact: { a: number; b: number },
  runoffPoints: number,
): StageError =>
  new StageError(
    "selfCrossing",
    // Avant le départ, `formatKm` afficherait « km 0,00 » : un endroit où le joueur n'a rien tracé.
    contact.a < runoffPoints
      ? `Le tracé se croise : la route ajoutée avant le départ rejoint le ${formatKm((contact.b - runoffPoints) * STEP)}. Déplace le premier point.`
      : `Le tracé se croise ou repasse sur lui-même : le ${formatKm((contact.a - runoffPoints) * STEP)} rejoint le ${formatKm((contact.b - runoffPoints) * STEP)}.`,
  );

/**
 * Axe qui sera roulé, sans juger sa longueur finale ni ses croisements : l'éditeur le montre même refusé.
 * Ne lève que sur un GPX illisible ou d'une longueur sans espoir.
 */
export const axisFromGpx = (
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
  const mark = runoffMark(gpxText);

  const plane = raw.map((point) => project(point, origin));
  const cleaned = thinned(plane);
  const rawLength = polylineLength(cleaned);
  // La longueur annoncée est celle de la spéciale, prolongement exclu, comme après lissage.
  const special = Math.max(0, rawLength - 2 * (mark ?? 0));
  if (cleaned.length < 2 || rawLength < MIN_STAGE_LENGTH / 2)
    throw tooShort(special);
  // Une montre bruitée allonge le tracé brut : on ne tranche qu'après lissage, sauf si c'est sans espoir.
  if (rawLength > MAX_STAGE_LENGTH * 2) throw tooLong(special);

  const trip = detectRoundTrip(raw);
  if (trip?.kind === "loop")
    return roundTripAxis(plane, origin, trip.armEnd, mark, minRadius);

  const smooth = widenTightTurns(smoothedAxis(cleaned), minRadius);

  const markedPoints = Math.round((mark ?? 0) / STEP);
  const length = polylineLength(
    smooth.slice(markedPoints, smooth.length - markedPoints),
  );
  if (mark !== null)
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

  return { origin, points, runoffPoints, realRunoff: false, length };
};

export const traceFromGpx = (
  gpxText: string,
  minRadius: number = MIN_RADIUS,
): TracePoints => {
  const trace = axisFromGpx(gpxText, minRadius);
  const refusal = lengthRefusal(trace.length);
  if (refusal) throw refusal;
  const deadEnd = deadEndRefusal(gpxText, trace);
  if (deadEnd) throw deadEnd.error;
  const roundTrip = roundTripRefusal(trace, minRadius);
  if (roundTrip) throw roundTrip;
  const contact = findTraceContact(trace);
  if (contact) throw selfCrossingRefusal(contact, trace.runoffPoints);
  return trace;
};
