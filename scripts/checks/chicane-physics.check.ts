// Chicanes dans la physique (story 3.8), sans réseau, sur des spéciales synthétiques : la barrière arrête, la voiture repart, le déterminisme tient.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type RAPIER_TYPES from "@dimforge/rapier3d-deterministic-compat";
import {
  placeChicanes,
  resolveChicanes,
  type ChicaneRequest,
} from "../../src/geo/chicanes";
import { CHICANE_SHOULDER_OVERHANG } from "../../src/geo/config";
import { stageCacheKey } from "../../src/game/stageCache";
import {
  traceFromGpx,
  uniqueAxis,
  unproject,
  type LatLon,
  type PlanePoint,
} from "../../src/geo/gpx";
import type { OsmWay } from "../../src/geo/osm";
import {
  axisHash,
  buildStage,
  buildStageWithWarnings,
  type StageInputs,
} from "../../src/geo/pipeline";
import { stageHash } from "../../src/geo/stageHash";
import { corridorNodes } from "../../src/geo/terrain";
import { botInput } from "../../src/sim/bot";
import { carConfig } from "../../src/sim/carConfig";
import { FIXED_DT } from "../../src/sim/fixedStep";
import { initRapier, RAPIER } from "../../src/sim/rapier";
import { createSimulation, SANDBOX_SEED } from "../../src/sim/simulation";
import { addTrackColliders } from "../../src/sim/track/colliders";
import { isNearBlock } from "../../src/sim/track/obstacles";
import { generateScenery } from "../../src/sim/track/scenery";
import { createStageTrack } from "../../src/sim/track/stage";
import { parseStage, stageToJson } from "../../src/sim/track/stageCodec";
import type {
  CarInput,
  CarState,
  ChicaneBlock,
  Quat,
  StageData,
  Track,
  Vec3,
} from "../../src/sim/types";
import { createVehicle } from "../../src/sim/vehicle";
import { syntheticLollipop } from "../prototypes/junction/geometry";

const ORIGIN: LatLon = { lat: 44.5, lon: 6 };
/** Longueur de la spéciale droite, assez pour atteindre la pleine vitesse avant la chicane du milieu */
const LENGTH = 4400;
const CHICANE_AT = 3000;
const SECOND_CHICANE_AT = 4000;

const gpxOf = (points: LatLon[]): string =>
  [
    "<gpx><trk><trkseg>",
    ...points.map(
      ({ lat, lon }) =>
        `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`,
    ),
    "</trkseg></trk></gpx>",
  ].join("\n");

/** Une route tout droit vers le nord : la largeur se règle par une voie OSM enregistrée à la main. */
const straightPath = (length: number): LatLon[] => {
  const points: LatLon[] = [];
  for (let d = 0; d <= length; d += 50)
    points.push(unproject({ x: 0, z: -d }, ORIGIN));
  return points;
};

const wayAlong = (
  length: number,
  tags: Record<string, string> = {},
): OsmWay[] => [
  {
    id: 1,
    tags: { highway: "secondary", width: "6.5", ...tags },
    geometry: [
      unproject({ x: 0, z: 1000 }, ORIGIN),
      unproject({ x: 0, z: -length - 1000 }, ORIGIN),
    ],
  },
];

/** Pente douce en z : les blocs ne sont pas tous à la même altitude. */
const inputsFor = (
  gpx: string,
  ways: OsmWay[] | null,
  chicanes?: ChicaneRequest[],
): StageInputs => {
  const trace = traceFromGpx(gpx);
  const altitude = (p: PlanePoint): number => 500 - 0.02 * p.z;
  const unique = uniqueAxis(trace);
  return {
    gpx,
    axisHash: axisHash(trace),
    altitudes: unique.map(altitude),
    ways,
    terrain: corridorNodes(unique).map(altitude),
    ...(chicanes && { chicanes }),
    generatedAt: "2026-11-02T00:00:00.000Z",
  };
};

/** Demande à `distance` mètres du premier point du GPX, le long de son axe. */
const requestAt = (
  gpx: string,
  distance: number,
  side: ChicaneRequest["side"],
): ChicaneRequest => {
  const trace = traceFromGpx(gpx);
  const index = trace.runoffPoints + Math.round(distance / 2);
  return { position: unproject(trace.points[index], trace.origin), side };
};

const blockLocal = (
  block: ChicaneBlock,
  x: number,
  z: number,
): { x: number; z: number } => {
  const dx = x - block.position.x;
  const dz = z - block.position.z;
  const cos = Math.cos(block.yaw);
  const sin = Math.sin(block.yaw);
  return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
};

const rightOf = ({ x, y, z, w }: Quat): { x: number; z: number } => ({
  x: 1 - 2 * (y * y + z * z),
  z: 2 * (x * z - w * y),
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Poursuite d'un point à `lateral` de l'axe, positif à droite. */
const steerTo = (
  state: CarState,
  track: Track,
  routeS: number,
  lateralAt: (point: Vec3, right: { x: number; z: number }) => number,
): number => {
  const { x, z } = state.position;
  const here = track.nearest(x, z, routeS);
  const index = Math.min(
    track.points.length - 2,
    track.indexAt(here.s + Math.max(7, state.speed * 0.45)),
  );
  const point = track.points[index];
  const next = track.points[index + 1];
  const length = Math.hypot(next.x - point.x, next.z - point.z) || 1;
  const right = {
    x: -(next.z - point.z) / length,
    z: (next.x - point.x) / length,
  };
  const lateral = lateralAt(point, right);
  const dx = point.x + right.x * lateral - x;
  const dz = point.z + right.z * lateral - z;
  const car = rightOf(state.rotation);
  return clamp(
    ((dx * car.x + dz * car.z) / (Math.hypot(dx, dz) || 1)) * 2.2,
    -1,
    1,
  );
};

/** Pilote de test : ralentit à l'approche et passe du côté libre, dans les deux sens de la route. */
const slalom = (state: CarState, track: Track, routeS: number): CarInput => {
  const { x, z } = state.position;
  let closest = Infinity;
  for (const block of track.obstacles)
    closest = Math.min(
      closest,
      Math.hypot(block.position.x - x, block.position.z - z),
    );
  const steer = steerTo(state, track, routeS, (point, right) => {
    for (const block of track.obstacles) {
      const dx = block.position.x - point.x;
      const dz = block.position.z - point.z;
      if (Math.hypot(dx, dz) > 16) continue;
      // Milieu de la voie libre : la largeur barrée se partage en deux depuis l'axe.
      const free = (block.span - CHICANE_SHOULDER_OVERHANG) / 2;
      return (dx * right.x + dz * right.z > 0 ? -1 : 1) * free;
    }
    return 0;
  });
  // La vitesse en virage, celle du bot ; devant une chicane, on freine en plus.
  const base = botInput(state, track, routeS);
  if (closest > 90 || state.forwardSpeed < 11) return { ...base, steer };
  return {
    steer,
    throttle: 0,
    brake: Math.min(1, (state.forwardSpeed - 11) / 4),
    handbrake: false,
  };
};

/** Une course entière : temps, nombre de pas et état final au bit près. */
const race = (stage: StageData, maxSteps: number): string => {
  const sim = createSimulation(undefined, stage);
  let lapMs: number | null = null;
  let steps = 0;
  while (lapMs === null && steps < maxSteps) {
    lapMs = sim.step(slalom(sim.state(), sim.track, sim.routeS()));
    steps++;
  }
  const { position, rotation, linearVelocity, rpm, gear } = sim.state();
  const respawns = sim.respawnCount();
  sim.free();
  return JSON.stringify({
    lapMs,
    steps,
    respawns,
    position,
    rotation,
    linearVelocity,
    rpm,
    gear,
  });
};

const checkHeadOn = (stage: StageData): void => {
  const sim = createSimulation(undefined, stage);
  const block = stage.obstacles?.[0];
  assert.ok(block);
  const faceS = block.s - block.depth / 2;
  // Plein gaz droit sur le bloc : le centre de la voiture vise le milieu de la partie de chaussée barrée.
  const aim =
    block.lateral + (block.lateral < 0 ? 1 : -1) * (block.span / 2 - 1.5);
  let speedAtImpact = 0;
  let hit = -1;
  const lift = { y: 0, tilt: 1, wheelsOff: 0 };
  let peakAfter = 0;
  let furthest = 0;
  for (let i = 0; i < 60 * 90; i++) {
    const state = sim.state();
    sim.step({
      steer: steerTo(state, sim.track, sim.routeS(), () => aim),
      throttle: 1,
      brake: 0,
      handbrake: false,
    });
    const after = sim.state();
    furthest = Math.max(furthest, sim.routeS());
    assert.ok(
      blockLocal(block, after.position.x, after.position.z).z > block.depth / 2,
      `bloc traversé au pas ${i}`,
    );
    if (hit < 0) {
      if (after.speed < state.speed - 3) {
        hit = i;
        speedAtImpact = state.speed;
      }
      continue;
    }
    if (i > hit + 240) break;
    peakAfter = Math.max(peakAfter, after.speed);
    const here = sim.track.nearest(after.position.x, after.position.z);
    lift.y = Math.max(
      lift.y,
      after.position.y - here.point.y - carConfig.ride.height,
    );
    const { x, z } = after.rotation;
    lift.tilt = Math.min(lift.tilt, 1 - 2 * (x * x + z * z));
    if (after.wheels.every((wheel) => !wheel.inContact)) lift.wheelsOff++;
  }
  assert.ok(hit > 0, "la voiture n'a jamais touché le bloc");
  assert.ok(speedAtImpact > 40, `arrivée à ${speedAtImpact} m/s seulement`);
  assert.ok(furthest < faceS, `abscisse ${furthest} après la face ${faceS}`);
  // Elle s'arrête franchement : le rebond reste une fraction de la vitesse d'arrivée.
  assert.ok(
    peakAfter < speedAtImpact * 0.5,
    `repart à ${peakAfter} m/s après un choc à ${speedAtImpact} m/s`,
  );
  console.log(
    `     de face à ${speedAtImpact.toFixed(1)} m/s (${(speedAtImpact * 3.6).toFixed(0)} km/h) : rebond ${peakAfter.toFixed(1)} m/s, soulèvement ${lift.y.toFixed(2)} m, inclinaison ${(Math.acos(clamp(lift.tilt, -1, 1)) * (180 / Math.PI)).toFixed(0)}°, ${lift.wheelsOff} pas sans roue au sol`,
  );

  // Après le choc : la marche arrière dégage la voiture.
  const stopped = sim.state().position;
  const backStart = blockLocal(block, stopped.x, stopped.z).z;
  for (let i = 0; i < 240; i++)
    sim.step({ steer: 0, throttle: 0, brake: 1, handbrake: false });
  const backed = sim.state();
  const backEnd = blockLocal(block, backed.position.x, backed.position.z).z;
  assert.ok(
    backEnd - backStart > 5,
    `recule de ${backEnd - backStart} m seulement`,
  );
  assert.ok(backed.gear === -1, "marche arrière non enclenchée");

  // Et la remise en piste maintenue, de nouveau contre le bloc.
  for (let i = 0; i < 300; i++) {
    const state = sim.state();
    sim.step({
      steer: steerTo(state, sim.track, sim.routeS(), () => aim),
      throttle: 1,
      brake: 0,
      handbrake: false,
    });
  }
  const before = sim.respawnCount();
  for (let i = 0; i < 200; i++)
    sim.step({
      steer: 0,
      throttle: 0,
      brake: 0,
      handbrake: false,
      respawn: true,
    });
  assert.equal(sim.respawnCount(), before + 1, "pas de remise en piste");
  for (let i = 0; i < 120; i++)
    sim.step({ steer: 0, throttle: 0, brake: 0, handbrake: false });
  const placed = sim.state();
  assert.ok(
    !isNearBlock(block, placed.position.x, placed.position.z, 1.5),
    "remise en piste dans le bloc",
  );
  assert.ok(placed.speed < 1, `remise en piste à ${placed.speed} m/s`);
  sim.free();
};

/** Chocs injectés à vitesse et angle choisis : de face, en biais, sur les deux faces, le centre de la caisse ne passe jamais de l'autre côté. */
const checkSweep = (stage: StageData): void => {
  const track = createStageTrack(stage);
  const block = track.obstacles[0];
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_DT;
  addTrackColliders(world, track, []);
  const vehicle = createVehicle(
    world,
    carConfig,
    track.startPose,
    track.surfaceAt,
  );
  world.step();
  let body: RAPIER_TYPES.RigidBody | null = null;
  world.forEachRigidBody((candidate) => {
    if (candidate.isDynamic()) body = candidate;
  });
  const car = body as RAPIER_TYPES.RigidBody | null;
  assert.ok(car, "caisse introuvable");

  const cos = Math.cos(block.yaw);
  const sin = Math.sin(block.yaw);
  let cases = 0;
  let topLift = 0;
  for (const speed of [30, 55, 80])
    for (const angle of [0, 15, 30, 45, 60, 75])
      for (const direction of [-1, 1])
        for (const sign of [-1, 1])
          for (const offset of [-0.35, 0, 0.35]) {
            const radians = (angle * Math.PI) / 180;
            // Repère du bloc : la voiture part à 10 m de la face et vise un point de la face.
            const faceX = offset * block.span;
            const fromX = faceX - sign * Math.sin(radians) * 10;
            const fromZ =
              direction * (block.depth / 2 + Math.cos(radians) * 10 + 0.5);
            const localVx = sign * Math.sin(radians);
            const localVz = -direction * Math.cos(radians);
            const spawn = {
              x: block.position.x + fromX * cos + fromZ * sin,
              z: block.position.z - fromX * sin + fromZ * cos,
            };
            const vx = localVx * cos + localVz * sin;
            const vz = -localVx * sin + localVz * cos;
            const ground = track.groundAt(spawn.x, spawn.z);
            assert.ok(ground !== null, "départ hors du terrain");
            // L'avant local (-Z) sur la vitesse.
            const yaw = Math.atan2(-vx, -vz);
            vehicle.respawn({
              position: {
                x: spawn.x,
                y: ground + carConfig.ride.height,
                z: spawn.z,
              },
              rotation: {
                x: 0,
                y: Math.sin(yaw / 2),
                z: 0,
                w: Math.cos(yaw / 2),
              },
            });
            car.setLinvel({ x: vx * speed, y: 0, z: vz * speed }, true);
            let aroundTheEnd = false;
            for (let i = 0; i < 80; i++) {
              vehicle.step(
                { steer: 0, throttle: 1, brake: 0, handbrake: false },
                FIXED_DT,
              );
              world.step();
              const { position } = vehicle.state();
              const local = blockLocal(block, position.x, position.z);
              const beside = Math.abs(local.x) > block.span / 2;
              aroundTheEnd ||= beside;
              topLift = Math.max(topLift, position.y - ground);
              assert.ok(
                position.y < block.position.y + block.height,
                `passe au-dessus du bloc : ${speed} m/s, ${angle}°`,
              );
              // Contourner par le bout est permis, traverser jamais.
              if (!aroundTheEnd)
                assert.ok(
                  local.z * direction > block.depth / 2,
                  `traversé : ${speed} m/s, ${angle}°, face ${direction}, côté ${sign}, décalage ${offset}, pas ${i}, z local ${local.z}`,
                );
            }
            cases++;
          }
  // Posée au-dessus d'un bloc : à portée de ses rayons, aucune roue n'y prend appui.
  vehicle.respawn({
    position: {
      x: block.position.x,
      y: block.position.y + block.height + carConfig.ride.height,
      z: block.position.z,
    },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  });
  vehicle.step({ steer: 0, throttle: 0, brake: 0, handbrake: false }, FIXED_DT);
  world.step();
  assert.ok(
    vehicle.state().wheels.every((wheel) => !wheel.inContact),
    "les rayons de suspension touchent le bloc",
  );
  vehicle.free();
  world.free();
  console.log(
    `     ${cases} chocs de 30 à 80 m/s, de 0 à 75° : aucune traversée, centre de caisse à ${topLift.toFixed(2)} m au plus au-dessus du sol`,
  );
};

const checkRespawn = (stage: StageData): void => {
  const track = createStageTrack(stage);
  const plain = createStageTrack({ ...stage, obstacles: undefined });
  const blocks = track.obstacles;
  const clear = (position: Vec3): boolean =>
    blocks.every((b) => !isNearBlock(b, position.x, position.z, 2.5));
  const passes = [blocks[0].s, track.length - blocks[0].s];
  for (const center of stage.shared ? passes : [blocks[0].s + 12])
    for (let d = -30; d <= 30; d += 0.25) {
      const { position } = track.poseAt(center + d);
      assert.ok(clear(position), `poseAt(${center + d}) dans un bloc`);
      for (const lateral of [-6, 0, 6]) {
        const pose = track.respawnPose(position.x + lateral, position.z);
        assert.ok(clear(pose.position), `respawnPose dans un bloc`);
      }
    }
  // Loin des chicanes, rien ne change au bit près.
  assert.deepEqual(
    track.poseAt(stage.startS + 300),
    plain.poseAt(stage.startS + 300),
  );
};

const checkOrder = (stage: StageData): void => {
  const colliders = (): number[][] => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const track = createStageTrack(stage);
    addTrackColliders(world, track, []);
    const list: number[][] = [];
    world.forEachCollider((collider) => {
      const { x, y, z } = collider.translation();
      list.push([collider.handle, x, y, z]);
    });
    world.free();
    return list;
  };
  const first = colliders();
  assert.deepEqual(colliders(), first, "ordre des colliders");
  const blocks = stage.obstacles ?? [];
  const plain = (() => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    addTrackColliders(
      world,
      createStageTrack({ ...stage, obstacles: undefined }),
      [],
    );
    const count = world.colliders.len();
    world.free();
    return count;
  })();
  assert.equal(first.length, plain + blocks.length, "un collider par bloc");
  // Les blocs arrivent en dernier, dans l'ordre des abscisses.
  blocks.forEach((block, i) => {
    const [, x, , z] = first[plain + i];
    assert.ok(Math.abs(x - block.position.x) < 1e-3);
    assert.ok(Math.abs(z - block.position.z) < 1e-3);
  });
};

const checkScenery = (stage: StageData): void => {
  const without = generateScenery(
    createStageTrack({ ...stage, obstacles: undefined }),
    SANDBOX_SEED,
  );
  // Sur une droite, le décor reste déjà au large : un bloc posé sur un plot prouve qu'il lui cède la place.
  const posts = without.filter((item) => item.kind === "post");
  const post = posts[Math.floor(posts.length / 2)];
  const obstacles = (stage.obstacles ?? []).slice(0, 1).map((block) => ({
    ...block,
    position: { ...block.position, x: post.position.x, z: post.position.z },
  }));
  const track = createStageTrack({ ...stage, obstacles });
  const items = generateScenery(track, SANDBOX_SEED);
  assert.ok(items.length < without.length, "le décor ne cède rien");
  for (const item of items)
    assert.ok(
      track.obstacles.every(
        (block) => !isNearBlock(block, item.position.x, item.position.z, 3.9),
      ),
      `${item.kind} dans une chicane`,
    );
  // Le reste du décor ne bouge pas : mêmes objets, dans le même ordre.
  let cursor = 0;
  for (const item of items) {
    while (
      cursor < without.length &&
      JSON.stringify(without[cursor]) !== JSON.stringify(item)
    )
      cursor++;
    assert.ok(cursor < without.length, "objet de décor déplacé");
  }
};

const checkRemovals = (gpx: string): void => {
  const ways = wayAlong(LENGTH);
  const removedFor = (
    chicanes: ChicaneRequest[],
    wayList: OsmWay[] | null = ways,
  ): { blocks: number; warnings: string[] } => {
    const { stage, warnings } = buildStageWithWarnings(
      { ...inputsFor(gpx, wayList, chicanes), terrain: null },
      "t",
    );
    return { blocks: stage.obstacles?.length ?? 0, warnings };
  };
  const good = requestAt(gpx, CHICANE_AT, "left");

  assert.deepEqual(removedFor([good]), { blocks: 2, warnings: [] });
  // Trop étroite.
  const narrow = removedFor([good], wayAlong(LENGTH, { width: "4" }));
  assert.equal(narrow.blocks, 0);
  assert.match(
    narrow.warnings[0],
    /km .* retirée : la route y est trop étroite/,
  );
  // Trop près du départ.
  const early = removedFor([requestAt(gpx, 50, "left")]);
  assert.equal(early.blocks, 0);
  assert.match(early.warnings[0], /trop près du départ/);
  // Trop loin de la route : retirée, jamais déplacée.
  const far = removedFor([
    { position: unproject({ x: 40, z: -2000 }, ORIGIN), side: "left" },
  ]);
  assert.equal(far.blocks, 0);
  assert.match(far.warnings[0], /à 40 m de la route/);
  // Deux demandes au même endroit : une seule chicane, et le joueur le sait.
  const twice = removedFor([good, good]);
  assert.equal(twice.blocks, 2);
  assert.match(twice.warnings[0], /de la précédente/);
  // Sur un pont : gardée, le jeu n'en dessine aucun pour l'instant.
  const bridge = removedFor([good], wayAlong(LENGTH, { bridge: "yes" }));
  assert.equal(bridge.blocks, 2);
  assert.deepEqual(bridge.warnings, []);
  // Le bloc mordrait sur l'autre branche d'une épingle, 8 m plus loin : retirée.
  const branch = (x: number, from: number, to: number): Vec3[] => {
    const points: Vec3[] = [];
    for (let z = from; from < to ? z <= to : z >= to; z += from < to ? 2 : -2)
      points.push({ x, y: 0, z });
    return points;
  };
  const hairpin = [...branch(0, 0, -600), ...branch(8, -600, 0)];
  const resolve = (axis: Vec3[]): string[] =>
    resolveChicanes(
      [{ position: unproject({ x: 0, z: -300 }, ORIGIN), side: "left" }],
      axis,
      axis.map(() => 6.5),
      ORIGIN,
      { startS: 0, finishS: 1200, excluded: [] },
    ).warnings;
  assert.match(resolve(hairpin)[0], /une autre portion de la route/);
  assert.deepEqual(resolve(branch(0, 0, -1200)), []);
};

const checkRoundTrip = (): StageData => {
  const { arm, loop } = syntheticLollipop(2200, 40, 8);
  const toLatLon = (p: PlanePoint): LatLon => unproject(p, ORIGIN);
  const go = arm.map(toLatLon);
  const gpx = gpxOf([
    ...go,
    ...loop.slice(1, -1).map(toLatLon),
    ...[...go].reverse(),
  ]);
  const trace = traceFromGpx(gpx);
  assert.ok(trace.roundTrip, "aller-retour non reconnu");
  const unique = uniqueAxis(trace);
  const armEnd = trace.roundTrip.armEnd;
  const request = (index: number, side: ChicaneRequest["side"]) => ({
    position: unproject(unique[index], trace.origin),
    side,
  });
  // Sur le bras : une seule chicane. Demandée depuis le retour, elle retombe au même endroit.
  const onArm = request(armEnd - 500, "left");
  const { stage, warnings } = buildStageWithWarnings(
    {
      ...inputsFor(gpx, null, [onArm]),
    },
    "aller-retour",
  );
  assert.deepEqual(warnings, []);
  assert.equal(stage.obstacles?.length, 2);
  const again = buildStageWithWarnings(
    { ...inputsFor(gpx, null, [onArm, onArm]), terrain: null },
    "aller-retour",
  );
  assert.equal(again.stage.obstacles?.length, 2);
  assert.equal(again.warnings.length, 1);
  // Sur la jonction : retirée.
  const junction = buildStageWithWarnings(
    {
      ...inputsFor(gpx, null, [request(armEnd + 2, "left")]),
      terrain: null,
    },
    "aller-retour",
  );
  assert.equal(junction.stage.obstacles, undefined);
  assert.match(junction.warnings[0], /d'une jonction/);
  return stage;
};

export default async function chicanePhysicsCheck(): Promise<void> {
  await initRapier();
  const gpx = gpxOf(straightPath(LENGTH));
  const ways = wayAlong(LENGTH);
  const chicanes: ChicaneRequest[] = [
    requestAt(gpx, CHICANE_AT, "left"),
    requestAt(gpx, SECOND_CHICANE_AT, "right"),
  ];

  const { stage, warnings } = buildStageWithWarnings(
    inputsFor(gpx, ways, chicanes),
    "chicanes",
  );
  stage.hash = stageHash(stage);
  assert.deepEqual(warnings, []);
  assert.equal(stage.obstacles?.length, 4);
  const blocks = stage.obstacles ?? [];
  assert.equal(blocks[0].passage, 3.25, "route de 6,5 m");
  for (let i = 1; i < blocks.length; i++)
    assert.ok(blocks[i].s > blocks[i - 1].s, "blocs triés");
  // Recalée sur l'axe, sans glisser le long de la route.
  const expected = stage.startS + CHICANE_AT;
  assert.ok(
    Math.abs((blocks[0].s + blocks[1].s) / 2 - expected) < 3,
    `chicane à ${(blocks[0].s + blocks[1].s) / 2}, attendue vers ${expected}`,
  );

  // Empreinte : liste vide = absente, chicanes = autre empreinte, ordre des demandes sans effet.
  const without = buildStage(inputsFor(gpx, ways), "chicanes");
  assert.equal(without.obstacles, undefined);
  const empty = buildStage(inputsFor(gpx, ways, []), "chicanes");
  assert.equal(empty.obstacles, undefined);
  assert.equal(stageHash(empty), stageHash(without));
  assert.notEqual(stage.hash, stageHash(without));
  assert.equal(
    stageHash(buildStage(inputsFor(gpx, ways, [...chicanes].reverse()), "c")),
    stage.hash,
  );
  const shifted = structuredClone(stage);
  (shifted.obstacles ?? [])[0].position.x += 0.001;
  assert.notEqual(stageHash(shifted), stage.hash);

  // Clé de cache : identique sans chicane, stable selon l'ordre, différente avec.
  assert.equal(stageCacheKey(gpx, []), stageCacheKey(gpx));
  assert.notEqual(stageCacheKey(gpx, chicanes), stageCacheKey(gpx));
  assert.equal(
    stageCacheKey(gpx, chicanes),
    stageCacheKey(gpx, [...chicanes].reverse()),
  );

  // Codec : aller-retour exact, liste vide ou désordonnée refusée.
  const parsed = parseStage(JSON.parse(JSON.stringify(stageToJson(stage))));
  assert.deepEqual(parsed.obstacles, stage.obstacles);
  assert.equal(stageHash(parsed), stage.hash);
  const invalid = (patch: object, why: RegExp): void =>
    assert.throws(
      () =>
        parseStage(
          JSON.parse(
            JSON.stringify({ ...(stageToJson(stage) as object), ...patch }),
          ),
        ),
      why,
    );
  invalid({ obstacles: [] }, /obstacles/);
  invalid({ obstacles: [...blocks].reverse() }, /ordre des abscisses/);
  invalid({ obstacles: [{ ...blocks[0], span: 0 }] }, /span/);
  invalid({ obstacles: [{ ...blocks[0], side: "haut" }] }, /side/);

  checkRemovals(gpx);
  checkOrder(stage);
  checkScenery(stage);
  checkRespawn(stage);
  checkSweep(stage);
  checkHeadOn(stage);

  // La chicane se passe, et le temps ne dépend pas du chemin de la spéciale : génération, cache IndexedDB (clone), JSON.
  const generated = race(stage, 60 * 240);
  const { lapMs, respawns } = JSON.parse(generated) as {
    lapMs: number | null;
    respawns: number;
  };
  assert.ok(lapMs !== null, `spéciale non terminée : ${generated}`);
  assert.equal(respawns, 0, "le pilote de test a dû être remis en piste");
  assert.equal(race(structuredClone(stage), 60 * 240), generated, "cache");
  assert.equal(race(parsed, 60 * 240), generated, "JSON");
  console.log(
    `     spéciale à 2 chicanes roulée en ${lapMs} ms, trois fois au pas près`,
  );

  // Aller-retour : une chicane unique, franchie à l'aller puis au retour.
  const roundTrip = checkRoundTrip();
  checkRespawn(roundTrip);
  checkOrder(roundTrip);
  const lap = race(roundTrip, 60 * 300);
  const done = JSON.parse(lap) as { lapMs: number | null; respawns: number };
  assert.ok(done.lapMs !== null, `aller-retour non terminé : ${lap}`);
  assert.equal(done.respawns, 0, "remise en piste sur l'aller-retour");
  assert.equal(race(structuredClone(roundTrip), 60 * 300), lap);
  console.log(
    `     aller-retour roulé en ${done.lapMs} ms, chicane passée dans les deux sens`,
  );

  // Spéciale réelle : `road` accepte les chicanes du placement automatique, recalées sans perte ni déplacement.
  const road = JSON.parse(
    readFileSync(join("fixtures", "stages", "road.inputs.json"), "utf8"),
  ) as StageInputs;
  const base = buildStage(road, "road");
  assert.equal(base.obstacles, undefined);
  const { chicanes: placed } = placeChicanes(base.points, base.widths, {
    startS: base.startS,
    finishS: base.finishS,
    excluded: [],
  });
  const baseTrack = createStageTrack(base);
  const onRoad = buildStageWithWarnings(
    {
      ...road,
      chicanes: placed.map(({ s, side }) => {
        const point = baseTrack.poseAt(s).position;
        return {
          position: unproject({ x: point.x, z: point.z }, base.origin),
          side,
        };
      }),
    },
    "road",
  );
  assert.deepEqual(onRoad.warnings, []);
  assert.equal(onRoad.stage.obstacles?.length, placed.length * 2);
  placed.forEach(({ s }, i) => {
    const [a, b] = (onRoad.stage.obstacles ?? []).slice(i * 2, i * 2 + 2);
    assert.ok(Math.abs((a.s + b.s) / 2 - s) < 1, `chicane déplacée : ${s}`);
  });
  assert.ok(
    generateScenery(createStageTrack(onRoad.stage), SANDBOX_SEED).length > 0,
  );
}
