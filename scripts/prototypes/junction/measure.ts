// Mesures d'une scène : triangles, trous, rayons Rapier, marches sous les roues.
import { initRapier, RAPIER } from "../../../src/sim/rapier";
import { createMeshHeight } from "../../../src/sim/track/meshHeight";
import type { MeshData, Vec3 } from "../../../src/sim/types";
import type { Scene } from "./mesh";

const MIN_PLAN_AREA = 1e-4;
const WALL_SLOPE = Math.tan((80 * Math.PI) / 180);
const STEEP_SLOPE = Math.tan((60 * Math.PI) / 180);

export interface Metrics {
  triangles: number;
  /** Triangles dégénérés ou retournés vus du dessus, sur tout le terrain */
  bad: number;
  minArea: number;
  /** Triangles terrain à moins de 40 m de la jonction : plus de 60°, plus de 80° */
  steep: number;
  walls: number;
  /** Points de grille sans aucune surface */
  holes: number;
  grid: number;
  /** Rayons Rapier : aucun contact, ou écart au maillage de plus de 1 cm */
  rayMiss: number;
  rayOff: number;
  rays: number;
  /** Plus grand saut de hauteur sous une roue, tous les 10 cm, et nombre au-delà de 3 cm */
  wheelStep: number;
  wheelSteps: number;
  wheelOn: string;
  /** Écart de la surface sous la roue à l'altitude de l'axe */
  wheelOff: number;
  /** Écart maximal aller / retour là où les deux rubans se superposent */
  ribbonGap: number;
  overlap: number;
  /** Terrain au-dessus du ruban, et de combien */
  poke: number;
  pokes: number;
  /** Ruban sous la plateforme, ou plus de 5 cm au-dessus */
  platformGap: number;
  /** Plus grand saut entre deux points de chaussée à 20 cm l'un de l'autre */
  roadStep: number;
}

const planArea = (m: MeshData, t: number): number => {
  const [a, b, c] = [
    m.indices[t] * 3,
    m.indices[t + 1] * 3,
    m.indices[t + 2] * 3,
  ];
  const p = m.positions;
  return (
    ((p[b + 2] - p[a + 2]) * (p[c] - p[a]) -
      (p[b] - p[a]) * (p[c + 2] - p[a + 2])) /
    2
  );
};

export const measure = async (
  scene: Scene,
  points: Vec3[],
  armEnd: number,
): Promise<Metrics> => {
  await initRapier();
  const { terrain, ribbon, shoulders, platform, branches } = scene;
  const j = points[armEnd];
  const loop = points.slice(armEnd);
  const xs = loop.map((p) => p.x);
  const zs = loop.map((p) => p.z);
  const margin = 20;
  const box = {
    minX: Math.min(...xs) - margin,
    maxX: Math.max(...xs) + margin,
    minZ: Math.min(...zs) - margin,
    maxZ: Math.max(...zs) + margin,
  };

  let bad = 0;
  let minArea = Infinity;
  let steep = 0;
  let walls = 0;
  const { positions, indices } = terrain;
  for (let t = 0; t < indices.length; t += 3) {
    const area = planArea(terrain, t);
    minArea = Math.min(minArea, area);
    if (area <= MIN_PLAN_AREA) bad++;
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
    const x = (positions[a] + positions[b] + positions[c]) / 3;
    const z = (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3;
    if (Math.hypot(x - j.x, z - j.z) > 40) continue;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const slope = Math.hypot(nx, nz) / Math.abs(ny);
    if (slope > STEEP_SLOPE) steep++;
    if (slope > WALL_SLOPE) walls++;
  }

  const surfaces = [
    ribbon,
    ...shoulders,
    terrain,
    ...(platform ? [platform] : []),
  ];
  const top = createMeshHeight(surfaces);
  const roadH = createMeshHeight([ribbon]);
  const goH = createMeshHeight([branches.go]);
  const backH = createMeshHeight([branches.back]);
  const terrainH = createMeshHeight([terrain]);
  const platformH = platform ? createMeshHeight([platform]) : null;

  // Grille décalée, jamais pile sur une arête.
  let holes = 0;
  let grid = 0;
  let ribbonGap = 0;
  let overlap = 0;
  let poke = 0;
  let pokes = 0;
  let platformGap = 0;
  for (let x = box.minX + 0.137; x < box.maxX; x += 0.5)
    for (let z = box.minZ + 0.211; z < box.maxZ; z += 0.5) {
      grid++;
      if (top(x, z) === null) holes++;
      const road = roadH(x, z);
      if (road === null) continue;
      const go = goH(x, z);
      const back = backH(x, z);
      if (go !== null && back !== null) {
        overlap++;
        ribbonGap = Math.max(ribbonGap, Math.abs(go - back));
      }
      const ground = terrainH(x, z);
      if (ground !== null && ground > road) {
        pokes++;
        poke = Math.max(poke, ground - road);
      }
      const plate = platformH?.(x, z) ?? null;
      if (plate !== null)
        platformGap = Math.max(platformGap, Math.abs(road - plate));
    }

  // Autour de la jonction, tous les 10 cm : une fente de quelques centimètres passerait entre les mailles ci-dessus.
  for (let x = j.x - 25 + 0.0137; x < j.x + 25; x += 0.1)
    for (let z = j.z - 25 + 0.0211; z < j.z + 25; z += 0.1) {
      grid++;
      if (top(x, z) === null) holes++;
    }

  // Rayons Rapier réels, comme `terrain.check.ts`.
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  for (const m of surfaces)
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(
        m.positions,
        m.indices,
        RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
      ),
    );
  world.step();
  let rays = 0;
  let rayMiss = 0;
  let rayOff = 0;
  for (let x = box.minX + 0.31; x < box.maxX; x += 2)
    for (let z = box.minZ + 0.17; z < box.maxZ; z += 2) {
      const expected = top(x, z);
      if (expected === null) continue;
      rays++;
      let hit: number | null = null;
      for (const nudge of [0, 0.007]) {
        const r = world.castRay(
          new RAPIER.Ray(
            { x: x + nudge, y: expected + 50, z: z + nudge },
            { x: 0, y: -1, z: 0 },
          ),
          200,
          true,
        );
        if (r) {
          hit = expected + 50 - r.timeOfImpact;
          break;
        }
      }
      if (hit === null) rayMiss++;
      else if (Math.abs(hit - expected) > 0.01) rayOff++;
    }
  world.free();

  // Roues à ±0,8 m de l'axe, tous les 10 cm, de 40 m avant la jonction à 40 m après.
  const path: Vec3[] = [
    ...points.slice(Math.max(0, armEnd - 20), armEnd),
    ...loop,
    ...points.slice(Math.max(0, armEnd - 20), armEnd).reverse(),
  ];
  let wheelStep = 0;
  let wheelSteps = 0;
  let wheelOn = "";
  let wheelOff = 0;
  for (const lateral of [-0.8, 0.8]) {
    let previous: number | null = null;
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i];
      const b = path[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const steps = Math.max(1, Math.round(len / 0.1));
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        const x = a.x + (b.x - a.x) * t - ((b.z - a.z) / len) * lateral;
        const z = a.z + (b.z - a.z) * t + ((b.x - a.x) / len) * lateral;
        const h = top(x, z);
        if (h === null) {
          previous = null;
          continue;
        }
        const y = a.y + (b.y - a.y) * t;
        wheelOff = Math.max(wheelOff, Math.abs(h - y));
        if (previous !== null) {
          const delta = Math.abs(h - previous);
          if (delta > wheelStep) {
            wheelStep = delta;
            wheelOn = `(${x.toFixed(1)}, ${z.toFixed(1)}) à ${i}/${path.length}`;
          }
          if (delta > 0.03) wheelSteps++;
        }
        previous = h;
      }
    }
  }

  // Marches sur la chaussée elle-même, autour de la jonction.
  let roadStep = 0;
  const near = 30;
  const fine = 0.2;
  for (let x = j.x - near + 0.013; x < j.x + near * 1.5; x += fine)
    for (let z = j.z - near + 0.027; z < j.z + near; z += fine) {
      const here = roadH(x, z);
      if (here === null) continue;
      for (const [dx, dz] of [
        [fine, 0],
        [0, fine],
      ]) {
        const there = roadH(x + dx, z + dz);
        if (there !== null)
          roadStep = Math.max(roadStep, Math.abs(there - here));
      }
    }

  return {
    triangles: indices.length / 3,
    bad,
    minArea,
    steep,
    walls,
    holes,
    grid,
    rayMiss,
    rayOff,
    rays,
    wheelStep,
    wheelSteps,
    wheelOn,
    wheelOff,
    ribbonGap,
    overlap,
    poke,
    pokes,
    platformGap,
    roadStep,
  };
};
