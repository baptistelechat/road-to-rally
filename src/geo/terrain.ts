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
import { StageError, formatKm } from "./errors";
import { roundMm, type PlanePoint } from "./gpx";

/** Axe échantillonné tous les combien de points pour poser le couloir : un écart sous le mètre au bord du disque */
const CORRIDOR_AXIS_STRIDE = 8;
/** Axe échantillonné pour le fondu : 4 m suffisent, la limite varie lentement */
const BLEND_AXIS_STRIDE = 2;
const BLEND_GRID_CELL = 32;

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

/**
 * Altitude locale de chaque nœud, ou `null` s'il tombe sous la route ou sans donnée.
 * Le relief brut reste libre entre deux limites, l'une sous et l'autre au-dessus de chaque portion de route proche.
 * Toutes les portions comptent, pas la plus proche : entre deux branches d'épingle, aucune arête ne naît du changement de branche.
 */
const nodeHeights = (
  points: Vec3[],
  edge: number[],
  nodes: PlanePoint[],
  altitudes: number[],
  baseAltitude: number,
  clearance: number,
): (number | null)[] => {
  const all = createSpatialGrid(BLEND_GRID_CELL);
  const sampled = createSpatialGrid(BLEND_GRID_CELL);
  points.forEach((p, i) => {
    all.insert(i, p.x, p.z, p.x, p.z);
    if (i % BLEND_AXIS_STRIDE === 0) sampled.insert(i, p.x, p.z, p.x, p.z);
  });
  const span = Math.ceil(TERRAIN_BLEND_REACH / BLEND_GRID_CELL) + 1;

  return nodes.map((node, n) => {
    if (altitudes[n] === IGN_NO_DATA) return null;
    const cx = Math.floor(node.x / BLEND_GRID_CELL);
    const cz = Math.floor(node.z / BLEND_GRID_CELL);
    // Tous les points de l'axe ici : un nœud sous la route ne doit pas passer entre deux échantillons.
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++) {
        for (const i of all.at(cx + ox, cz + oz) ?? []) {
          const reach = edge[i] + clearance;
          const dx = points[i].x - node.x;
          const dz = points[i].z - node.z;
          if (dx * dx + dz * dz < reach * reach) return null;
        }
      }
    let low = -Infinity;
    let high = Infinity;
    let lowDistance = 0;
    let highDistance = 0;
    for (let ox = -span; ox <= span; ox++)
      for (let oz = -span; oz <= span; oz++) {
        for (const i of sampled.at(cx + ox, cz + oz) ?? []) {
          const distance =
            Math.hypot(points[i].x - node.x, points[i].z - node.z) - edge[i];
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
    if (low <= high)
      return Math.min(high, Math.max(low, altitudes[n] - baseAltitude));
    // Branches trop proches pour leur écart d'altitude : le dépassement se partage selon la distance à chacune,
    // pour que la pente reste la même des deux côtés au lieu de monter un mur contre la plus proche.
    const total = lowDistance + highDistance;
    return total > 0
      ? high + ((low - high) * highDistance) / total
      : (low + high) / 2;
  });
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

/**
 * Terrain conforme à la route : Delaunay contraint sur les nœuds et les bords extérieurs des bas-côtés.
 * Ces bords sortent de `shoulderStrips`, la fonction même qui fait les bas-côtés : mêmes sommets au bit près, pas de marche.
 */
export const buildTerrain = (
  points: Vec3[],
  widths: number[],
  gridNodes: PlanePoint[],
  gridAltitudes: number[],
  baseAltitude: number,
  runoffPoints: number,
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
  const nodes = [...rows, ...gridNodes];
  const heights = [
    ...nodeHeights(
      points,
      edge,
      rows,
      rowAltitudes,
      baseAltitude,
      TERRAIN_ROAD_CLEARANCE,
    ),
    ...nodeHeights(
      points,
      edge,
      gridNodes,
      gridAltitudes,
      baseAltitude,
      TERRAIN_GRID_CLEARANCE,
    ),
  ];

  // Sommets : bord gauche, bord droit, puis les nœuds conservés. En Float32 dès le départ, comme dans le rendu.
  const kept = nodes.flatMap((_, i) => (heights[i] === null ? [] : [i]));
  const positions = new Float32Array((2 * n + kept.length) * 3);
  for (let i = 0; i < n; i++) {
    positions.set(left.positions.subarray(i * 6, i * 6 + 3), i * 3);
    positions.set(right.positions.subarray(i * 6 + 3, i * 6 + 6), (n + i) * 3);
  }
  kept.forEach((node, k) => {
    positions[(2 * n + k) * 3] = nodes[node].x;
    positions[(2 * n + k) * 3 + 1] = heights[node] ?? 0;
    positions[(2 * n + k) * 3 + 2] = nodes[node].z;
  });
  const vertexCount = positions.length / 3;
  const coords = new Float64Array(vertexCount * 2);
  for (let v = 0; v < vertexCount; v++) {
    coords[2 * v] = positions[3 * v];
    coords[2 * v + 1] = positions[3 * v + 2];
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
  for (let i = 0; i + 1 < n; i++) {
    constrain(i, i + 1, i);
    constrain(n + i, n + i + 1, i);
  }
  constrain(0, n, 0);
  constrain(n - 1, 2 * n - 1, n - 1);

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
      if (triangles[e] >= 2 * n)
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
      a >= 2 * n &&
      b >= 2 * n &&
      c >= 2 * n &&
      Math.max(length2(a, b), length2(b, c), length2(c, a)) > maxEdge2
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
  remap.forEach((target, v) => {
    if (target < 0) return;
    finalPositions.set(positions.subarray(v * 3, v * 3 + 3), target * 3);
    colors.set(groundColor(positions[v * 3], positions[v * 3 + 2]), target * 3);
  });
  return {
    positions: finalPositions,
    indices: Uint32Array.from(faces),
    colors,
  };
};
