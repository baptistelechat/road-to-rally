// Terrain contraint autour d'une jonction : variantes de la mission, sans toucher à `src/geo/terrain.ts`.
import Constrainautor from "@kninnug/constrainautor";
import Delaunator from "delaunator";
import {
  CORRIDOR_CELL,
  TERRAIN_BLEND_GROWTH,
  TERRAIN_BLEND_REACH,
  TERRAIN_BLEND_SLOPE,
  TERRAIN_GRID_CLEARANCE,
  TERRAIN_MAX_NODE_EDGE,
  TERRAIN_ROAD_CLEARANCE,
  TERRAIN_ROW_MIN_GAP,
  TERRAIN_ROWS,
} from "../../../src/geo/config";
import { roundMm, type PlanePoint } from "../../../src/geo/gpx";
import {
  GROUND_Y,
  ribbon,
  shoulderStrips,
} from "../../../src/sim/track/ribbon";
import { shoulderWidths } from "../../../src/sim/track/roadContact";
import type { MeshData, Vec3 } from "../../../src/sim/types";
import type { Disc } from "./axis";

export type Mode = "platform" | "union" | "unconstrained";

export interface Scene {
  terrain: MeshData;
  platform: MeshData | null;
  ribbon: MeshData;
  shoulders: [MeshData, MeshData];
  /** Le ruban coupé en bras, aller de boucle et retour de boucle, pour comparer les altitudes */
  branches: { go: MeshData; back: MeshData };
  constraints: number;
  /** Bas-côté le plus étroit de la zone, en mètres */
  minShoulder: number;
}

const SNAP = 0.03;

const subMesh = (mesh: MeshData, from: number, to: number): MeshData => ({
  positions: mesh.positions,
  indices: mesh.indices.slice(from * 6, to * 6),
});

/** Copie de `blendLimit` et `nodeHeights` de `terrain.ts`, non exportées. */
const nodeHeights = (
  points: Vec3[],
  edge: number[],
  nodes: PlanePoint[],
  altitudes: number[],
  baseAltitude: number,
  clearance: number,
): (number | null)[] =>
  nodes.map((node, n) => {
    let low = -Infinity;
    let high = Infinity;
    let lowDistance = 0;
    let highDistance = 0;
    for (let i = 0; i < points.length; i++) {
      const raw = Math.hypot(points[i].x - node.x, points[i].z - node.z);
      if (raw < edge[i] + clearance) return null;
      const distance = raw - edge[i];
      if (distance > TERRAIN_BLEND_REACH) continue;
      const clear = Math.max(0, distance);
      const limit =
        clear * (TERRAIN_BLEND_SLOPE + TERRAIN_BLEND_GROWTH * clear);
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
    if (low <= high)
      return Math.min(high, Math.max(low, altitudes[n] - baseAltitude));
    const total = lowDistance + highDistance;
    return total > 0
      ? high + ((low - high) * highDistance) / total
      : (low + high) / 2;
  });

const segmentsCross = (
  a: PlanePoint,
  b: PlanePoint,
  c: PlanePoint,
  d: PlanePoint,
): { t: number; u: number } | null => {
  const rx = b.x - a.x;
  const rz = b.z - a.z;
  const sx = d.x - c.x;
  const sz = d.z - c.z;
  const denom = rx * sz - rz * sx;
  if (denom === 0) return null;
  const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / denom;
  const u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { t, u } : null;
};

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

export const buildScene = (
  points: Vec3[],
  armEnd: number,
  widths: number[],
  gridNodes: PlanePoint[],
  gridAltitudes: number[],
  altitudeAt: (x: number, z: number) => number,
  baseAltitude: number,
  mode: Mode,
  disc: Disc | null,
): Scene => {
  const n = points.length;
  const shoulders = shoulderWidths(points, widths, false);
  const strips = shoulderStrips(points, widths, shoulders, false);
  const [left, right] = strips;
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
  const edge = widths.map((w, i) => w / 2 + shoulders[i]);

  const vertices: Vec3[] = [];
  const addVertex = (v: Vec3): number => {
    for (let k = vertices.length - 1; k >= 0; k--)
      if (Math.hypot(vertices[k].x - v.x, vertices[k].z - v.z) < SNAP) return k;
    vertices.push(v);
    return vertices.length - 1;
  };
  const constraints: [number, number][] = [];
  const chain = (ids: number[]): void => {
    for (let k = 0; k + 1 < ids.length; k++)
      if (ids[k] !== ids[k + 1]) constraints.push([ids[k], ids[k + 1]]);
  };
  const seeds: PlanePoint[] = [];
  let platform: MeshData | null = null;
  const inDisc = (v: PlanePoint): boolean =>
    disc !== null && Math.hypot(v.x - disc.x, v.z - disc.z) < disc.r;

  if (mode === "union") {
    // Contour de l'union : le bord droit court tout le long, le bord gauche du bras le rejoint à la jonction.
    const outer = Array.from({ length: n - 1 }, (_, i) =>
      addVertex(rightAt(i)),
    );
    const armLeft = Array.from({ length: armEnd + 1 }, (_, i) =>
      addVertex(leftAt(i)),
    );
    chain(outer);
    chain(armLeft);
    constraints.push([armLeft[armEnd], outer[outer.length - 1]]);
    constraints.push([armLeft[0], outer[0]]);
    // Bord de l'îlot : les deux bords gauches de la boucle se croisent une seule fois, c'est la pointe.
    let cross: { i: number; j: number; at: Vec3 } | null = null;
    const middle = Math.floor((armEnd + n) / 2);
    for (let i = armEnd + 1; i < middle; i++)
      for (let j = n - 2; j > middle; j--) {
        const a = leftAt(i);
        const b = leftAt(i + 1);
        const c = leftAt(j);
        const d = leftAt(j - 1);
        const hit = segmentsCross(a, b, c, d);
        if (hit && (!cross || i < cross.i))
          cross = {
            i,
            j,
            at: {
              x: a.x + (b.x - a.x) * hit.t,
              y: (a.y + c.y) / 2,
              z: a.z + (b.z - a.z) * hit.t,
            },
          };
      }
    if (!cross) throw new Error("Les bords de l'îlot ne se croisent pas");
    const tip = addVertex(cross.at);
    const island = [tip];
    for (let i = cross.i + 1; i < cross.j; i++)
      island.push(addVertex(leftAt(i)));
    island.push(tip);
    chain(island);
    seeds.push(points[1]);
  } else {
    if (!disc) throw new Error("Disque requis");
    interface End {
      vertex: number;
      side: 0 | 1;
      index: number;
      angle: number;
    }
    const ends: End[] = [];
    const walkSide = (side: 0 | 1, at: (i: number) => Vec3): void => {
      let run: number[] = [];
      let first = -1;
      const close = (lastIndex: number): void => {
        if (run.length === 0) return;
        chain(run);
        const mark = (vertex: number, index: number): void => {
          const v = vertices[vertex];
          ends.push({
            vertex,
            side,
            index,
            angle: Math.atan2(v.z - disc.z, v.x - disc.x),
          });
        };
        if (first > 0) mark(run[0], first);
        if (lastIndex < n - 1) mark(run[run.length - 1], lastIndex);
        run = [];
      };
      for (let i = 0; i < n; i++) {
        const v = at(i);
        if (inDisc(v)) {
          close(i - 1);
          first = -1;
          continue;
        }
        if (first < 0) first = i;
        run.push(addVertex(v));
      }
      close(n - 1);
    };
    walkSide(0, leftAt);
    walkSide(1, rightAt);
    constraints.push([addVertex(leftAt(0)), addVertex(rightAt(0))]);
    ends.sort((a, b) => a.angle - b.angle);
    const reach = Math.ceil((disc.r * 2) / 2) + 12;
    const y = points[armEnd].y + GROUND_Y;
    const ring: number[] = [];
    const arcStep = 3;
    let chords = 0;
    ends.forEach((end, k) => {
      const next = ends[(k + 1) % ends.length];
      ring.push(end.vertex);
      // Une seule bande dans le disque : ses deux bouts se suivent dans les deux sens, seul le côté court est la corde.
      const gap =
        next.angle > end.angle
          ? next.angle - end.angle
          : next.angle - end.angle + 2 * Math.PI;
      const sameStrip =
        gap < Math.PI &&
        end.side !== next.side &&
        Math.abs(end.index - next.index) <= reach &&
        Math.hypot(
          vertices[end.vertex].x - vertices[next.vertex].x,
          vertices[end.vertex].z - vertices[next.vertex].z,
        ) <
          2 * (widths[end.index] / 2 + shoulders[end.index]) + 4;
      if (sameStrip) {
        chords++;
        if (mode === "unconstrained")
          constraints.push([end.vertex, next.vertex]);
        return;
      }
      if (mode === "unconstrained") return;
      let to = next.angle;
      if (to <= end.angle) to += 2 * Math.PI;
      const arc = disc.r * (to - end.angle);
      const count = Math.floor(arc / arcStep);
      for (let a = 1; a < count; a++) {
        const angle = end.angle + ((to - end.angle) * a) / count;
        ring.push(
          addVertex({
            x: disc.x + Math.cos(angle) * disc.r,
            y,
            z: disc.z + Math.sin(angle) * disc.r,
          }),
        );
      }
    });
    if (chords === 0) throw new Error("Aucune bande n'entre dans le disque");
    if (mode === "platform") {
      for (let k = 0; k < ring.length; k++)
        constraints.push([ring[k], ring[(k + 1) % ring.length]]);
      const fan = new Float32Array((ring.length + 1) * 3);
      fan.set([disc.x, y, disc.z], 0);
      ring.forEach((v, k) =>
        fan.set([vertices[v].x, vertices[v].y, vertices[v].z], (k + 1) * 3),
      );
      const indices: number[] = [];
      for (let k = 0; k < ring.length; k++) {
        const a = k + 1;
        const b = ((k + 1) % ring.length) + 1;
        // Angle croissant autour du centre, x vers z : normale vers le bas. On inverse.
        indices.push(0, b, a);
      }
      platform = { positions: fan, indices: Uint32Array.from(indices) };
      seeds.push({ x: disc.x, z: disc.z });
    }
    // Un germe par portion de l'axe hors du disque.
    let start = -1;
    for (let i = 0; i <= n; i++) {
      const out = i < n && !inDisc(points[i]);
      if (out && start < 0) start = i;
      if (!out && start >= 0) {
        seeds.push(points[Math.floor((start + i) / 2)]);
        start = -1;
      }
    }
  }
  const fixedCount = vertices.length;

  // Rangées le long des bas-côtés, hors du disque en mode plateforme.
  const rowNodes: PlanePoint[] = [];
  const rowAlt: number[] = [];
  const isFree = (x: number, z: number): boolean =>
    rowNodes.every((r) => Math.hypot(r.x - x, r.z - z) >= TERRAIN_ROW_MIN_GAP);
  for (const { offset, stride } of TERRAIN_ROWS)
    for (let i = 0; i < n; i += stride) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(n - 1, i + 1)];
      const len = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
      for (const side of [-1, 1]) {
        const lateral = side * (edge[i] + offset);
        const x = roundMm(points[i].x - ((next.z - prev.z) / len) * lateral);
        const z = roundMm(points[i].z + ((next.x - prev.x) / len) * lateral);
        if (disc && Math.hypot(x - disc.x, z - disc.z) < disc.r + 1.5) continue;
        if (!isFree(x, z)) continue;
        rowNodes.push({ x, z });
        rowAlt.push(altitudeAt(x, z));
      }
    }
  // La plateforme compte comme une route pour le fondu du terrain : son bord est à hauteur de route.
  const blendPoints = [...points];
  const blendEdge = [...edge];
  if (disc)
    for (let a = 0; a < 48; a++) {
      blendPoints.push({
        x: disc.x + Math.cos((a * Math.PI) / 24) * disc.r,
        y: points[armEnd].y,
        z: disc.z + Math.sin((a * Math.PI) / 24) * disc.r,
      });
      blendEdge.push(0);
    }
  const rowHeights = nodeHeights(
    blendPoints,
    blendEdge,
    rowNodes,
    rowAlt,
    baseAltitude,
    TERRAIN_ROAD_CLEARANCE,
  );
  const gridHeights = nodeHeights(
    blendPoints,
    blendEdge,
    gridNodes,
    gridAltitudes,
    baseAltitude,
    TERRAIN_GRID_CLEARANCE,
  );
  const nodes = [...rowNodes, ...gridNodes];
  const heights = [...rowHeights, ...gridHeights];
  nodes.forEach((node, k) => {
    if (mode === "unconstrained" && disc && inDisc(node)) {
      // Repli : le terrain continue sous la route, 2 cm sous le bas-côté.
      vertices.push({
        x: node.x,
        y: points[armEnd].y + GROUND_Y - 0.02,
        z: node.z,
      });
      return;
    }
    // Sous la plateforme, rien : ni sommet ni triangle.
    if (mode === "platform" && disc && Math.hypot(node.x - disc.x, node.z - disc.z) < disc.r + TERRAIN_ROAD_CLEARANCE) return;
    const h = heights[k];
    if (h !== null) vertices.push({ x: node.x, y: h, z: node.z });
  });

  const positions = new Float32Array(vertices.length * 3);
  vertices.forEach((v, k) => positions.set([v.x, v.y, v.z], k * 3));
  const count = vertices.length;
  const coords = new Float64Array(count * 2);
  for (let v = 0; v < count; v++) {
    coords[2 * v] = positions[3 * v];
    coords[2 * v + 1] = positions[3 * v + 2];
  }
  const del = new Delaunator(coords);
  const con = new Constrainautor(del);
  for (const [a, b] of constraints) con.constrainOne(a, b);

  const { triangles, halfedges } = del;
  const removed = new Uint8Array(triangles.length / 3);
  for (const seed of seeds) {
    const t0 = triangleAt(coords, triangles, seed.x, seed.z);
    if (t0 < 0) throw new Error("Germe hors de la triangulation");
    const first = Math.floor(t0 / 3);
    if (removed[first]) continue;
    const stack = [first];
    removed[first] = 1;
    while (stack.length > 0) {
      const t = stack.pop() ?? 0;
      for (let e = t * 3; e < t * 3 + 3; e++) {
        if (triangles[e] >= fixedCount)
          throw new Error("Le vide de la route a débordé sur le terrain");
        const twin = halfedges[e];
        if (twin < 0 || con.isConstrained(e)) continue;
        const other = Math.floor(twin / 3);
        if (removed[other]) continue;
        removed[other] = 1;
        stack.push(other);
      }
    }
  }
  const length2 = (a: number, b: number): number =>
    (coords[2 * a] - coords[2 * b]) ** 2 +
    (coords[2 * a + 1] - coords[2 * b + 1]) ** 2;
  const maxEdge2 = TERRAIN_MAX_NODE_EDGE * TERRAIN_MAX_NODE_EDGE;
  const faces: number[] = [];
  const remap = new Int32Array(count).fill(-1);
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
      a >= fixedCount &&
      b >= fixedCount &&
      c >= fixedCount &&
      Math.max(length2(a, b), length2(b, c), length2(c, a)) > maxEdge2
    )
      continue;
    const up =
      (coords[2 * b + 1] - coords[2 * a + 1]) *
        (coords[2 * c] - coords[2 * a]) -
        (coords[2 * b] - coords[2 * a]) *
          (coords[2 * c + 1] - coords[2 * a + 1]) >
      0;
    faces.push(vertex(a), vertex(up ? b : c), vertex(up ? c : b));
  }
  const finalPositions = new Float32Array(used * 3);
  remap.forEach((target, v) => {
    if (target >= 0)
      finalPositions.set(positions.subarray(v * 3, v * 3 + 3), target * 3);
  });

  const road = ribbon(points, widths, false);
  const middle = Math.floor((armEnd + n) / 2);
  return {
    terrain: { positions: finalPositions, indices: Uint32Array.from(faces) },
    platform,
    ribbon: road,
    shoulders: strips,
    branches: {
      go: subMesh(road, armEnd, middle),
      back: subMesh(road, middle, n - 1),
    },
    constraints: constraints.length,
    minShoulder: shoulders
      .slice(Math.max(0, armEnd - 30))
      .reduce((m, v) => Math.min(m, v), Infinity),
  };
};

/** Nœuds de grille à moins de `reach` de l'axe, alignés sur la grille du jeu. */
export const localNodes = (
  points: PlanePoint[],
  reach: number,
): PlanePoint[] => {
  const keys = new Set<string>();
  const cells = Math.ceil(reach / CORRIDOR_CELL);
  for (let i = 0; i < points.length; i += 8) {
    const cx = Math.round(points[i].x / CORRIDOR_CELL);
    const cz = Math.round(points[i].z / CORRIDOR_CELL);
    for (let ox = -cells; ox <= cells; ox++)
      for (let oz = -cells; oz <= cells; oz++) {
        const x = (cx + ox) * CORRIDOR_CELL;
        const z = (cz + oz) * CORRIDOR_CELL;
        if (Math.hypot(x - points[i].x, z - points[i].z) <= reach)
          keys.add(`${x},${z}`);
      }
  }
  return [...keys]
    .sort()
    .map((k) => k.split(",").map(Number))
    .map(([x, z]) => ({ x, z }));
};
