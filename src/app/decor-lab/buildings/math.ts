import { ShapeUtils, Vector2 } from "three";

// Géométrie plane des emprises (plan x/z, y vers le haut), sans dépendance au rendu.

export interface Point {
  x: number;
  z: number;
}

export type Vec3 = [number, number, number];

/** Repère orienté du rectangle englobant le plus serré : `u` le long du grand côté, `v` en travers. */
export interface Frame {
  ux: number;
  uz: number;
  vx: number;
  vz: number;
  /** Milieu du rectangle sur chaque axe */
  uMid: number;
  vMid: number;
  /** Demi-longueur et demi-largeur */
  halfU: number;
  halfV: number;
}

/** Arête d'un contour à aire positive : `n` est la normale sortante. */
export interface Edge {
  a: Point;
  b: Point;
  length: number;
  ux: number;
  uz: number;
  nx: number;
  nz: number;
}

const MERGE_DISTANCE = 0.05;

export const distance = (a: Point, b: Point): number =>
  Math.hypot(b.x - a.x, b.z - a.z);

export const signedArea = (ring: Point[]): number => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return sum / 2;
};

/** Contour sans doublons, orienté à aire positive : intérieur à gauche de chaque arête. */
export const normalizeRing = (source: Point[]): Point[] => {
  const ring: Point[] = [];
  for (const p of source) {
    const last = ring[ring.length - 1];
    if (!last || distance(last, p) > MERGE_DISTANCE)
      ring.push({ x: p.x, z: p.z });
  }
  while (
    ring.length > 3 &&
    distance(ring[0], ring[ring.length - 1]) <= MERGE_DISTANCE
  )
    ring.pop();
  return signedArea(ring) < 0 ? ring.reverse() : ring;
};

export const edgeOf = (ring: Point[], i: number): Edge => {
  const a = ring[i];
  const b = ring[(i + 1) % ring.length];
  const length = Math.max(distance(a, b), 1e-9);
  const ux = (b.x - a.x) / length;
  const uz = (b.z - a.z) / length;
  return { a, b, length, ux, uz, nx: uz, nz: -ux };
};

/** Convexe à quelques degrés près : les sommets presque alignés sont tolérés. */
export const isConvex = (ring: Point[]): boolean => {
  for (let i = 0; i < ring.length; i++) {
    const e1 = edgeOf(ring, i);
    const e2 = edgeOf(ring, (i + 1) % ring.length);
    if (e1.ux * e2.uz - e1.uz * e2.ux < -0.03) return false;
  }
  return true;
};

export const inside = (p: Point, ring: Point[]): boolean => {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      result = !result;
  }
  return result;
};

/**
 * Décalage du contour : > 0 vers l'extérieur (débord de toit), < 0 vers l'intérieur (acrotère).
 * Une distance par arête possible : 0 sur un mur mitoyen, le toit ne déborde pas chez le voisin.
 */
export const offsetRing = (ring: Point[], d: number | number[]): Point[] => {
  const at = (k: number): number => (typeof d === "number" ? d : d[k]);
  const limit =
    typeof d === "number" ? Math.abs(d) : Math.max(...d.map(Math.abs));
  return ring.map((v, i) => {
    const k = (i - 1 + ring.length) % ring.length;
    const prev = edgeOf(ring, k);
    const next = edgeOf(ring, i);
    // Point dont la distance à chaque ligne d'arête vaut son décalage : a·n1 = d1, a·n2 = d2.
    const det = prev.nx * next.nz - prev.nz * next.nx;
    let ax: number;
    let az: number;
    if (Math.abs(det) < 0.05) {
      // Arêtes presque alignées : on garde le décalage de l'arête suivante.
      ax = next.nx * at(i);
      az = next.nz * at(i);
    } else {
      ax = (at(k) * next.nz - at(i) * prev.nz) / det;
      az = (prev.nx * at(i) - next.nx * at(k)) / det;
    }
    // Onglet borné : un angle très aigu ne projette pas un sommet à dix mètres.
    const length = Math.hypot(ax, az);
    const scale =
      length > limit * 4.5 && length > 0 ? (limit * 4.5) / length : 1;
    return { x: v.x + ax * scale, z: v.z + az * scale };
  });
};

const frameFromAxes = (
  ring: Point[],
  ux: number,
  uz: number,
  vx: number,
  vz: number,
): Frame => {
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const p of ring) {
    const u = p.x * ux + p.z * uz;
    const v = p.x * vx + p.z * vz;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  return {
    ux,
    uz,
    vx,
    vz,
    uMid: (minU + maxU) / 2,
    vMid: (minV + maxV) / 2,
    halfU: (maxU - minU) / 2,
    halfV: (maxV - minV) / 2,
  };
};

/** Rectangle englobant le plus serré aligné sur un mur ; `u` suit toujours le grand côté. */
export const obbFrame = (ring: Point[]): Frame => {
  let best: Frame | null = null;
  for (let i = 0; i < ring.length; i++) {
    const e = edgeOf(ring, i);
    if (e.length < 1e-3) continue;
    const f = frameFromAxes(ring, e.ux, e.uz, -e.uz, e.ux);
    const oriented =
      f.halfU >= f.halfV ? f : frameFromAxes(ring, -e.uz, e.ux, e.ux, e.uz);
    if (!best || oriented.halfU * oriented.halfV < best.halfU * best.halfV)
      best = oriented;
  }
  return best ?? frameFromAxes(ring, 1, 0, 0, 1);
};

/** Repère imposé : `v` (le travers, perpendiculaire au faîtage) suit la direction donnée. */
export const frameAcross = (ring: Point[], vx: number, vz: number): Frame => {
  const length = Math.hypot(vx, vz) || 1;
  const nvx = vx / length;
  const nvz = vz / length;
  return frameFromAxes(ring, nvz, -nvx, nvx, nvz);
};

/** Garde la partie du polygone où `f` ≤ 0 (Sutherland-Hodgman sur une fonction affine). */
export const clipPolygon = (
  poly: Point[],
  f: (p: Point) => number,
): Point[] => {
  const result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = f(a);
    const fb = f(b);
    if (fa <= 0) result.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      const t = fa / (fa - fb);
      result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return result;
};

export const triangulate = (ring: Point[]): number[][] =>
  ShapeUtils.triangulateShape(
    ring.map((p) => new Vector2(p.x, p.z)),
    [],
  );

export const fract = (value: number): number => ((value % 1) + 1) % 1;

/** Graine stable tirée de la position : deux voisins se distinguent, sans hasard. */
export const seedOf = (ring: Point[]): number => {
  let x = 0;
  let z = 0;
  for (const p of ring) {
    x += p.x;
    z += p.z;
  }
  return fract(
    Math.sin((x / ring.length) * 12.9898 + (z / ring.length) * 78.233) *
      43758.5453,
  );
};

export const pick = <T>(list: T[], seed: number): T =>
  list[Math.min(list.length - 1, Math.floor(seed * list.length))];

/** Distance d'un point à un segment */
export const segmentDistance = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const t =
    lengthSq < 1e-12
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / lengthSq),
        );
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
};

/** Arête mitoyenne : son milieu touche (à 30 cm près) une arête d'un voisin. */
export const isPartyEdge = (
  a: Point,
  b: Point,
  neighbors: Point[][],
): boolean => {
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  return neighbors.some((ring) =>
    ring.some(
      (p, i) => segmentDistance(mid, p, ring[(i + 1) % ring.length]) < 0.3,
    ),
  );
};
