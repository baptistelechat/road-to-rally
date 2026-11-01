import type { MeshData, TrackSample, Vec3 } from "../types";
import { SHOULDER_WIDTH, shoulderWidths } from "./roadContact";

export { SHOULDER_WIDTH };

// Brique réutilisable par le pipeline géo : des points et une largeur, rien sur le sandbox.
// Convention : `lateral` > 0 à droite du sens de marche, droite = (-tz, tx) sur le plan horizontal.

/** Altitude du sol hors route : juste sous une route à y = 0, pour que les raycasts touchent d'abord la route. */
export const GROUND_Y = -0.04;
/** Pente du talus sous une route surélevée, vertical / horizontal */
const TALUS_SLOPE = 0.2;
/** Largeur mini du talus : évite tout triangle dégénéré là où la route rejoint le sol */
const TALUS_MIN_WIDTH = 0.5;
/** Part maximale du rayon local utilisable par un décalage côté intérieur du virage */
const MAX_RADIUS_RATIO = 0.85;
/** Écart mini entre deux bords ramenés au même rayon : une bande reste une bande, jamais un triangle plat */
const MIN_STRIP_WIDTH = 0.02;
/** Retrait du dessus de la digue sous la chaussée d'un tracé ouvert, voir `embankment` */
const ROAD_TROUGH_DEPTH = 0.5;
/** Le dessus de la digue reste sous le bord de la chaussée : un rayon pile sur l'arête retombe dessus, pas au pied */
const ROAD_TROUGH_OVERLAP = 0.1;

/** Décalage ou largeur : le même partout, ou un par point de l'axe. */
type PerPoint = number | number[];

const valueAt = (value: PerPoint, i: number): number =>
  typeof value === "number" ? value : value[i];

const largest = (value: PerPoint): number =>
  typeof value === "number"
    ? Math.abs(value)
    : value.reduce((max, v) => Math.max(max, Math.abs(v)), 0);

interface Frames {
  /** Vecteur droite (x, z) de chaque point */
  rightX: number[];
  rightZ: number[];
  /** Décalage maximal sans repli, de chaque côté */
  maxRight: number[];
  maxLeft: number[];
}

const buildFrames = (
  points: Vec3[],
  closed: boolean,
  reach: number,
): Frames => {
  const n = points.length;
  const at = (i: number): Vec3 =>
    closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];

  const rightX: number[] = [];
  const rightZ: number[] = [];
  const curvature: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const prev = at(i - 1);
    const here = points[i];
    const next = at(i + 1);
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    rightX.push(-tz / len);
    rightZ.push(tx / len);
    const ax = here.x - prev.x;
    const az = here.z - prev.z;
    const bx = next.x - here.x;
    const bz = next.z - here.z;
    const turn = Math.atan2(ax * bz - az * bx, ax * bx + az * bz);
    const step = (Math.hypot(ax, az) + Math.hypot(bx, bz)) / 2;
    total += step;
    // Signe : positif quand la route tourne à droite, donc intérieur à droite.
    // Aux extrémités d'un tracé ouvert, un des deux côtés est nul : atan2(-0, -0) y vaudrait -π et pincerait la route.
    const isEnd = !closed && (i === 0 || i === n - 1);
    curvature.push(step > 0 && !isEnd ? turn / step : 0);
  }

  // Un décalage déforme aussi le voisinage : on prend le pire rayon sur une fenêtre de la taille du décalage.
  const window = Math.ceil(reach / (total / n || 1)) + 1;
  const maxRight: number[] = [];
  const maxLeft: number[] = [];
  for (let i = 0; i < n; i++) {
    let right = 0;
    let left = 0;
    for (let k = -window; k <= window; k++) {
      const j = i + k;
      if (!closed && (j < 0 || j >= n)) continue;
      const c = curvature[(j + n * (Math.floor(Math.abs(j) / n) + 1)) % n];
      if (c > right) right = c;
      if (-c > left) left = c * -1;
    }
    maxRight.push(right > 0 ? MAX_RADIUS_RATIO / right : Infinity);
    maxLeft.push(left > 0 ? MAX_RADIUS_RATIO / left : Infinity);
  }
  return { rightX, rightZ, maxRight, maxLeft };
};

const clampLateral = (frames: Frames, i: number, lateral: number): number =>
  lateral > 0
    ? Math.min(lateral, frames.maxRight[i])
    : Math.max(lateral, -frames.maxLeft[i]);

/**
 * Bande plate le long de l'axe, entre deux décalages latéraux (`left` < `right`), uniques ou un par point.
 * Le côté intérieur d'un virage trop serré est ramené en deçà du rayon local : la route rétrécit au lieu de se replier.
 */
export const lateralStrip = (
  points: Vec3[],
  closed: boolean,
  left: PerPoint,
  right: PerPoint,
  lift: PerPoint = 0,
): MeshData => {
  const n = points.length;
  const frames = buildFrames(
    points,
    closed,
    Math.max(largest(left), largest(right)),
  );
  const positions = new Float32Array(n * 6);
  points.forEach((p, i) => {
    let l = clampLateral(frames, i, valueAt(left, i));
    let r = clampLateral(frames, i, valueAt(right, i));
    if (r - l < MIN_STRIP_WIDTH) {
      if (l > 0) l = r - MIN_STRIP_WIDTH;
      else r = l + MIN_STRIP_WIDTH;
    }
    const y = p.y + valueAt(lift, i);
    positions.set(
      [
        p.x + frames.rightX[i] * l,
        y,
        p.z + frames.rightZ[i] * l,
        p.x + frames.rightX[i] * r,
        y,
        p.z + frames.rightZ[i] * r,
      ],
      i * 6,
    );
  });
  const segments = closed ? n : n - 1;
  const indices = new Uint32Array(segments * 6);
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    indices.set([a, a + 1, b, a + 1, b + 1, b], i * 6);
  }
  return { positions, indices };
};

/** Maillage de route : deux sommets par point de l'axe, sans doublon à la fermeture. */
export const ribbon = (
  points: Vec3[],
  width: PerPoint,
  closed: boolean,
): MeshData =>
  typeof width === "number"
    ? lateralStrip(points, closed, -width / 2, width / 2)
    : lateralStrip(
        points,
        closed,
        width.map((w) => -w / 2),
        width.map((w) => w / 2),
      );

/**
 * Bas-côtés gauche et droit. Le bord extérieur de chaque bande (sommet 0 à gauche, sommet 1 à droite de chaque paire)
 * est aussi une contrainte du terrain : tout passe par ici pour que les sommets restent identiques au bit près.
 */
export const shoulderStrips = (
  points: Vec3[],
  widths: number[],
  shoulders: number[],
  closed: boolean,
): [MeshData, MeshData] => {
  const half = widths.map((w) => w / 2);
  const edge = half.map((h, i) => h + shoulders[i]);
  const negate = (values: number[]) => values.map((v) => -v);
  return [
    lateralStrip(points, closed, negate(edge), negate(half), GROUND_Y),
    lateralStrip(points, closed, half, edge, GROUND_Y),
  ];
};

const talusWidth = (roadY: number, cap: number): number =>
  Math.min(TALUS_MIN_WIDTH + roadY / TALUS_SLOPE, cap);

/**
 * Plafond du talus. Le circuit n'en a pas. Sur un tracé ouvert, c'est le bas-côté local : 200 m de dénivelé
 * feraient sinon 1 km de large, et le talus de la branche haute d'une épingle recouvrirait la branche basse.
 */
// ponytail: en altitude la digue devient une falaise, laide mais roulable : seule une spéciale sans terrain s'en sert.
const talusCap = (shoulder: number, closed: boolean): number =>
  closed ? Infinity : Math.max(TALUS_MIN_WIDTH, shoulder);

/**
 * Talus sous les portions surélevées : un dessus plat sous la route et le bas-côté, puis une pente jusqu'au sol.
 * Le dessus passe sous toute la largeur : aucun trou possible entre la route et le talus.
 * `null` si la route reste au niveau du sol.
 */
// ponytail: route supposée à y >= 0, une route sous le sol demandera une vraie surface de terrain (epic 2).
export const embankment = (
  points: Vec3[],
  width: PerPoint,
  closed: boolean,
): MeshData | null => {
  const n = points.length;
  const maxY = points.reduce((max, p) => Math.max(max, p.y), 0);
  if (maxY <= 0) return null;
  const widths =
    typeof width === "number" ? new Array<number>(n).fill(width) : width;
  const shoulders = shoulderWidths(points, widths, closed);
  const frames = buildFrames(
    points,
    closed,
    largest(widths) / 2 +
      SHOULDER_WIDTH +
      talusWidth(maxY, talusCap(SHOULDER_WIDTH, closed)),
  );

  const positions: number[] = [];
  const indices: number[] = [];
  const ringStart = new Map<number, number>();
  const ring = (i: number): number => {
    const known = ringStart.get(i);
    if (known !== undefined) return known;
    const start = positions.length / 3;
    const p = points[i];
    const shelf = widths[i] / 2 + shoulders[i];
    const outer = shelf + talusWidth(p.y, talusCap(shoulders[i], closed));
    const shelfY = p.y + GROUND_Y;
    const outerLeft = clampLateral(frames, i, -outer);
    const outerRight = clampLateral(frames, i, outer);
    let shelfLeft = clampLateral(frames, i, -shelf);
    let shelfRight = clampLateral(frames, i, shelf);
    if (!closed) {
      // Côté intérieur d'une épingle, le dessus et le pied se rejoignent : une falaise, pas une arête confondue.
      shelfLeft = Math.max(shelfLeft, outerLeft + MIN_STRIP_WIDTH);
      shelfRight = Math.min(shelfRight, outerRight - MIN_STRIP_WIDTH);
    }
    // En épingle et en pente, chaque quad de la bande est gauche : le dessus de la digue, triangulé plus large,
    // percerait la chaussée de plusieurs centimètres. Sur tracé ouvert, il se retire donc sous la route.
    const section: [number, number][] = closed
      ? [
          [outerLeft, GROUND_Y],
          [shelfLeft, shelfY],
          [shelfRight, shelfY],
          [outerRight, GROUND_Y],
        ]
      : [
          [outerLeft, GROUND_Y],
          [shelfLeft, shelfY],
          [
            Math.max(
              clampLateral(frames, i, -widths[i] / 2) + ROAD_TROUGH_OVERLAP,
              shelfLeft + MIN_STRIP_WIDTH,
            ),
            shelfY - ROAD_TROUGH_DEPTH,
          ],
          [
            Math.min(
              clampLateral(frames, i, widths[i] / 2) - ROAD_TROUGH_OVERLAP,
              shelfRight - MIN_STRIP_WIDTH,
            ),
            shelfY - ROAD_TROUGH_DEPTH,
          ],
          [shelfRight, shelfY],
          [outerRight, GROUND_Y],
        ];
    for (const [l, y] of section)
      positions.push(p.x + frames.rightX[i] * l, y, p.z + frames.rightZ[i] * l);
    ringStart.set(i, start);
    return start;
  };

  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % n;
    if (points[i].y <= 0 && points[j].y <= 0) continue;
    const a = ring(i);
    const b = ring(j);
    const quads = closed ? 3 : 5;
    for (let k = 0; k < quads; k++)
      indices.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
};

/**
 * Hauteur du sol (talus compris) à une distance donnée de l'axe : la même forme que `embankment`.
 * `shoulder` et `closed` ne changent le résultat que sur un tracé ouvert.
 */
export const groundHeight = (
  sample: TrackSample,
  width: number,
  shoulder = SHOULDER_WIDTH,
  closed = true,
): number => {
  const roadY = sample.point.y;
  if (roadY <= 0) return GROUND_Y;
  const shelf = width / 2 + shoulder;
  if (sample.distance <= shelf) return roadY + GROUND_Y;
  const t =
    (sample.distance - shelf) / talusWidth(roadY, talusCap(shoulder, closed));
  return t >= 1 ? GROUND_Y : GROUND_Y + roadY * (1 - t);
};
