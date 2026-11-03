// Ronds-points : un îlot incassable au centre de chaque anneau roulé, pour qu'on ne le coupe pas par le terre-plein.
import {
  ROUNDABOUT_EDGE_MARGIN,
  ROUNDABOUT_MAX_RADIUS,
  ROUNDABOUT_MAX_RESIDUAL,
  ROUNDABOUT_MIN_ISLAND,
  ROUNDABOUT_MIN_ON_RING,
  ROUNDABOUT_MIN_RADIUS,
  ROUNDABOUT_RING_LANE,
  STEP,
} from "./config";
import {
  polylineLength,
  project,
  roundMm,
  type LatLon,
  type PlanePoint,
} from "./gpx";
import type { OsmWay } from "./osm";

export interface Roundabout {
  /** Centre de l'îlot, dans le plan de la spéciale */
  x: number;
  z: number;
  /** Rayon de l'îlot, en mètres : le bord de la route roulée reste à `ROUNDABOUT_EDGE_MARGIN` de sa barrière */
  radius: number;
}

/** Deux bouts de voie plus proches que ça se suivent, en mètres : OSM coupe souvent un anneau en plusieurs voies. */
const JOIN_DISTANCE = 1;

/** Seulement le tag : une boucle de lotissement fermée et ronde n'est pas un rond-point. */
const isRing = ({ tags }: OsmWay): boolean =>
  tags.junction === "roundabout" || tags.junction === "circular";

/** Cercle des moindres carrés (Kåsa), sur des points recentrés pour garder la précision. `null` : points alignés. */
const fitCircle = (
  points: PlanePoint[],
): { x: number; z: number; radius: number; residual: number } | null => {
  const mx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const mz = points.reduce((sum, p) => sum + p.z, 0) / points.length;
  let sxx = 0;
  let sxz = 0;
  let szz = 0;
  let sxr = 0;
  let szr = 0;
  for (const p of points) {
    const x = p.x - mx;
    const z = p.z - mz;
    const r2 = x * x + z * z;
    sxx += x * x;
    sxz += x * z;
    szz += z * z;
    sxr += x * r2;
    szr += z * r2;
  }
  const det = sxx * szz - sxz * sxz;
  if (Math.abs(det) < 1e-9) return null;
  // Recentré, le terme constant s'annule : centre = (a, b) solution de [sxx sxz; sxz szz] (a, b) = (sxr, szr) / 2.
  const a = (szz * sxr - sxz * szr) / (2 * det);
  const b = (sxx * szr - sxz * sxr) / (2 * det);
  const distances = points.map((p) => Math.hypot(p.x - mx - a, p.z - mz - b));
  const radius = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const residual =
    distances.reduce((sum, d) => sum + Math.abs(d - radius), 0) /
    distances.length;
  return { x: mx + a, z: mz + b, radius, residual };
};

/** Voies d'un même anneau, réunies par leurs bouts. */
// ponytail: comparaison de tous les bouts deux à deux, assez pour les quelques anneaux d'une spéciale.
const groupRings = (rings: PlanePoint[][]): PlanePoint[][][] => {
  const groups: PlanePoint[][][] = [];
  for (const ring of rings) {
    const ends = [ring[0], ring[ring.length - 1]];
    const touching = groups.filter((group) =>
      group.some((other) =>
        [other[0], other[other.length - 1]].some((end) =>
          ends.some(
            (mine) =>
              Math.hypot(mine.x - end.x, mine.z - end.z) < JOIN_DISTANCE,
          ),
        ),
      ),
    );
    const merged = [ring, ...touching.flat()];
    for (const group of touching) groups.splice(groups.indexOf(group), 1);
    groups.push(merged);
  }
  return groups;
};

/**
 * Les ronds-points que la route roulée emprunte, avec un îlot qui laisse toute sa chaussée libre.
 * `ways` : voies d'Overpass (anneaux entiers) ou portions de BRouter (seulement l'arc roulé) ; le cercle ajusté vaut pour les deux.
 */
export const findRoundabouts = (
  axis: PlanePoint[],
  widths: number[],
  ways: OsmWay[] | null,
  origin: LatLon,
): Roundabout[] => {
  const rings = (ways ?? [])
    .filter(isRing)
    .map(({ geometry }) => geometry.map((p) => project(p, origin)));
  const found: { index: number; roundabout: Roundabout }[] = [];
  for (const group of groupRings(rings)) {
    const circle = fitCircle(group.flat());
    if (
      !circle ||
      circle.radius < ROUNDABOUT_MIN_RADIUS ||
      circle.radius > ROUNDABOUT_MAX_RADIUS ||
      circle.residual > ROUNDABOUT_MAX_RESIDUAL * circle.radius ||
      // Un arc trop court se prend pour n'importe quel virage.
      group.reduce((sum, way) => sum + polylineLength(way), 0) < circle.radius
    )
      continue;
    const band = Math.max(3, 0.25 * circle.radius);
    let onRing = 0;
    let first = -1;
    const cap = circle.radius - ROUNDABOUT_RING_LANE;
    let island = cap;
    axis.forEach((p, i) => {
      const d = Math.hypot(p.x - circle.x, p.z - circle.z);
      if (Math.abs(d - circle.radius) <= band) {
        onRing++;
        if (first < 0) first = i;
      }
      // Jamais sur la chaussée roulée, quel que soit le point : ni à l'entrée, ni à la sortie, ni sur une autre portion.
      island = Math.min(island, d - widths[i] / 2 - ROUNDABOUT_EDGE_MARGIN);
    });
    if (
      onRing * STEP < ROUNDABOUT_MIN_ON_RING ||
      island < ROUNDABOUT_MIN_ISLAND
    )
      continue;
    found.push({
      index: first,
      roundabout: {
        x: roundMm(circle.x),
        z: roundMm(circle.z),
        radius: roundMm(island),
      },
    });
  }
  // L'ordre de création des colliders compte : celui du passage, pas celui d'Overpass.
  return found
    .sort((a, b) => a.index - b.index)
    .map(({ roundabout }) => roundabout);
};
