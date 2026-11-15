import Constrainautor from "@kninnug/constrainautor";
import Delaunator from "delaunator";
import { groundColor } from "../render/track/groundMesh";
import { GROUND_Y, shoulderStrips } from "../sim/track/ribbon";
import { shoulderWidths } from "../sim/track/roadContact";
import { createSpatialGrid } from "../sim/track/spatialGrid";
import type { MeshData, Vec3 } from "../sim/types";
import {
  CORRIDOR_CELL,
  CORRIDOR_HALF_WIDTH,
  IGN_NO_DATA,
  STEP,
  TERRAIN_BLEND_GROWTH,
  TERRAIN_BLEND_REACH,
  TERRAIN_BLEND_SLOPE,
  TERRAIN_GRID_CLEARANCE,
  TERRAIN_MAX_NODE_EDGE,
  TERRAIN_OUTER_TIERS,
  TERRAIN_ROAD_CLEARANCE,
  TERRAIN_ROW_MIN_GAP,
  TERRAIN_ROWS,
} from "./config";
import {
  createWaterBed,
  type GroundTint,
  type WaterBed,
  type WaterPlan,
} from "./decor/landcover";
import { densify, insideRings } from "./decor/landcoverGeometry";
import { StageError, formatKm } from "./errors";
import { roundMm, type PlanePoint } from "./gpx";

/** Axe échantillonné tous les combien de points pour poser le couloir : un écart sous le mètre au bord du disque */
const CORRIDOR_AXIS_STRIDE = 8;
/** Axe échantillonné pour le fondu : 4 m suffisent, la limite varie lentement */
const BLEND_AXIS_STRIDE = 2;
const BLEND_GRID_CELL = 32;
/** Deux sommets du contour d'un aller-retour plus proches que ça n'en font qu'un, en mètres */
const CONTOUR_SNAP = 0.03;

/**
 * Nœuds de grille autour de l'axe, triés : maille fine dans le couloir, puis de plus en plus large.
 * Toutes les mailles sont multiples de la plus fine, donc un nœud n'existe qu'une fois.
 * Ne dépend que de l'axe : largeurs et routes OSM peuvent changer sans redemander les altitudes.
 */
export const corridorNodes = (axis: PlanePoint[]): PlanePoint[] => {
  const keys = new Set<number>();
  const stamp = (p: PlanePoint, cell: number, reach: number): void => {
    const cells = Math.ceil(reach / cell);
    const range2 = reach * reach;
    const scale = cell / CORRIDOR_CELL;
    const cx = Math.round(p.x / cell);
    const cz = Math.round(p.z / cell);
    for (let ix = cx - cells; ix <= cx + cells; ix++)
      for (let iz = cz - cells; iz <= cz + cells; iz++) {
        const dx = ix * cell - p.x;
        const dz = iz * cell - p.z;
        if (dx * dx + dz * dz <= range2)
          keys.add((ix * scale + 0x100000) * 0x200000 + (iz * scale + 0x100000));
      }
  };
  const tiers = [
    { cell: CORRIDOR_CELL, reach: CORRIDOR_HALF_WIDTH },
    ...TERRAIN_OUTER_TIERS,
  ];
  for (const { cell, reach } of tiers) {
    for (let i = 0; i < axis.length; i += CORRIDOR_AXIS_STRIDE)
      stamp(axis[i], cell, reach);
    stamp(axis[axis.length - 1], cell, reach);
  }
  return [...keys]
    .sort((a, b) => a - b)
    .map((key) => ({
      x: (Math.floor(key / 0x200000) - 0x100000) * CORRIDOR_CELL,
      z: ((key % 0x200000) - 0x100000) * CORRIDOR_CELL,
    }));
};

/** Écart d'altitude permis à `distance` du bord du bas-côté : doux près de la route, de plus en plus raide au loin. */
const blendLimit = (distance: number): number =>
  distance * (TERRAIN_BLEND_SLOPE + TERRAIN_BLEND_GROWTH * distance);

/** Altitude brute en (x, z), interpolée sur la grille fine. `null` si une maille manque. */
const rawAltitudeSampler = (nodes: PlanePoint[], altitudes: number[]) => {
  const known = new Map<string, number>();
  nodes.forEach((node, i) => {
    if (altitudes[i] !== IGN_NO_DATA)
      known.set(`${node.x},${node.z}`, altitudes[i]);
  });
  return (x: number, z: number): number | null => {
    const x0 = Math.floor(x / CORRIDOR_CELL) * CORRIDOR_CELL;
    const z0 = Math.floor(z / CORRIDOR_CELL) * CORRIDOR_CELL;
    const a = known.get(`${x0},${z0}`);
    const b = known.get(`${x0 + CORRIDOR_CELL},${z0}`);
    const c = known.get(`${x0},${z0 + CORRIDOR_CELL}`);
    const d = known.get(`${x0 + CORRIDOR_CELL},${z0 + CORRIDOR_CELL}`);
    if (a === undefined || b === undefined || c === undefined || d === undefined)
      return null;
    const u = (x - x0) / CORRIDOR_CELL;
    const v = (z - z0) / CORRIDOR_CELL;
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
};

/**
 * Rangées de sommets parallèles aux bas-côtés, de plus en plus espacées.
 * Sans elles, chaque nœud de grille relie plusieurs sommets de bord : un éventail de triangles en lame.
 */
const roadRows = (
  points: Vec3[],
  edge: number[],
  nodes: PlanePoint[],
  altitudes: number[],
): { rows: PlanePoint[]; rowAltitudes: number[] } => {
  const altitudeAt = rawAltitudeSampler(nodes, altitudes);
  const seen = createSpatialGrid(TERRAIN_ROW_MIN_GAP);
  const rows: PlanePoint[] = [];
  const rowAltitudes: number[] = [];
  const last = points.length - 1;
  const isFree = (x: number, z: number): boolean => {
    const cx = Math.floor(x / TERRAIN_ROW_MIN_GAP);
    const cz = Math.floor(z / TERRAIN_ROW_MIN_GAP);
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++)
        for (const r of seen.at(cx + ox, cz + oz) ?? [])
          if (Math.hypot(rows[r].x - x, rows[r].z - z) < TERRAIN_ROW_MIN_GAP)
            return false;
    return true;
  };
  for (const { offset, stride } of TERRAIN_ROWS)
    for (let i = 0; i <= last; i += stride) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(last, i + 1)];
      const len = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
      for (const side of [-1, 1]) {
        const lateral = side * (edge[i] + offset);
        const x = roundMm(points[i].x - ((next.z - prev.z) / len) * lateral);
        const z = roundMm(points[i].z + ((next.x - prev.x) / len) * lateral);
        const altitude = altitudeAt(x, z);
        if (altitude === null || !isFree(x, z)) continue;
        seen.insert(rows.length, x, z, x, z);
        rows.push({ x, z });
        rowAltitudes.push(altitude);
      }
    }
  return { rows, rowAltitudes };
};

/** Serrage du relief autour de la route, partagé par les nœuds du terrain et l'eau qui s'y pose. */
interface Blend {
  /** Le point tombe-t-il sous la route, à `clearance` près du bord du bas-côté ? */
  underRoad: (x: number, z: number, clearance: number) => boolean;
  /**
   * Relief brut en altitude locale, laissé libre entre deux limites, l'une sous et l'autre au-dessus de chaque portion de route proche.
   * Toutes les portions comptent, pas la plus proche : entre deux branches d'épingle, aucune arête ne naît du changement de branche.
   */
  conform: (x: number, z: number, raw: number) => number;
}

const createBlend = (points: Vec3[], edge: number[]): Blend => {
  const all = createSpatialGrid(BLEND_GRID_CELL);
  const sampled = createSpatialGrid(BLEND_GRID_CELL);
  points.forEach((p, i) => {
    all.insert(i, p.x, p.z, p.x, p.z);
    if (i % BLEND_AXIS_STRIDE === 0) sampled.insert(i, p.x, p.z, p.x, p.z);
  });
  const span = Math.ceil(TERRAIN_BLEND_REACH / BLEND_GRID_CELL) + 1;

  return {
    underRoad: (x, z, clearance) => {
      const cx = Math.floor(x / BLEND_GRID_CELL);
      const cz = Math.floor(z / BLEND_GRID_CELL);
      // Tous les points de l'axe ici : un nœud sous la route ne doit pas passer entre deux échantillons.
      for (let ox = -1; ox <= 1; ox++)
        for (let oz = -1; oz <= 1; oz++) {
          for (const i of all.at(cx + ox, cz + oz) ?? []) {
            const reach = edge[i] + clearance;
            const dx = points[i].x - x;
            const dz = points[i].z - z;
            if (dx * dx + dz * dz < reach * reach) return true;
          }
        }
      return false;
    },
    conform: (x, z, raw) => {
      const cx = Math.floor(x / BLEND_GRID_CELL);
      const cz = Math.floor(z / BLEND_GRID_CELL);
      let low = -Infinity;
      let high = Infinity;
      let lowDistance = 0;
      let highDistance = 0;
      for (let ox = -span; ox <= span; ox++)
        for (let oz = -span; oz <= span; oz++) {
          for (const i of sampled.at(cx + ox, cz + oz) ?? []) {
            const distance =
              Math.hypot(points[i].x - x, points[i].z - z) - edge[i];
            if (distance > TERRAIN_BLEND_REACH) continue;
            const clear = Math.max(0, distance);
            const limit = blendLimit(clear);
            const y = points[i].y + GROUND_Y;
            if (y - limit > low) {
              low = y - limit;
              lowDistance = clear;
            }
            if (y + limit < high) {
              high = y + limit;
              highDistance = clear;
            }
          }
        }
      if (low <= high) return Math.min(high, Math.max(low, raw));
      // Branches trop proches pour leur écart d'altitude : le dépassement se partage selon la distance à chacune,
      // pour que la pente reste la même des deux côtés au lieu de monter un mur contre la plus proche.
      const total = lowDistance + highDistance;
      return total > 0
        ? high + ((low - high) * highDistance) / total
        : (low + high) / 2;
    },
  };
};

/** Altitude locale de chaque nœud, ou `null` s'il tombe sous la route ou sans donnée. */
const nodeHeights = (
  nodes: PlanePoint[],
  altitudes: number[],
  baseAltitude: number,
  clearance: number,
  blend: Blend,
): (number | null)[] =>
  nodes.map((node, n) => {
    if (altitudes[n] === IGN_NO_DATA) return null;
    if (blend.underRoad(node.x, node.z, clearance)) return null;
    return blend.conform(node.x, node.z, altitudes[n] - baseAltitude);
  });

/**
 * Relief de la spéciale avant tout creusement, en altitude locale : brut, et conforme à la route comme le terrain.
 * L'eau y lit son niveau (story 5.9). `null` hors du couloir fin.
 */
export const createReliefSamplers = (
  points: Vec3[],
  widths: number[],
  gridNodes: PlanePoint[],
  gridAltitudes: number[],
  baseAltitude: number,
): {
  rawAt: (x: number, z: number) => number | null;
  conformAt: (x: number, z: number) => number | null;
} => {
  const shoulders = shoulderWidths(points, widths, false);
  const edge = widths.map((w, i) => w / 2 + shoulders[i]);
  const blend = createBlend(points, edge);
  const altitudeAt = rawAltitudeSampler(gridNodes, gridAltitudes);
  const rawAt = (x: number, z: number): number | null => {
    const raw = altitudeAt(x, z);
    return raw === null ? null : raw - baseAltitude;
  };
  return {
    rawAt,
    conformAt: (x, z) => {
      const raw = rawAt(x, z);
      return raw === null ? null : blend.conform(x, z, raw);
    },
  };
};

/** Triangle qui contient (x, z), `-1` sinon. Linéaire : une seule recherche par terrain. */
const triangleAt = (
  coords: Float64Array,
  triangles: Uint32Array,
  x: number,
  z: number,
): number => {
  const side = (a: number, b: number): number =>
    (coords[2 * b] - coords[2 * a]) * (z - coords[2 * a + 1]) -
    (coords[2 * b + 1] - coords[2 * a + 1]) * (x - coords[2 * a]);
  for (let t = 0; t < triangles.length; t += 3) {
    const s0 = side(triangles[t], triangles[t + 1]);
    const s1 = side(triangles[t + 1], triangles[t + 2]);
    const s2 = side(triangles[t + 2], triangles[t]);
    if ((s0 >= 0 && s1 >= 0 && s2 >= 0) || (s0 <= 0 && s1 <= 0 && s2 <= 0))
      return t;
  }
  return -1;
};

/** Sommets imposés au terrain, et les arêtes qui le découpent. `at` : index de l'axe, pour dire où ça coince. */
interface Contour {
  positions: Float32Array;
  constraints: { a: number; b: number; at: number }[];
}

/** Bords extérieurs des deux bas-côtés, fermés aux deux bouts. Sommets : bord gauche, puis bord droit. */
const stripContour = (left: MeshData, right: MeshData, n: number): Contour => {
  const positions = new Float32Array(2 * n * 3);
  for (let i = 0; i < n; i++) {
    positions.set(left.positions.subarray(i * 6, i * 6 + 3), i * 3);
    positions.set(right.positions.subarray(i * 6 + 3, i * 6 + 6), (n + i) * 3);
  }
  const constraints: Contour["constraints"] = [];
  for (let i = 0; i + 1 < n; i++) {
    constraints.push({ a: i, b: i + 1, at: i });
    constraints.push({ a: n + i, b: n + i + 1, at: i });
  }
  constraints.push({ a: 0, b: n, at: 0 });
  constraints.push({ a: n - 1, b: 2 * n - 1, at: n - 1 });
  return { positions, constraints };
};

/**
 * Aller-retour : contour de l'union des bandes du bras et de la boucle. Le bord extérieur court du départ à la fin de
 * la boucle, le bord intérieur du bras le rejoint à la jonction, et les deux bords intérieurs de la boucle, qui se croisent
 * une fois à la pointe de l'îlot, ferment l'îlot sur lui-même. `points` : le bras et la boucle, la jonction `armEnd` au retour en dernier.
 */
const forkContour = (
  points: Vec3[],
  left: MeshData,
  right: MeshData,
  armEnd: number,
  runoffPoints: number,
): Contour => {
  const n = points.length;
  const leftAt = (i: number): Vec3 => ({
    x: left.positions[i * 6],
    y: left.positions[i * 6 + 1],
    z: left.positions[i * 6 + 2],
  });
  const rightAt = (i: number): Vec3 => ({
    x: right.positions[i * 6 + 3],
    y: right.positions[i * 6 + 4],
    z: right.positions[i * 6 + 5],
  });
  // Le sens du tour dit de quel côté est l'îlot : à gauche sur un giratoire français, pas forcément sur une boucle de route.
  let turning = 0;
  for (let i = armEnd; i + 1 < n; i++)
    turning += points[i].x * points[i + 1].z - points[i + 1].x * points[i].z;
  const innerAt = turning > 0 ? rightAt : leftAt;
  const outerAt = turning > 0 ? leftAt : rightAt;

  const vertices: Vec3[] = [];
  const seen = createSpatialGrid(CONTOUR_SNAP);
  const vertex = (v: Vec3): number => {
    const cx = Math.floor(v.x / CONTOUR_SNAP);
    const cz = Math.floor(v.z / CONTOUR_SNAP);
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++)
        for (const k of seen.at(cx + ox, cz + oz) ?? [])
          if (Math.hypot(vertices[k].x - v.x, vertices[k].z - v.z) < CONTOUR_SNAP)
            return k;
    seen.insert(vertices.length, v.x, v.z, v.x, v.z);
    vertices.push(v);
    return vertices.length - 1;
  };
  const constraints: Contour["constraints"] = [];
  const link = (a: number, b: number, at: number): void => {
    if (a !== b) constraints.push({ a, b, at });
  };
  const chain = (ids: number[], at: (k: number) => number): void => {
    for (let k = 0; k + 1 < ids.length; k++) link(ids[k], ids[k + 1], at(k));
  };

  const outer = points.slice(0, n - 1).map((_, i) => vertex(outerAt(i)));
  const armInner = points.slice(0, armEnd + 1).map((_, i) => vertex(innerAt(i)));
  chain(outer, (k) => k);
  chain(armInner, (k) => k);
  link(armInner[armEnd], outer[outer.length - 1], armEnd);
  link(armInner[0], outer[0], 0);

  // Pointe de l'îlot : le premier croisement des deux bords intérieurs de la boucle, en partant de la jonction.
  const middle = Math.floor((armEnd + n) / 2);
  let tip: { i: number; j: number; at: Vec3 } | null = null;
  for (let i = armEnd + 1; i < middle && !tip; i++) {
    const a = innerAt(i);
    const b = innerAt(i + 1);
    for (let j = n - 2; j > middle && !tip; j--) {
      const c = innerAt(j);
      const d = innerAt(j - 1);
      const rx = b.x - a.x;
      const rz = b.z - a.z;
      const sx = d.x - c.x;
      const sz = d.z - c.z;
      const denom = rx * sz - rz * sx;
      if (denom === 0) continue;
      const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / denom;
      const u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / denom;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1)
        tip = {
          i,
          j,
          at: { x: a.x + rx * t, y: (a.y + c.y) / 2, z: a.z + rz * t },
        };
    }
  }
  if (!tip)
    throw new StageError(
      "roadContact",
      `Le retournement du ${formatKm((armEnd - runoffPoints) * STEP)} ne laisse pas d'îlot au milieu : la boucle est trop petite pour la largeur de la route.`,
    );
  const { i: tipI, j: tipJ, at: tipAt } = tip;
  const tipVertex = vertex(tipAt);
  const island = [tipVertex];
  for (let i = tipI + 1; i < tipJ; i++) island.push(vertex(innerAt(i)));
  island.push(tipVertex);
  chain(island, (k) => tipI + k);

  const positions = new Float32Array(vertices.length * 3);
  vertices.forEach((v, k) => positions.set([v.x, v.y, v.z], k * 3));
  return { positions, constraints };
};

/** Berges : un sommet tous les combien de mètres le long du contour de l'eau */
const BANK_STEP = 3;
/** Bande le long des berges, maille fine pour une rivière plus étroite que la grille de 16 m */
const BANK_BAND = 8;
const BANK_BAND_STEP = 4;
/** Deux sommets d'eau plus proches que ça d'un autre : le second est retiré, en mètres */
const WATER_NODE_GAP = 1.5;
/** Berge relevée juste au-dessus de l'eau : la nappe ne flotte jamais au bord, en mètres */
const BANK_FREEBOARD = 0.02;
/** Rangées de sommets de part et d'autre d'un pont, depuis le bord du bas-côté : le lit va jusque sous le tablier */
const BRIDGE_NODE_OFFSETS = [3, 6];
/** Un bord de bas-côté est sur un pont s'il est à moins de ça au-delà du bas-côté d'un point du pont, en mètres */
const BRIDGE_EDGE_TOLERANCE = 0.3;
/** Le fond tendu sous le tablier déborde d'autant de chaque côté du bas-côté, en mètres */
const DECK_BED_OVERHANG = 7;
/** Écart des sommets en travers du fond sous le tablier, en mètres */
const DECK_BED_STEP = 2.5;
/** Hors de l'eau, le fond sous le tablier reste sous la route… */
const UNDER_DECK = 0.5;
/** …et juste sous le terrain voisin, pour ne jamais en dépasser */
const UNDER_GROUND = 0.05;

/** Point à `lateral` mètres de l'axe en i, positif à droite (même formule que `roadRows`) */
const lateralAt = (points: Vec3[], i: number, lateral: number): PlanePoint => {
  const last = points.length - 1;
  const prev = points[Math.max(0, i - 1)];
  const next = points[Math.min(last, i + 1)];
  const len = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
  return {
    x: roundMm(points[i].x - ((next.z - prev.z) / len) * lateral),
    z: roundMm(points[i].z + ((next.x - prev.x) / len) * lateral),
  };
};

/**
 * Sommets ajoutés pour l'eau (story 5.9) : berges, bande fine le long des berges, rangées sous les ponts.
 * Sans eux, une rivière plus étroite que la maille ne serait creusée nulle part.
 */
const waterNodes = (
  points: Vec3[],
  edge: number[],
  plan: WaterPlan,
  bed: WaterBed,
  existing: PlanePoint[],
  altitudeAt: (x: number, z: number) => number | null,
): { nodes: PlanePoint[]; altitudes: number[]; bank: boolean[] } => {
  const occupied: PlanePoint[] = [...existing];
  const grid = createSpatialGrid(WATER_NODE_GAP);
  occupied.forEach((p, i) => grid.insert(i, p.x, p.z, p.x, p.z));
  const nodes: PlanePoint[] = [];
  const altitudes: number[] = [];
  const bank: boolean[] = [];
  const add = (x: number, z: number, onBank: boolean): void => {
    const cx = Math.floor(x / WATER_NODE_GAP);
    const cz = Math.floor(z / WATER_NODE_GAP);
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++)
        for (const k of grid.at(cx + ox, cz + oz) ?? [])
          if (Math.hypot(occupied[k].x - x, occupied[k].z - z) < WATER_NODE_GAP)
            return;
    const altitude = altitudeAt(x, z);
    if (altitude === null) return;
    grid.insert(occupied.length, x, z, x, z);
    occupied.push({ x, z });
    nodes.push({ x, z });
    altitudes.push(altitude);
    bank.push(onBank);
  };

  for (const rings of plan.polygons)
    for (const ring of rings)
      for (const p of densify(ring, BANK_STEP))
        add(roundMm(p.x), roundMm(p.z), true);

  for (const rings of plan.polygons) {
    const { xs, zs } = rings[0];
    const x0 = Math.ceil(Math.min(...xs) / BANK_BAND_STEP);
    const x1 = Math.floor(Math.max(...xs) / BANK_BAND_STEP);
    const z0 = Math.ceil(Math.min(...zs) / BANK_BAND_STEP);
    const z1 = Math.floor(Math.max(...zs) / BANK_BAND_STEP);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const x = ix * BANK_BAND_STEP;
        const z = iz * BANK_BAND_STEP;
        // Distance d'abord : bon marché, elle écarte presque tout l'intérieur d'un grand étang.
        if (bed.bankDistance(x, z) > BANK_BAND) continue;
        if (insideRings(rings, x, z)) add(x, z, false);
      }
  }

  points.forEach((_, i) => {
    if (!plan.bridged[i]) return;
    for (const offset of BRIDGE_NODE_OFFSETS)
      for (const side of [-1, 1]) {
        const p = lateralAt(points, i, side * (edge[i] + offset));
        if (bed.levelAt(p.x, p.z) !== null) add(p.x, p.z, false);
      }
  });
  return { nodes, altitudes, bank };
};

/**
 * Fond tendu sous le tablier d'un pont : le lit dans l'eau, juste sous la route ailleurs, jamais au-dessus du terrain
 * voisin. Il bouche l'ouverture laissée sous le pont : on voit l'eau passer, et une voiture tombée retombe dans le lit.
 */
const deckBed = (
  points: Vec3[],
  edge: number[],
  bridged: boolean[],
  bed: WaterBed,
  rawAt: (x: number, z: number) => number | null,
  conformAt: (x: number, z: number) => number | null,
  tint: GroundTint | null | undefined,
): MeshData | null => {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const n = points.length;
  let i = 0;
  while (i < n) {
    if (!bridged[i]) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < n && bridged[end + 1]) end++;
    // Un point de plus de chaque côté : le fond rejoint les berges sous le début du tablier.
    const from = Math.max(0, i - 1);
    const to = Math.min(n - 1, end + 1);
    let widest = 0;
    for (let k = from; k <= to; k++) widest = Math.max(widest, edge[k]);
    const across = Math.ceil(
      (2 * (widest + DECK_BED_OVERHANG)) / DECK_BED_STEP,
    );
    const base = positions.length / 3;
    for (let k = from; k <= to; k++) {
      const reach = edge[k] + DECK_BED_OVERHANG;
      const deck = points[k].y + GROUND_Y - UNDER_DECK;
      for (let j = 0; j <= across; j++) {
        const { x, z } = lateralAt(
          points,
          k,
          -reach + (2 * reach * j) / across,
        );
        const ground = conformAt(x, z);
        const raw = rawAt(x, z);
        const y = Math.min(
          deck,
          bed.bedAt(x, z, raw) ??
            (ground === null ? deck : ground - UNDER_GROUND),
        );
        positions.push(x, y, z);
        colors.push(
          ...(tint?.(x, z, bed.dryAt(x, z, raw)) ?? groundColor(x, z)),
        );
      }
    }
    for (let k = 0; k < to - from; k++)
      for (let j = 0; j < across; j++) {
        const a = base + k * (across + 1) + j;
        const b = a + 1;
        const c = a + across + 1;
        const d = c + 1;
        for (const [p, q, r] of [
          [a, b, d],
          [a, d, c],
        ]) {
          // Normale vers le haut, comme le terrain : `FIX_INTERNAL_EDGES` exige un maillage orienté.
          const up =
            (positions[q * 3 + 2] - positions[p * 3 + 2]) *
              (positions[r * 3] - positions[p * 3]) -
              (positions[q * 3] - positions[p * 3]) *
                (positions[r * 3 + 2] - positions[p * 3 + 2]) >
            0;
          indices.push(p, up ? q : r, up ? r : q);
        }
      }
    i = end + 1;
  }
  if (indices.length === 0) return null;
  return {
    positions: Float32Array.from(positions),
    indices: Uint32Array.from(indices),
    colors: Float32Array.from(colors),
  };
};

/**
 * Terrain conforme à la route : Delaunay contraint sur les nœuds et les bords extérieurs des bas-côtés.
 * Ces bords sortent de `shoulderStrips`, la fonction même qui fait les bas-côtés : mêmes sommets au bit près, pas de marche.
 * `armEnd`, sur un aller-retour : `points` et `widths` sont le bras et la boucle, sans la recopie.
 */
export const buildTerrain = (
  points: Vec3[],
  widths: number[],
  gridNodes: PlanePoint[],
  gridAltitudes: number[],
  baseAltitude: number,
  runoffPoints: number,
  armEnd?: number,
  /** Occupation du sol réelle (story 5.4). Absente : l'herbe de `groundColor` partout, au bit près comme avant. */
  tint?: GroundTint | null,
  /** Eau à creuser (story 5.9). Absente ou vide : le terrain d'avant, au bit près. */
  water?: WaterPlan | null,
): MeshData => {
  const n = points.length;
  const shoulders = shoulderWidths(points, widths, false);
  const [left, right] = shoulderStrips(points, widths, shoulders, false);
  const edge = widths.map((w, i) => w / 2 + shoulders[i]);
  const { rows, rowAltitudes } = roadRows(
    points,
    edge,
    gridNodes,
    gridAltitudes,
  );
  const blend = createBlend(points, edge);
  const plan = water && water.surfaces.length > 0 ? water : null;
  const bed = plan ? createWaterBed(plan, points, widths) : null;
  const altitudeAt = plan ? rawAltitudeSampler(gridNodes, gridAltitudes) : null;
  const wet =
    plan && bed && altitudeAt
      ? waterNodes(points, edge, plan, bed, [...rows, ...gridNodes], altitudeAt)
      : null;
  const nodes = wet
    ? [...rows, ...gridNodes, ...wet.nodes]
    : [...rows, ...gridNodes];
  const heights = [
    ...nodeHeights(
      rows,
      rowAltitudes,
      baseAltitude,
      TERRAIN_ROAD_CLEARANCE,
      blend,
    ),
    ...nodeHeights(
      gridNodes,
      gridAltitudes,
      baseAltitude,
      TERRAIN_GRID_CLEARANCE,
      blend,
    ),
    ...(wet
      ? nodeHeights(
          wet.nodes,
          wet.altitudes,
          baseAltitude,
          TERRAIN_ROAD_CLEARANCE,
          blend,
        )
      : []),
  ];

  // Lit de l'eau : tout nœud dans l'eau descend au fond, chaque berge remonte au ras de l'eau.
  // La terre sèche d'un polygone plus large que l'eau (relief brut bien au-dessus du niveau) ne bouge pas.
  const inWater = new Uint8Array(nodes.length);
  if (bed && wet) {
    const firstWet = rows.length + gridNodes.length;
    const altitudes = [...rowAltitudes, ...gridAltitudes, ...wet.altitudes];
    nodes.forEach(({ x, z }, k) => {
      const height = heights[k];
      if (height === null) return;
      const raw = altitudes[k] - baseAltitude;
      if (k >= firstWet && wet.bank[k - firstWet]) {
        // Pile sur le contour, le test d'appartenance hésite : on regarde aussi à 50 cm autour.
        let level: number | null = null;
        for (const [dx, dz] of [
          [0, 0],
          [0.5, 0],
          [-0.5, 0],
          [0, 0.5],
          [0, -0.5],
        ]) {
          const l = bed.levelAt(x + dx, z + dz);
          if (l !== null) level = level === null ? l : Math.max(level, l);
        }
        if (level !== null)
          heights[k] = Math.max(height, level + BANK_FREEBOARD);
        return;
      }
      const floor = bed.bedAt(x, z, raw);
      if (floor === null) return;
      inWater[k] = 1;
      heights[k] = Math.min(height, floor);
    });
  }

  // Sommets : le contour, puis les nœuds conservés. En Float32 dès le départ, comme dans le rendu.
  const contour =
    armEnd === undefined
      ? stripContour(left, right, n)
      : forkContour(points, left, right, armEnd, runoffPoints);
  const fixed = contour.positions.length / 3;
  const kept = nodes.flatMap((_, i) => (heights[i] === null ? [] : [i]));
  const positions = new Float32Array((fixed + kept.length) * 3);
  positions.set(contour.positions);
  kept.forEach((node, k) => {
    positions[(fixed + k) * 3] = nodes[node].x;
    positions[(fixed + k) * 3 + 1] = heights[node] ?? 0;
    positions[(fixed + k) * 3 + 2] = nodes[node].z;
  });
  const vertexCount = positions.length / 3;
  const coords = new Float64Array(vertexCount * 2);
  for (let v = 0; v < vertexCount; v++) {
    coords[2 * v] = positions[3 * v];
    coords[2 * v + 1] = positions[3 * v + 2];
  }

  // Sous un pont : bords du bas-côté au-dessus de l'eau, et sommets dans l'eau. Les triangles qui les relient
  // feraient un mur sous le tablier : ils sont retirés, l'eau passe dessous.
  const opening =
    plan && plan.bridged.some(Boolean) ? new Uint8Array(vertexCount) : null;
  const wetVertex = new Uint8Array(vertexCount);
  if (opening && plan) {
    kept.forEach((node, k) => {
      if (inWater[node]) wetVertex[fixed + k] = 1;
    });
    const bridges = createSpatialGrid(BLEND_GRID_CELL);
    points.forEach((p, i) => {
      if (plan.bridged[i]) bridges.insert(i, p.x, p.z, p.x, p.z);
    });
    for (let v = 0; v < fixed; v++) {
      const x = positions[v * 3];
      const z = positions[v * 3 + 2];
      const cx = Math.floor(x / BLEND_GRID_CELL);
      const cz = Math.floor(z / BLEND_GRID_CELL);
      for (let ox = -1; ox <= 1; ox++)
        for (let oz = -1; oz <= 1; oz++)
          for (const i of bridges.at(cx + ox, cz + oz) ?? [])
            if (
              Math.hypot(points[i].x - x, points[i].z - z) <=
              edge[i] + BRIDGE_EDGE_TOLERANCE
            )
              opening[v] = 1;
    }
  }

  const del = new Delaunator(coords);
  const constraints = new Constrainautor(del);
  const constrain = (a: number, b: number, at: number): void => {
    try {
      constraints.constrainOne(a, b);
    } catch {
      // Les bas-côtés sont rétrécis pour ne jamais se couper : seules deux chaussées presque au contact y mènent.
      throw new StageError(
        "roadContact",
        `Deux portions de route sont trop proches au ${formatKm((at - runoffPoints) * STEP)}.`,
      );
    }
  };
  for (const { a, b, at } of contour.constraints) constrain(a, b, at);

  // Le contour fermé par les contraintes délimite la route : on la vide depuis l'intérieur.
  const { triangles, halfedges } = del;
  const removed = new Uint8Array(triangles.length / 3);
  const seed = triangleAt(coords, triangles, points[1].x, points[1].z);
  if (seed < 0) throw new Error("Axe hors de la triangulation");
  const stack = [Math.floor(seed / 3)];
  removed[stack[0]] = 1;
  while (stack.length > 0) {
    const t = stack.pop() ?? 0;
    for (let e = t * 3; e < t * 3 + 3; e++) {
      if (triangles[e] >= fixed)
        throw new Error("Le vide de la route a débordé sur le terrain");
      const twin = halfedges[e];
      if (twin < 0 || constraints.isConstrained(e)) continue;
      const other = Math.floor(twin / 3);
      if (removed[other]) continue;
      removed[other] = 1;
      stack.push(other);
    }
  }

  // Delaunay remplit l'enveloppe convexe : les grands triangles entre nœuds comblent les creux du couloir.
  const length2 = (a: number, b: number): number =>
    (coords[2 * a] - coords[2 * b]) ** 2 +
    (coords[2 * a + 1] - coords[2 * b + 1]) ** 2;
  const maxEdge2 = TERRAIN_MAX_NODE_EDGE * TERRAIN_MAX_NODE_EDGE;
  const remap = new Int32Array(vertexCount).fill(-1);
  const faces: number[] = [];
  let used = 0;
  const vertex = (v: number): number => {
    if (remap[v] < 0) remap[v] = used++;
    return remap[v];
  };
  for (let t = 0; t < removed.length; t++) {
    if (removed[t]) continue;
    const a = triangles[t * 3];
    const b = triangles[t * 3 + 1];
    const c = triangles[t * 3 + 2];
    if (
      a >= fixed &&
      b >= fixed &&
      c >= fixed &&
      Math.max(length2(a, b), length2(b, c), length2(c, a)) > maxEdge2
    )
      continue;
    if (
      opening &&
      (opening[a] || opening[b] || opening[c]) &&
      (wetVertex[a] || wetVertex[b] || wetVertex[c])
    )
      continue;
    // Normale vers le haut, comme le ruban : `FIX_INTERNAL_EDGES` exige un maillage orienté.
    const up =
      (coords[2 * b + 1] - coords[2 * a + 1]) *
        (coords[2 * c] - coords[2 * a]) -
        (coords[2 * b] - coords[2 * a]) *
          (coords[2 * c + 1] - coords[2 * a + 1]) >
      0;
    faces.push(vertex(a), vertex(up ? b : c), vertex(up ? c : b));
  }

  const finalPositions = new Float32Array(used * 3);
  const colors = new Float32Array(used * 3);
  // Relief brut en altitude locale, `null` hors du couloir fin ou sans eau : la terre sèche n'est pas peinte en eau.
  const rawAt = (x: number, z: number): number | null => {
    const raw = altitudeAt ? altitudeAt(x, z) : null;
    return raw === null ? null : raw - baseAltitude;
  };
  remap.forEach((target, v) => {
    if (target < 0) return;
    finalPositions.set(positions.subarray(v * 3, v * 3 + 3), target * 3);
    const x = positions[v * 3];
    const z = positions[v * 3 + 2];
    const dry = bed ? bed.dryAt(x, z, rawAt(x, z)) : false;
    colors.set(tint?.(x, z, dry) ?? groundColor(x, z), target * 3);
  });
  const under =
    opening && plan && bed && altitudeAt
      ? deckBed(
          points,
          edge,
          plan.bridged,
          bed,
          rawAt,
          (x, z) => {
            const raw = rawAt(x, z);
            return raw === null ? null : blend.conform(x, z, raw);
          },
          tint,
        )
      : null;
  if (!under)
    return {
      positions: finalPositions,
      indices: Uint32Array.from(faces),
      colors,
    };
  // Le fond sous les ponts, à la suite du terrain : même maillage, donc même rendu et même collider.
  const allPositions = new Float32Array(
    finalPositions.length + under.positions.length,
  );
  allPositions.set(finalPositions);
  allPositions.set(under.positions, finalPositions.length);
  const underColors = under.colors ?? new Float32Array(under.positions.length);
  const allColors = new Float32Array(colors.length + underColors.length);
  allColors.set(colors);
  allColors.set(underColors, colors.length);
  const indices = new Uint32Array(faces.length + under.indices.length);
  indices.set(faces);
  for (let k = 0; k < under.indices.length; k++)
    indices[faces.length + k] = under.indices[k] + used;
  return { positions: allPositions, indices, colors: allColors };
};
