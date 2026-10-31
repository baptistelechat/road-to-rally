import type { MeshData, TrackSample, Vec3 } from "../types";

// Brique réutilisable par le pipeline géo : des points et une largeur, rien sur le sandbox.
// Convention : `lateral` > 0 à droite du sens de marche, droite = (-tz, tx) sur le plan horizontal.

/** Altitude du sol hors route : juste sous une route à y = 0, pour que les raycasts touchent d'abord la route. */
export const GROUND_Y = -0.04;
/** Largeur plate à côté de la route, à hauteur de route, avant que le talus descende */
export const SHOULDER_WIDTH = 2.5;
/** Pente du talus sous une route surélevée, vertical / horizontal */
const TALUS_SLOPE = 0.2;
/** Largeur mini du talus : évite tout triangle dégénéré là où la route rejoint le sol */
const TALUS_MIN_WIDTH = 0.5;
/** Part maximale du rayon local utilisable par un décalage côté intérieur du virage */
const MAX_RADIUS_RATIO = 0.85;

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
    curvature.push(step > 0 ? turn / step : 0);
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
 * Bande plate le long de l'axe, entre deux décalages latéraux (`left` < `right`).
 * Le côté intérieur d'un virage trop serré est ramené en deçà du rayon local : la route rétrécit au lieu de se replier.
 */
export const lateralStrip = (
  points: Vec3[],
  closed: boolean,
  left: number,
  right: number,
  lift = 0,
): MeshData => {
  const n = points.length;
  const frames = buildFrames(
    points,
    closed,
    Math.max(Math.abs(left), Math.abs(right)),
  );
  const positions = new Float32Array(n * 6);
  points.forEach((p, i) => {
    const l = clampLateral(frames, i, left);
    const r = clampLateral(frames, i, right);
    positions.set(
      [
        p.x + frames.rightX[i] * l,
        p.y + lift,
        p.z + frames.rightZ[i] * l,
        p.x + frames.rightX[i] * r,
        p.y + lift,
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
  width: number,
  closed: boolean,
): MeshData => lateralStrip(points, closed, -width / 2, width / 2);

const talusWidth = (roadY: number): number =>
  TALUS_MIN_WIDTH + roadY / TALUS_SLOPE;

/**
 * Talus sous les portions surélevées : un dessus plat sous la route et le bas-côté, puis une pente jusqu'au sol.
 * Le dessus passe sous toute la largeur : aucun trou possible entre la route et le talus.
 * `null` si la route reste au niveau du sol.
 */
// ponytail: route supposée à y >= 0, une route sous le sol demandera une vraie surface de terrain (epic 2).
export const embankment = (
  points: Vec3[],
  width: number,
  closed: boolean,
): MeshData | null => {
  const n = points.length;
  const shelf = width / 2 + SHOULDER_WIDTH;
  const maxY = points.reduce((max, p) => Math.max(max, p.y), 0);
  if (maxY <= 0) return null;
  const frames = buildFrames(points, closed, shelf + talusWidth(maxY));

  const positions: number[] = [];
  const indices: number[] = [];
  const ringStart = new Map<number, number>();
  const ring = (i: number): number => {
    const known = ringStart.get(i);
    if (known !== undefined) return known;
    const start = positions.length / 3;
    const p = points[i];
    const outer = shelf + talusWidth(p.y);
    const shelfY = p.y + GROUND_Y;
    const section: [number, number][] = [
      [-outer, GROUND_Y],
      [-shelf, shelfY],
      [shelf, shelfY],
      [outer, GROUND_Y],
    ];
    for (const [lateral, y] of section) {
      const l = clampLateral(frames, i, lateral);
      positions.push(p.x + frames.rightX[i] * l, y, p.z + frames.rightZ[i] * l);
    }
    ringStart.set(i, start);
    return start;
  };

  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % n;
    if (points[i].y <= 0 && points[j].y <= 0) continue;
    const a = ring(i);
    const b = ring(j);
    for (let k = 0; k < 3; k++)
      indices.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
};

/** Hauteur du sol (talus compris) à une distance donnée de l'axe : la même forme que `embankment`. */
export const groundHeight = (sample: TrackSample, width: number): number => {
  const roadY = sample.point.y;
  if (roadY <= 0) return GROUND_Y;
  const shelf = width / 2 + SHOULDER_WIDTH;
  if (sample.distance <= shelf) return roadY + GROUND_Y;
  const t = (sample.distance - shelf) / talusWidth(roadY);
  return t >= 1 ? GROUND_Y : GROUND_Y + roadY * (1 - t);
};
