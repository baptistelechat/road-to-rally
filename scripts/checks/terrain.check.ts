import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  CORRIDOR_CELL,
  CORRIDOR_HALF_WIDTH,
  TERRAIN_OUTER_TIERS,
} from "../../src/geo/config";
import { StageError } from "../../src/geo/errors";
import { traceFromGpx } from "../../src/geo/gpx";
import { buildStage, type StageInputs } from "../../src/geo/pipeline";
import { buildTerrain, corridorNodes } from "../../src/geo/terrain";
import { withSkirt } from "../../src/render/track/groundMesh";
import { initRapier, RAPIER } from "../../src/sim/rapier";
import { addTrackColliders } from "../../src/sim/track/colliders";
import { createMeshHeight } from "../../src/sim/track/meshHeight";
import { shoulderStrips } from "../../src/sim/track/ribbon";
import { createStageTrack } from "../../src/sim/track/stage";
import { parseStage } from "../../src/sim/track/stageCodec";
import type { MeshData, StageData, Track } from "../../src/sim/types";
import { syntheticStage } from "./stage.check";

/** Aire minimale d'un triangle vu du dessus, en m² : le Float32 reste au millimètre à ces distances */
const MIN_PLAN_AREA = 1e-4;
/** Écart toléré entre `groundAt` ou un rayon et le maillage, en mètres : le Float32 de Rapier compris */
const HEIGHT_TOLERANCE = 0.01;
/** Au-delà de 80°, un triangle à moins de 30 m de l'axe fait un mur que le fondu devait éviter */
const WALL_SLOPE = Math.tan((80 * Math.PI) / 180);
/** Au-delà de 60°, plus question d'y rouler : à mesurer, l'œil et le volant jugent */
const STEEP_SLOPE = Math.tan((60 * Math.PI) / 180);

const vertexKey = (m: MeshData, v: number): string =>
  `${m.positions[v * 3]},${m.positions[v * 3 + 1]},${m.positions[v * 3 + 2]}`;

/** Les bords des bas-côtés sont des arêtes du terrain, aux mêmes sommets au bit près, et aucun triangle ne dégénère. */
const checkMesh = (name: string, track: Track, terrain: MeshData): void => {
  const { positions, indices, colors } = terrain;
  assert.equal(colors?.length, positions.length, `${name} : couleurs`);
  const count = positions.length / 3;
  const ids = new Map<string, number>();
  for (let v = 0; v < count; v++) ids.set(vertexKey(terrain, v), v);

  const seen = new Uint8Array(count);
  const edges = new Set<number>();
  let minArea = Infinity;
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    seen[a] = seen[b] = seen[c] = 1;
    edges
      .add(a * count + b)
      .add(b * count + c)
      .add(c * count + a);
    const up =
      ((positions[b * 3 + 2] - positions[a * 3 + 2]) *
        (positions[c * 3] - positions[a * 3]) -
        (positions[b * 3] - positions[a * 3]) *
          (positions[c * 3 + 2] - positions[a * 3 + 2])) /
      2;
    minArea = Math.min(minArea, up);
  }
  assert.ok(minArea > MIN_PLAN_AREA, `${name} : triangle dégénéré ou retourné`);
  assert.ok(seen.every(Boolean), `${name} : sommet orphelin`);

  const n = track.points.length;
  const [left, right] = shoulderStrips(
    track.points,
    track.widths,
    track.shoulders,
    false,
  );
  const lookup = (strip: MeshData, v: number): number => {
    const id = ids.get(vertexKey(strip, v));
    assert.notEqual(id, undefined, `${name} : sommet de bas-côté absent`);
    return id ?? 0;
  };
  const hasEdge = (a: number, b: number): boolean =>
    edges.has(a * count + b) || edges.has(b * count + a);
  for (let i = 0; i + 1 < n; i++) {
    assert.ok(
      hasEdge(lookup(left, i * 2), lookup(left, (i + 1) * 2)),
      `${name} : bord gauche ouvert au point ${i}`,
    );
    assert.ok(
      hasEdge(lookup(right, i * 2 + 1), lookup(right, (i + 1) * 2 + 1)),
      `${name} : bord droit ouvert au point ${i}`,
    );
  }
  assert.ok(hasEdge(lookup(left, 0), lookup(right, 1)), `${name} : départ`);
  assert.ok(
    hasEdge(lookup(left, (n - 1) * 2), lookup(right, (n - 1) * 2 + 1)),
    `${name} : arrivée`,
  );
  console.log(
    `     ${name} : ${count} sommets, ${indices.length / 3} triangles, aire mini ${minArea.toFixed(4)} m²`,
  );
};

/**
 * Pas de mur à moins de 30 m de l'axe, pour les triangles que le fondu décide : ceux qui touchent un nœud de la grille.
 * Entre deux bords de bas-côtés, seule la route impose la pente : compté à part, sans seuil.
 */
const checkSlopes = (name: string, track: Track, terrain: MeshData): void => {
  const { positions, indices } = terrain;
  const slopes: number[] = [];
  let roadOnly = 0;
  const isNode = (v: number): boolean =>
    positions[v] % CORRIDOR_CELL === 0 &&
    positions[v + 2] % CORRIDOR_CELL === 0;
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
    const x = (positions[a] + positions[b] + positions[c]) / 3;
    const z = (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3;
    if (track.nearest(x, z).distance > 30) continue;
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
    if (isNode(a) || isNode(b) || isNode(c)) slopes.push(slope);
    else if (slope > STEEP_SLOPE) roadOnly++;
  }
  slopes.sort((p, q) => p - q);
  const at = (ratio: number): number =>
    slopes[Math.floor((slopes.length - 1) * ratio)];
  const walls = slopes.filter((s) => s > WALL_SLOPE).length;
  const steep = slopes.filter((s) => s > STEEP_SLOPE).length;
  console.log(
    `     ${name} : pente sous 30 m de l'axe, médiane ${at(0.5).toFixed(2)}, 99 % ${at(0.99).toFixed(2)}, max ${at(1).toFixed(2)}, ${steep} au-delà de 60° sur ${slopes.length}, plus ${roadOnly} entre deux bords de route`,
  );
  assert.equal(walls, 0, `${name} : mur à moins de 30 m de l'axe`);
};

/** Rayons Rapier réels : ruban touché en premier, terrain à sa hauteur exacte, aucun trou, couloir borné. */
const checkRays = (name: string, track: Track, stage: StageData): void => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const started = performance.now();
  addTrackColliders(world, track, []);
  const colliderMs = performance.now() - started;
  world.step();

  const roadHeight = createMeshHeight([track.ribbon]);
  // Le rayon de Rapier n'est pas étanche : pile sur une arête, il passe parfois. Une seconde chance à 7 mm à côté.
  const castDown = (x: number, y: number, z: number): number | null => {
    for (const nudge of [0, 0.007]) {
      const hit = world.castRay(
        new RAPIER.Ray({ x: x + nudge, y, z: z + nudge }, { x: 0, y: -1, z: 0 }),
        5000,
        true,
      );
      if (hit) return y - hit.timeOfImpact;
    }
    return null;
  };

  // Sur toute la longueur : d'une hauteur où rien ne peut être au-dessus, le premier contact est la chaussée.
  const n = track.points.length;
  let rays = 0;
  // Au milieu d'un segment, loin des arêtes : un rayon pile sur une arête peut passer entre deux triangles.
  for (let i = 0; i + 1 < n; i++) {
    const p = track.points[i];
    const q = track.points[i + 1];
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    for (const ratio of [-0.45, -0.2, 0.05, 0.3, 0.45]) {
      const lateral = ratio * track.widths[i];
      const x = p.x + (q.x - p.x) * 0.37 - ((q.z - p.z) / len) * lateral;
      const z = p.z + (q.z - p.z) * 0.37 + ((q.x - p.x) / len) * lateral;
      const expected = roadHeight(x, z);
      if (expected === null) continue;
      const hit = castDown(x, p.y + 2000, z);
      assert.notEqual(hit, null, `${name} : rien sous le point ${i}`);
      assert.ok(
        Math.abs((hit ?? 0) - expected) < HEIGHT_TOLERANCE,
        `${name} : au point ${i}, ${ratio} : rayon à ${hit}, ruban à ${expected}`,
      );
      rays++;
    }
  }

  // Tout le couloir : pas de trou, et `groundAt` donne la hauteur que voient les roues.
  let samples = 0;
  let worst = 0;
  for (let i = 0; i < n; i += 25) {
    const p = track.points[i];
    for (let angle = 0; angle < 6; angle++)
      for (const radius of [4, 9, 15, 25, 40, 70, 120, 200, 270]) {
        const x = p.x + Math.cos(angle * 1.05 + i) * radius;
        const z = p.z + Math.sin(angle * 1.05 + i) * radius;
        const ground = track.groundAt(x, z);
        if (track.nearest(x, z).distance > CORRIDOR_HALF_WIDTH - 20) continue;
        assert.notEqual(ground, null, `${name} : trou en (${x}, ${z})`);
        const hit = castDown(x, (ground ?? 0) + 3, z);
        assert.notEqual(hit, null, `${name} : pas de collider en (${x}, ${z})`);
        const gap = Math.abs((hit ?? 0) - (ground ?? 0));
        worst = Math.max(worst, gap);
        assert.ok(
          gap < HEIGHT_TOLERANCE,
          `${name} : groundAt ${ground}, rayon ${hit} en (${x}, ${z})`,
        );
        samples++;
      }
  }

  // Au-delà des mailles larges, plus rien : ni sol, ni collider.
  let outside = 0;
  const reach = TERRAIN_OUTER_TIERS[TERRAIN_OUTER_TIERS.length - 1].reach;
  const xs = track.points.map((p) => p.x);
  const zs = track.points.map((p) => p.z);
  for (let x = Math.min(...xs) - reach - 400; x < Math.max(...xs) + reach + 400; x += 111)
    for (let z = Math.min(...zs) - reach - 400; z < Math.max(...zs) + reach + 400; z += 123) {
      if (track.nearest(x, z).distance < reach + 100) continue;
      assert.equal(track.groundAt(x, z), null, `${name} : sol hors couloir`);
      assert.equal(
        castDown(x, 5000, z),
        null,
        `${name} : collider hors couloir`,
      );
      outside++;
    }
  assert.ok(outside > 0, `${name} : aucun point hors couloir testé`);
  world.free();
  console.log(
    `     ${name} : ${rays} rayons sur le ruban, ${samples} sur le couloir (écart max ${worst.toFixed(4)} m), ${outside} dehors, ` +
      `colliders créés en ${colliderMs.toFixed(0)} ms, ${(stage.terrain?.indices.length ?? 0) / 3} triangles`,
  );
};

/** La bordure suit le contour extérieur du couloir, jamais le bord de la route. */
const checkSkirt = (name: string, stage: StageData): void => {
  const { terrain } = stage;
  if (!terrain) return;
  const track = createStageTrack(stage);
  const skirt = withSkirt(terrain, track);
  const base = terrain.positions.length / 3;
  const added = skirt.positions.length / 3 - base;
  assert.ok(added > 0, `${name} : bordure vide`);
  assert.equal(skirt.colors?.length, skirt.positions.length);
  for (let v = base; v < base + added; v++) {
    const distance = track.nearest(
      skirt.positions[v * 3],
      skirt.positions[v * 3 + 2],
    ).distance;
    assert.ok(distance > 100, `${name} : bordure à ${distance} m de l'axe`);
  }
};

const checkStage = (name: string, stage: StageData, slopes = true): void => {
  const terrain = stage.terrain;
  assert.ok(terrain, `${name} : spéciale sans terrain`);
  if (!terrain) return;
  const track = createStageTrack(stage);
  checkMesh(name, track, terrain);
  if (slopes) checkSlopes(name, track, terrain);
  checkRays(name, track, stage);
};

/** Lacets synthétiques de 3,5 à 9 m de large, en pente : le pire cas de `constrainautor` hors données réelles. */
const checkSynthetic = (): void => {
  const stage = syntheticStage();
  const nodes = corridorNodes(stage.points);
  // Versant à 40 % sous un relief ondulé, indépendant du profil de la route.
  const altitudes = nodes.map(
    (p) => 500 + 0.4 * p.x + 12 * Math.sin(p.z / 37) * Math.cos(p.x / 53),
  );
  const terrain = buildTerrain(
    stage.points,
    stage.widths,
    nodes,
    altitudes,
    400,
    15,
  );
  // Branches à 16 m l'une de l'autre et 25 m de dénivelé : la route impose elle-même une pente qu'aucun fondu ne corrige.
  checkStage("synthétique", { ...stage, terrain }, false);

  // Deux chaussées presque au contact : refus lisible, jamais une exception brute de la bibliothèque.
  const pinched = syntheticStage();
  const near = pinched.points.map((p, i) =>
    i < pinched.points.length / 2 ? p : { ...p, x: p.x * 0.2, z: p.z * 0.2 },
  );
  assert.throws(
    () => buildTerrain(near, pinched.widths, nodes, altitudes, 400, 15),
    (error) => error instanceof StageError && error.code === "roadContact",
  );
};

export default async function check(): Promise<void> {
  await initRapier();
  checkSynthetic();
  for (const fixture of ["road", "mountain"]) {
    const path = `public/stages/${fixture}.json`;
    if (!existsSync(path)) continue;
    const baked = parseStage(JSON.parse(readFileSync(path, "utf8")));
    const inputs = JSON.parse(
      readFileSync(`fixtures/stages/${fixture}.inputs.json`, "utf8"),
    ) as StageInputs;

    // Sans réseau, depuis le cache : mêmes octets que le fichier cuit.
    const started = performance.now();
    const rebuilt = buildStage(inputs, baked.name);
    const buildMs = performance.now() - started;
    assert.deepEqual(rebuilt.terrain, baked.terrain, `${fixture} à recuire`);
    console.log(
      `     ${fixture} : axe ${traceFromGpx(inputs.gpx).points.length} points, ${corridorNodes(traceFromGpx(inputs.gpx).points).length} nœuds, génération en ${buildMs.toFixed(0)} ms`,
    );
    checkStage(fixture, baked);
    checkSkirt(fixture, baked);
  }
}
