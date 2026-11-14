import type {
  ChicaneBlock,
  MedianBarrier,
  RoundaboutIsland,
  MeshData,
  Pose,
  SharedRange,
  Track,
  TrackSample,
  Vec3,
} from "../types";
import { isNearBlock } from "./obstacles";
import { groundHeight, ribbon, SHOULDER_WIDTH } from "./ribbon";
import { shoulderWidths } from "./roadContact";
import { createSpatialGrid } from "./spatialGrid";

/** Hauteur de pose du centre de la caisse au-dessus de l'axe : la voiture retombe doucement sur ses suspensions. */
const POSE_LIFT = 1;
/** Côté d'une case de la grille de `nearest`, en mètres : une dizaine de segments par case à 2 m de pas */
const GRID_CELL = 16;
/** Au-delà de cette distance, en cases, la recherche par anneaux coûte plus que le parcours complet */
const GRID_MAX_RING = 20;
/** Fenêtre autour de l'abscisse suivie, en mètres : bien plus qu'un pas de simulation, moins qu'une demi-boucle (50 m au moins) */
const FOLLOW_WINDOW = 12;
/** Distance gardée entre le centre de la voiture remise en piste et un bloc de chicane, en mètres : plus d'une demi-longueur de caisse */
const RESPAWN_BLOCK_CLEARANCE = 3;
/** Pas de recul d'une remise en piste tombée sur un bloc, en mètres */
const RESPAWN_BACK_STEP = 1;

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
  shared?: SharedRange;
  obstacles?: ChicaneBlock[];
  islands?: RoundaboutIsland[];
  medians?: MedianBarrier[];
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
  const shared = lines?.shared ?? null;
  // Un aller-retour n'existe qu'une fois : le retour reprend les points, largeurs et bas-côtés de l'aller.
  const uniqueCount = shared ? shared.returnStart + 1 : n;
  const uniquePoints = shared ? points.slice(0, uniqueCount) : points;
  const uniqueWidths = shared ? widths.slice(0, uniqueCount) : widths;
  const uniqueShoulders = shoulderWidths(uniquePoints, uniqueWidths, closed);
  const shoulders = shared
    ? [
        ...uniqueShoulders,
        ...uniqueShoulders.slice(0, shared.armEnd).reverse(),
      ]
    : uniqueShoulders;
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

  const uniqueSegments = shared ? shared.returnStart : segments;
  const grid = createSpatialGrid(GRID_CELL);
  for (let i = 0; i < uniqueSegments; i++) {
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

  /** Garde dans `best` le segment `i` s'il serre (x, z) de plus près. À égalité, le premier dans l'ordre de l'axe. */
  const closer = (
    best: { i: number; t: number; d2: number },
    i: number,
    x: number,
    z: number,
  ): void => {
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
    if (d2 < best.d2 || (d2 === best.d2 && i < best.i)) {
      best.d2 = d2;
      best.i = i;
      best.t = t;
    }
  };

  // Même résultat au bit près que le parcours complet, à environ 1 % du coût sur 15 km.
  // Sur un aller-retour, seule la portion unique est dans la grille : c'est toujours le premier passage.
  const locate = (x: number, z: number) => {
    const best = { i: 0, t: 0, d2: Infinity };
    const test = (i: number): void => closer(best, i, x, z);
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
      if (best.d2 < reach * reach) break;
    }
    if (ring > GRID_MAX_RING) for (let i = 0; i < uniqueSegments; i++) test(i);
    return best;
  };

  /** Segment qui contient l'abscisse `s`, bornée au tracé. */
  const segmentAt = (s: number): number => {
    let low = 0;
    let high = segments - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (starts[middle] <= s) low = middle;
      else high = middle - 1;
    }
    return low;
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

  const nearest = (x: number, z: number, nearS?: number): TrackSample => {
    const { i, t, d2 } = locate(x, z);
    const first = sampleAt(i, t, d2);
    if (!shared || nearS === undefined) return first;
    // Sur la chaussée du passage suivi, on y reste : dans la fourche, l'autre passage est parfois plus près d'un centimètre.
    const around = { i: 0, t: 0, d2: Infinity };
    const last = segmentAt(nearS + FOLLOW_WINDOW);
    for (let k = segmentAt(nearS - FOLLOW_WINDOW); k <= last; k++)
      closer(around, k, x, z);
    const followed = sampleAt(around.i, around.t, around.d2);
    if (followed.distance <= followed.width / 2 + SHOULDER_WIDTH)
      return followed;
    // Sortie de route : le plus proche, sur celui des deux passages qui prolonge la route suivie.
    if (i >= shared.armEnd) return first;
    const copy = sampleAt(n - 2 - i, 1 - t, d2);
    return Math.abs(copy.s - nearS) < Math.abs(first.s - nearS) ? copy : first;
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
  const obstacles = lines?.obstacles ?? [];

  /** Recule le long de la route, donc sans rien gagner, jusqu'à être à l'écart de tout bloc. Sans bloc proche : l'échantillon tel quel. */
  const clearOfBlocks = (sample: TrackSample): TrackSample => {
    let clear = sample;
    while (
      clear.s > 0 &&
      obstacles.some((block) =>
        isNearBlock(
          block,
          clear.point.x,
          clear.point.z,
          RESPAWN_BLOCK_CLEARANCE,
        ),
      )
    )
      clear = sampleAtS(clear.s - RESPAWN_BACK_STEP);
    return clear;
  };

  return {
    points,
    shared,
    unique: {
      points: uniquePoints,
      widths: uniqueWidths,
      shoulders: uniqueShoulders,
    },
    closed,
    width: widths.reduce((max, w) => Math.max(max, w), 0),
    widths,
    shoulders,
    length,
    startS,
    finishS: lines?.finishS ?? length,
    ribbon: ribbon(uniquePoints, shared ? uniqueWidths : width, closed),
    terrain: lines?.terrain ?? null,
    obstacles,
    islands: lines?.islands ?? [],
    medians: lines?.medians ?? [],
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
      const sample = clearOfBlocks(nearest(x, z));
      return poseOn(sample.point, sample.tangent, !closed);
    },
    poseAt: (s) => {
      const sample = clearOfBlocks(sampleAtS(s));
      return poseOn(sample.point, sample.tangent, !closed);
    },
    indexAt: (s) => {
      const low = segmentAt(s);
      const next = low + 1 < segments ? starts[low + 1] : length;
      return s - starts[low] < next - s ? low : Math.min(low + 1, n - 1);
    },
  };
};
