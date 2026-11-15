// Géométrie plane partagée par la teinte du sol et l'eau (story 5.4). Pure, sans `three` : tourne dans le Worker et dans Node.
import { project, type LatLon } from "../gpx";

/** Un anneau projeté dans le plan local, sans point répété en fin */
export interface PlaneRing {
  xs: number[];
  zs: number[];
}

export const roundCm = (value: number): number => Math.round(value * 100) / 100;

export const projectRing = (ring: LatLon[], origin: LatLon): PlaneRing => {
  const xs: number[] = [];
  const zs: number[] = [];
  for (const point of ring) {
    const p = project(point, origin);
    xs.push(p.x);
    zs.push(p.z);
  }
  return { xs, zs };
};

/** Aire signée (formule du lacet) */
export const signedArea = ({ xs, zs }: PlaneRing): number => {
  let sum = 0;
  for (let i = 0, j = xs.length - 1; i < xs.length; j = i++)
    sum += xs[j] * zs[i] - xs[i] * zs[j];
  return sum / 2;
};

/**
 * Point dans un polygone à trous, règle pair-impair sur tous les anneaux : un trou inverse naturellement le résultat.
 * Demi-ouvert en z pour qu'un sommet traversé ne compte qu'une fois.
 */
export const insideRings = (
  rings: PlaneRing[],
  x: number,
  z: number,
): boolean => {
  let inside = false;
  for (const { xs, zs } of rings)
    for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
      if (zs[i] > z === zs[j] > z) continue;
      const cross = xs[j] + ((z - zs[j]) * (xs[i] - xs[j])) / (zs[i] - zs[j]);
      if (x < cross) inside = !inside;
    }
  return inside;
};

/** Points du contour tous les `step` mètres au plus, sommets compris : pour échantillonner le sol ou la route */
export const densify = (
  { xs, zs }: PlaneRing,
  step: number,
): { x: number; z: number }[] => {
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < xs.length; i++) {
    const j = (i + 1) % xs.length;
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(xs[j] - xs[i], zs[j] - zs[i]) / step),
    );
    for (let k = 0; k < count; k++) {
      const t = k / count;
      out.push({
        x: xs[i] + (xs[j] - xs[i]) * t,
        z: zs[i] + (zs[j] - zs[i]) * t,
      });
    }
  }
  return out;
};

const segmentDistance = (
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number => {
  const dx = bx - ax;
  const dz = bz - az;
  const length2 = dx * dx + dz * dz;
  const t =
    length2 > 0
      ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length2))
      : 0;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
};

/** Douglas-Peucker sur un anneau fermé : coupé en deux au sommet le plus loin du premier, chaque moitié simplifiée. */
export const simplifyRing = (ring: PlaneRing, tolerance: number): PlaneRing => {
  const { xs, zs } = ring;
  const n = xs.length;
  if (n <= 4) return ring;
  let far = 0;
  let farDistance = -1;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(xs[i] - xs[0], zs[i] - zs[0]);
    if (d > farDistance) {
      farDistance = d;
      far = i;
    }
  }
  const keep = new Array<boolean>(n).fill(false);
  keep[0] = true;
  keep[far] = true;
  // Pile explicite : pas de récursion profonde sur un contour de rivière de plusieurs milliers de points.
  const stack: [number, number][] = [
    [0, far],
    [far, n],
  ];
  while (stack.length > 0) {
    const [a, b] = stack.pop() ?? [0, 0];
    const bi = b % n;
    let worst = -1;
    let worstDistance = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = segmentDistance(xs[i], zs[i], xs[a], zs[a], xs[bi], zs[bi]);
      if (d > worstDistance) {
        worstDistance = d;
        worst = i;
      }
    }
    if (worst < 0) continue;
    keep[worst] = true;
    stack.push([a, worst], [worst, b]);
  }
  const out: PlaneRing = { xs: [], zs: [] };
  for (let i = 0; i < n; i++)
    if (keep[i]) {
      out.xs.push(xs[i]);
      out.zs.push(zs[i]);
    }
  return out.xs.length >= 3 ? out : ring;
};

/**
 * Découpe d'un anneau par un rectangle (Sutherland-Hodgman). Sur un contour concave, le morceau peut garder
 * des arêtes de largeur nulle le long du rectangle : la triangulation du rendu les absorbe.
 */
export const clipRing = (
  ring: PlaneRing,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): PlaneRing => {
  let xs = ring.xs;
  let zs = ring.zs;
  // Chaque bord : coordonnée testée (0 = x, 1 = z), limite, côté gardé (+1 au-dessus, -1 en dessous).
  const edges: [0 | 1, number, 1 | -1][] = [
    [0, minX, 1],
    [0, maxX, -1],
    [1, minZ, 1],
    [1, maxZ, -1],
  ];
  for (const [axis, limit, side] of edges) {
    if (xs.length === 0) break;
    const nextXs: number[] = [];
    const nextZs: number[] = [];
    const value = (i: number): number => (axis === 0 ? xs[i] : zs[i]);
    const inside = (i: number): boolean => (value(i) - limit) * side >= 0;
    for (let i = 0; i < xs.length; i++) {
      const j = (i + xs.length - 1) % xs.length;
      const curIn = inside(i);
      if (curIn !== inside(j)) {
        const t = (limit - value(j)) / (value(i) - value(j));
        nextXs.push(xs[j] + (xs[i] - xs[j]) * t);
        nextZs.push(zs[j] + (zs[i] - zs[j]) * t);
      }
      if (curIn) {
        nextXs.push(xs[i]);
        nextZs.push(zs[i]);
      }
    }
    xs = nextXs;
    zs = nextZs;
  }
  return { xs, zs };
};
