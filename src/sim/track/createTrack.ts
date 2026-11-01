import type { MeshData, Pose, Track, TrackSample, Vec3 } from "../types";
import { groundHeight, ribbon } from "./ribbon";
import { shoulderWidths } from "./roadContact";
import { createSpatialGrid } from "./spatialGrid";

/** Hauteur de pose du centre de la caisse au-dessus de l'axe : la voiture retombe doucement sur ses suspensions. */
const POSE_LIFT = 1;
/** Côté d'une case de la grille de `nearest`, en mètres : une dizaine de segments par case à 2 m de pas */
const GRID_CELL = 16;
/** Au-delà de cette distance, en cases, la recherche par anneaux coûte plus que le parcours complet */
const GRID_MAX_RING = 20;

const poseOn = (point: Vec3, tangent: Vec3, pitched: boolean): Pose => {
  // Rotation autour de Y qui amène l'avant local (-Z) sur la tangente. À plat : un tonneau repart toujours sur ses roues.
  const yaw = Math.atan2(-tangent.x, -tangent.z);
  // Tangage suivant la route, roulis nul. Le circuit reste posé à plat.
  const pitch = pitched
    ? Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z))
    : 0;
  const sy = Math.sin(yaw / 2);
  const cy = Math.cos(yaw / 2);
  const sp = Math.sin(pitch / 2);
  const cp = Math.cos(pitch / 2);
  return {
    position: { x: point.x, y: point.y + POSE_LIFT, z: point.z },
    rotation: pitched
      ? { x: cy * sp, y: sy * cp, z: -sy * sp, w: cy * cp }
      : { x: 0, y: sy, z: 0, w: cy },
  };
};

/** Ce qu'un tracé ouvert ajoute au circuit : lignes de départ et d'arrivée, terrain. */
export interface TrackLines {
  startS: number;
  finishS: number;
  terrain: MeshData | null;
}

export const createTrack = (
  points: Vec3[],
  width: number | number[],
  closed: boolean,
  lines?: TrackLines,
): Track => {
  if (points.length < 2) throw new Error("Un tracé demande au moins 2 points");

  const n = points.length;
  const segments = closed ? n : n - 1;
  const widths =
    typeof width === "number" ? new Array<number>(n).fill(width) : width;
  if (widths.length !== n) throw new Error("Une largeur par point de l'axe");
  const shoulders = shoulderWidths(points, widths, closed);
  const tangents: Vec3[] = [];
  const starts: number[] = [];
  let length = 0;
  for (let i = 0; i < segments; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    tangents.push({ x: dx / len, y: dy / len, z: dz / len });
    starts.push(length);
    length += len;
  }

  const grid = createSpatialGrid(GRID_CELL);
  for (let i = 0; i < segments; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    grid.insert(
      i,
      Math.min(a.x, b.x),
      Math.min(a.z, b.z),
      Math.max(a.x, b.x),
      Math.max(a.z, b.z),
    );
  }

  // Segment le plus proche : à égalité, le premier dans l'ordre de l'axe.
  // Même résultat au bit près que le parcours complet, à environ 1 % du coût sur 15 km.
  const locate = (x: number, z: number) => {
    let bestD2 = Infinity;
    let bestI = 0;
    let bestT = 0;
    const test = (i: number): void => {
      const a = points[i];
      const b = points[(i + 1) % n];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz;
      const t =
        len2 > 0
          ? Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / len2))
          : 0;
      const dx = a.x + abx * t - x;
      const dz = a.z + abz * t - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2 || (d2 === bestD2 && i < bestI)) {
        bestD2 = d2;
        bestI = i;
        bestT = t;
      }
    };
    const visit = (cx: number, cz: number): void => {
      const cell = grid.at(cx, cz);
      if (cell) for (let k = 0; k < cell.length; k++) test(cell[k]);
    };

    const cx = Math.floor(x / GRID_CELL);
    const cz = Math.floor(z / GRID_CELL);
    visit(cx, cz);
    // Après l'anneau r, tout segment non vu est à plus de r cases : un meilleur strictement plus proche est définitif.
    let ring = 1;
    for (; ring <= GRID_MAX_RING; ring++) {
      for (let k = -ring; k <= ring; k++) {
        visit(cx + k, cz - ring);
        visit(cx + k, cz + ring);
      }
      for (let k = 1 - ring; k < ring; k++) {
        visit(cx - ring, cz + k);
        visit(cx + ring, cz + k);
      }
      const reach = ring * GRID_CELL;
      if (bestD2 < reach * reach) break;
    }
    if (ring > GRID_MAX_RING) for (let i = 0; i < segments; i++) test(i);
    return { i: bestI, t: bestT, d2: bestD2 };
  };

  const sampleAt = (i: number, t: number, d2: number): TrackSample => {
    const a = points[i];
    const j = (i + 1) % n;
    const b = points[j];
    const nextStart = i + 1 < segments ? starts[i + 1] : length;
    return {
      s: starts[i] + (nextStart - starts[i]) * t,
      point: {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
      },
      tangent: tangents[i],
      distance: Math.sqrt(d2),
      width: widths[i] + (widths[j] - widths[i]) * t,
    };
  };

  const nearest = (x: number, z: number): TrackSample => {
    const { i, t, d2 } = locate(x, z);
    return sampleAt(i, t, d2);
  };

  /** Point de l'axe à une abscisse donnée, bornée au tracé. */
  const sampleAtS = (s: number): TrackSample => {
    let i = segments - 1;
    while (i > 0 && starts[i] > s) i--;
    const next = i + 1 < segments ? starts[i + 1] : length;
    const t = Math.max(0, Math.min(1, (s - starts[i]) / (next - starts[i])));
    return sampleAt(i, t, 0);
  };

  const startS = lines?.startS ?? 0;
  const start = sampleAtS(startS);

  return {
    points,
    closed,
    width: widths.reduce((max, w) => Math.max(max, w), 0),
    widths,
    shoulders,
    length,
    startS,
    finishS: lines?.finishS ?? length,
    ribbon: ribbon(points, width, closed),
    terrain: lines?.terrain ?? null,
    nearest,
    surfaceAt: (x, z) => {
      const sample = nearest(x, z);
      return sample.distance <= sample.width / 2 ? "asphalt" : "grass";
    },
    groundAt: (x, z) => {
      const { i, t, d2 } = locate(x, z);
      const sample = sampleAt(i, t, d2);
      const shoulder =
        shoulders[i] + (shoulders[(i + 1) % n] - shoulders[i]) * t;
      return groundHeight(sample, sample.width, shoulder, closed);
    },
    startPose: poseOn(start.point, start.tangent, !closed),
    respawnPose: (x, z) => {
      const sample = nearest(x, z);
      return poseOn(sample.point, sample.tangent, !closed);
    },
    poseAt: (s) => {
      const sample = sampleAtS(s);
      return poseOn(sample.point, sample.tangent, !closed);
    },
    indexAt: (s) => {
      let low = 0;
      let high = segments - 1;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (starts[middle] <= s) low = middle;
        else high = middle - 1;
      }
      const next = low + 1 < segments ? starts[low + 1] : length;
      return s - starts[low] < next - s ? low : Math.min(low + 1, n - 1);
    },
  };
};
