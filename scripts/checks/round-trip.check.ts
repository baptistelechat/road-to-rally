// Aller-retour sur la même route (story 3.7), sans réseau : un synthétique et trois ronds-points réels enregistrés.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeTrace } from "../../src/geo/analyzeTrace";
import { StageError } from "../../src/geo/errors";
import {
  parseGpx,
  project,
  splitRoundTrip,
  traceFromGpx,
  uniqueAxis,
  unproject,
  detectRoundTrip,
  type LatLon,
  type PlanePoint,
} from "../../src/geo/gpx";
import type { OsmWay } from "../../src/geo/osm";
import { axisHash, buildStage, type StageInputs } from "../../src/geo/pipeline";
import { corridorNodes } from "../../src/geo/terrain";
import { botInput } from "../../src/sim/bot";
import { initRapier, RAPIER } from "../../src/sim/rapier";
import { createSimulation } from "../../src/sim/simulation";
import { addTrackColliders } from "../../src/sim/track/colliders";
import { createMeshHeight } from "../../src/sim/track/meshHeight";
import { shoulderStrips } from "../../src/sim/track/ribbon";
import { createStageTrack } from "../../src/sim/track/stage";
import { parseStage, stageToJson } from "../../src/sim/track/stageCodec";
import type { MeshData, Quat, StageData, Track } from "../../src/sim/types";
import { syntheticLollipop } from "../prototypes/junction/geometry";

const ORIGIN: LatLon = { lat: 44.5, lon: 6 };
/** Ligne droite ajoutée devant les vrais ronds-points : un tracé fait au moins 2 km. */
const LEAD = 1300;
const CASES = [
  { name: "a-5.75", ring: [5.755222, 45.147165] },
  { name: "b-0.90", ring: [-0.900878, 44.213054] },
  { name: "c-6.07", ring: [6.078623, 44.563734] },
];

const gpxOf = (points: LatLon[], runoff: number | null): string =>
  [
    "<gpx><trk>",
    ...(runoff === null ? [] : [`<desc>rally-runoff=${runoff}</desc>`]),
    "<trkseg>",
    ...points.map(
      ({ lat, lon }) =>
        `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`,
    ),
    "</trkseg></trk></gpx>",
  ].join("\n");

const reversed = <T>(values: T[]): T[] => [...values].reverse();

/** Ce que l'éditeur écrira : le bras, la boucle, le bras en sens inverse. */
const syntheticPath = (radius: number, arm = LEAD): LatLon[] => {
  const { arm: a, loop } = syntheticLollipop(arm, radius, 8);
  const toLatLon = (p: PlanePoint): LatLon => unproject(p, ORIGIN);
  const go = a.map(toLatLon);
  return [...go, ...loop.slice(1, -1).map(toLatLon), ...reversed(go)];
};

const slopedField =
  (gx: number, gz: number) =>
  (p: LatLon): number => {
    const { x, z } = project(p, ORIGIN);
    return 500 + gx * x + gz * z + 2 * Math.sin(x / 37) * Math.cos(z / 53);
  };

/** Altitude IGN enregistrée par le prototype : bilinéaire dans la grille de 16 m, le nœud le plus proche en dehors. */
const ignField = (name: string, origin: LatLon) => {
  const { nodes, altitudes } = JSON.parse(
    readFileSync(
      join("scripts/prototypes/junction/ign", `${name}.json`),
      "utf8",
    ),
  ) as { nodes: PlanePoint[]; altitudes: number[] };
  const known = new Map<string, number>();
  nodes.forEach((n, i) => known.set(`${n.x},${n.z}`, altitudes[i]));
  const outside = new Map<string, number>();
  const nearestNode = (x: number, z: number): number => {
    const key = `${Math.round(x / 64)},${Math.round(z / 64)}`;
    const cached = outside.get(key);
    if (cached !== undefined) return cached;
    let best = altitudes[0];
    let bestD = Infinity;
    nodes.forEach((n, i) => {
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = altitudes[i];
      }
    });
    outside.set(key, best);
    return best;
  };
  return (p: LatLon): number => {
    const { x, z } = project(p, origin);
    const x0 = Math.floor(x / 16) * 16;
    const z0 = Math.floor(z / 16) * 16;
    const a = known.get(`${x0},${z0}`);
    const b = known.get(`${x0 + 16},${z0}`);
    const c = known.get(`${x0},${z0 + 16}`);
    const d = known.get(`${x0 + 16},${z0 + 16}`);
    if (
      a === undefined ||
      b === undefined ||
      c === undefined ||
      d === undefined
    )
      return nearestNode(x, z);
    const u = (x - x0) / 16;
    const v = (z - z0) / 16;
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
};

const inputsFor = (
  gpx: string,
  altitudeAt: (p: LatLon) => number,
  ways: OsmWay[] | null = null,
): StageInputs => {
  const trace = traceFromGpx(gpx);
  const unique = uniqueAxis(trace);
  return {
    gpx,
    axisHash: axisHash(trace),
    altitudes: unique.map((p) => altitudeAt(unproject(p, trace.origin))),
    ways,
    terrain: corridorNodes(unique).map((p) =>
      altitudeAt(unproject(p, trace.origin)),
    ),
    generatedAt: "2026-11-02T00:00:00.000Z",
  };
};

/** Avant de la voiture sur le plan horizontal : -Z local. */
const forwardOf = ({ x, y, z, w }: Quat): { x: number; z: number } => ({
  x: -2 * (x * z + w * y),
  z: -(1 - 2 * (x * x + y * y)),
});

const checkAxis = (name: string, stage: StageData): void => {
  assert.ok(stage.shared, `${name} : aller-retour non reconnu`);
  const { armEnd, returnStart } = stage.shared;
  assert.equal(returnStart + armEnd, stage.points.length - 1, name);
  for (let k = 0; k <= armEnd; k++) {
    assert.deepEqual(
      stage.points[returnStart + k],
      stage.points[armEnd - k],
      `${name} : point ${k} du retour`,
    );
    assert.equal(
      stage.widths[returnStart + k],
      stage.widths[armEnd - k],
      `${name} : largeur ${k} du retour`,
    );
  }
  const json = JSON.parse(JSON.stringify(stageToJson(stage))) as unknown;
  assert.deepEqual(parseStage(json), stage, `${name} : aller-retour JSON`);
};

/** Ruban, collisions et bas-côtés n'existent qu'une fois : autant de triangles que le bras et la boucle, pas un de plus. */
const checkOnce = (name: string, track: Track, stage: StageData): void => {
  const segments = track.unique.points.length - 1;
  assert.equal(segments, stage.shared?.returnStart, name);
  assert.equal(track.ribbon.indices.length / 6, segments, `${name} : ruban`);

  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  addTrackColliders(world, track, []);
  let triangles = 0;
  world.forEachCollider((collider) => {
    triangles += (collider.indices()?.length ?? 0) / 3;
  });
  world.free();
  assert.equal(
    triangles,
    segments * 2 * 3 + (track.terrain?.indices.length ?? 0) / 3,
    `${name} : collisions`,
  );

  const posts = createSimulation(undefined, stage);
  const count = posts.scenery.filter((item) => item.kind === "post").length;
  const expected = (2 * segments * 2) / 100 + 4;
  assert.ok(count <= expected, `${name} : ${count} plots pour ${expected}`);
  posts.free();
};

const planArea = ({ positions: p, indices }: MeshData, t: number): number => {
  const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
  return (
    ((p[b + 2] - p[a + 2]) * (p[c] - p[a]) -
      (p[b] - p[a]) * (p[c + 2] - p[a + 2])) /
    2
  );
};

/** Autour de la jonction : ni triangle dégénéré, ni trou, ni saut sous la roue, ni terrain au-dessus de la route. */
const checkJunction = (name: string, track: Track, stage: StageData): void => {
  const terrain = stage.terrain;
  assert.ok(terrain, `${name} : terrain absent`);
  let flat = 0;
  for (let t = 0; t < terrain.indices.length; t += 3)
    if (planArea(terrain, t) <= 1e-4) flat++;
  assert.equal(flat, 0, `${name} : ${flat} triangles dégénérés ou retournés`);

  const { armEnd = 0, returnStart = 0 } = stage.shared ?? {};
  const { points, widths, shoulders } = track.unique;
  const strips = shoulderStrips(points, widths, shoulders, false);
  const top = createMeshHeight([track.ribbon, ...strips, terrain]);
  const road = createMeshHeight([track.ribbon]);
  const ground = createMeshHeight([terrain]);
  const j = points[armEnd];
  let holes = 0;
  let cells = 0;
  let poke = 0;
  for (let x = j.x - 25 + 0.0137; x < j.x + 25; x += 0.1)
    for (let z = j.z - 25 + 0.0211; z < j.z + 25; z += 0.1) {
      cells++;
      if (top(x, z) === null) holes++;
      const r = road(x, z);
      const g = ground(x, z);
      if (r !== null && g !== null) poke = Math.max(poke, g - r);
    }
  assert.equal(holes, 0, `${name} : ${holes} trous sur ${cells} points`);
  assert.ok(poke < 0.01, `${name} : terrain ${poke.toFixed(3)} m sur la route`);

  // Roues à ±0,8 m de l'axe, de 40 m avant la jonction à 40 m après, tour compris.
  const path = track.points.slice(
    Math.max(0, armEnd - 20),
    Math.min(track.points.length, returnStart + 21),
  );
  let wheelStep = 0;
  for (const lateral of [-0.8, 0.8]) {
    let previous: number | null = null;
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i];
      const b = path[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      for (let k = 0; k < 20; k++) {
        const t = k / 20;
        const x = a.x + (b.x - a.x) * t - ((b.z - a.z) / len) * lateral;
        const z = a.z + (b.z - a.z) * t + ((b.x - a.x) / len) * lateral;
        const h = top(x, z);
        assert.notEqual(h, null, `${name} : pas de sol sous la roue`);
        if (previous !== null && h !== null)
          wheelStep = Math.max(wheelStep, Math.abs(h - previous));
        previous = h;
      }
    }
  }
  assert.ok(wheelStep < 0.05, `${name} : saut sous la roue ${wheelStep} m`);
  console.log(
    `     ${name} : ${terrain.indices.length / 3} triangles, saut sous la roue ${(wheelStep * 100).toFixed(1)} cm, axe ${track.length.toFixed(0)} m dont ${track.unique.points.length * 2} m uniques`,
  );

  // Le sol et le revêtement ne dépendent pas du passage : ils restent justes dans la fourche.
  for (let k = 0; k < 8; k++)
    for (const i of [armEnd + k, returnStart - k]) {
      const p = points[i];
      assert.equal(
        track.surfaceAt(p.x, p.z),
        "asphalt",
        `${name} : point ${i}`,
      );
      const y = track.groundAt(p.x, p.z);
      assert.ok(
        y !== null && Math.abs(y - p.y) < 0.1,
        `${name} : sol à ${y} pour une route à ${p.y}`,
      );
    }
};

/** Sans référence : le premier passage, comme avant. Avec : celui de la voiture, jusque dans la fourche. */
const checkNearest = (name: string, track: Track, stage: StageData): void => {
  const { armEnd = 0, returnStart = 0 } = stage.shared ?? {};
  const onReturn = returnStart + Math.floor(armEnd / 2);
  const p = track.points[onReturn];
  const first = track.nearest(p.x, p.z);
  assert.ok(first.s < track.length / 2, `${name} : pas le premier passage`);
  const start = track.poseAt(track.startS);
  assert.ok(
    Math.abs(track.nearest(start.position.x, start.position.z).s - track.startS) <
      0.01,
    name,
  );

  const s = first.s;
  const copy = track.nearest(p.x, p.z, track.length - s);
  assert.ok(
    Math.abs(copy.s - (track.length - s)) < 0.01,
    `${name} : passage suivi perdu, ${copy.s} pour ${track.length - s}`,
  );
  assert.ok(
    first.tangent.x * copy.tangent.x + first.tangent.z * copy.tangent.z < -0.99,
    `${name} : tangente du retour`,
  );
  assert.ok(Math.abs(copy.point.y - first.point.y) < 1e-9, name);
  assert.ok(Math.abs(copy.distance - first.distance) < 1e-6, name);

  // Dans la fourche, à la jonction : l'abscisse suivie décide, pas le centimètre le plus proche.
  const j = track.points[armEnd];
  const near = (from: number): number => track.nearest(j.x, j.z, from).s;
  const atGo = track.nearest(j.x, j.z).s;
  assert.ok(near(atGo + 4) < atGo + 1, `${name} : aller, jonction`);
  const atBack = atGo + (track.length - 2 * atGo);
  assert.ok(near(atBack - 4) > atBack - 1, `${name} : retour, jonction`);
};

interface Run {
  lapMs: number;
  final: string;
  maxDistance: number;
}

/** Le bot fait aller, tour et retour : sans contresens, sans remise en piste forcée, temps validé à l'arrivée. */
const checkRun = (name: string, stage: StageData): Run => {
  const sim = createSimulation(undefined, stage);
  const { track, lap } = sim;
  let lapMs: number | null = null;
  let previous = sim.routeS();
  let farthest = previous;
  let maxDistance = 0;
  let wrong = 0;
  let steps = 0;
  for (; steps < 60 * 600 && lapMs === null; steps++) {
    lapMs = sim.step(botInput(sim.state(), track, sim.routeS()));
    const s = sim.routeS();
    assert.ok(
      s >= previous - 1,
      `${name} : abscisse en arrière, ${previous} puis ${s}`,
    );
    assert.ok(s <= previous + 5, `${name} : saut de ${previous} à ${s}`);
    previous = s;
    farthest = Math.max(farthest, s);
    const { x, z } = sim.state().position;
    maxDistance = Math.max(maxDistance, track.nearest(x, z, s).distance);
    if (sim.recovery()?.kind === "wrongway") wrong++;
  }
  assert.notEqual(
    lapMs,
    null,
    `${name} : arrivée non atteinte, s=${farthest.toFixed(0)} sur ${track.finishS.toFixed(0)}, ${lap.checkpoints()} points de passage`,
  );
  assert.equal(sim.respawnCount(), 0, `${name} : remise en piste forcée`);
  assert.equal(wrong, 0, `${name} : contresens`);
  assert.equal(lap.finished(), true);
  assert.equal(lap.checkpoints(), 15);
  assert.ok(farthest >= track.finishS - 1, name);
  const { position, rotation, linearVelocity } = sim.state();
  const final = JSON.stringify({ position, rotation, linearVelocity, lapMs });
  sim.free();
  console.log(
    `     ${name} : arrivée en ${((lapMs ?? 0) / 1000).toFixed(1)} s, écart max ${maxDistance.toFixed(1)} m`,
  );
  return { lapMs: lapMs ?? 0, final, maxDistance };
};

/** Sur le retour, la remise en piste repart dans le sens du retour, à la main comme après une sortie de route. */
const checkRespawn = (name: string, stage: StageData): void => {
  const sim = createSimulation(undefined, stage);
  const { track } = sim;
  const { returnStart = 0, armEnd = 0 } = stage.shared ?? {};
  const midArm = track.points[returnStart + Math.floor(armEnd / 2)];
  const backS = track.length - track.nearest(midArm.x, midArm.z).s;
  for (let i = 0; i < 60 * 600 && sim.routeS() < backS; i++)
    sim.step(botInput(sim.state(), track, sim.routeS()));
  assert.ok(sim.routeS() >= backS, `${name} : retour jamais atteint`);

  const aligned = (): void => {
    const state = sim.state();
    const here = track.nearest(
      state.position.x,
      state.position.z,
      sim.routeS(),
    );
    assert.ok(
      here.s > track.length / 2,
      `${name} : remis sur l'aller, s=${here.s}`,
    );
    const f = forwardOf(state.rotation);
    assert.ok(
      f.x * here.tangent.x + f.z * here.tangent.z > 0.99,
      `${name} : remis à contresens`,
    );
  };
  sim.respawn();
  aligned();
  assert.equal(sim.respawnCount(), 1);

  // Sortie de route franche : le décompte finit par ramener sur le retour, jamais sur l'aller.
  const before = sim.routeS();
  for (let i = 0; i < 60 * 40 && sim.respawnCount() === 1; i++)
    sim.step({ steer: 1, throttle: 0.6, brake: 0, handbrake: false });
  assert.equal(sim.respawnCount(), 2, `${name} : pas de remise en piste`);
  aligned();
  assert.ok(
    Math.abs(sim.routeS() - before) < 150,
    `${name} : remis à ${sim.routeS()} pour ${before}`,
  );

  let lapMs: number | null = null;
  for (let i = 0; i < 60 * 300 && lapMs === null; i++)
    lapMs = sim.step(botInput(sim.state(), track, sim.routeS()));
  assert.notEqual(
    lapMs,
    null,
    `${name} : arrivée non atteinte après la sortie`,
  );
  sim.free();
};

const refused = (fn: () => unknown, message: RegExp): void => {
  assert.throws(
    fn,
    (error: unknown) =>
      error instanceof StageError && message.test(error.message),
  );
};

const checkRefusals = (): void => {
  const REFUSAL_ARM = 1500;
  const { arm, loop } = syntheticLollipop(REFUSAL_ARM, 25, 8);
  const toLatLon = (p: PlanePoint): LatLon => unproject(p, ORIGIN);
  const go = arm.map(toLatLon);

  // Même route dans le même sens : un croisement, à l'abscisse où le second passage rejoint le premier.
  const sameWay = [
    ...go,
    ...loop.slice(1, -1).map(toLatLon),
    ...go.slice(0, 1200),
  ];
  const sameWayGpx = gpxOf(sameWay, 250);
  refused(() => traceFromGpx(sameWayGpx), /se croise ou repasse/);
  const sameIssue = analyzeTrace(sameWayGpx).issues.find(
    (issue) => issue.code === "selfCrossing",
  );
  assert.ok(sameIssue?.blocking, "même sens non signalé");

  // Cul-de-sac : le bras et sa recopie, rien au bout. L'abscisse est celle du bout de la route.
  const deadEndGpx = gpxOf([...go, ...reversed(go).slice(1)], 250);
  refused(() => traceFromGpx(deadEndGpx), /revient sur ses pas/);
  const dead = analyzeTrace(deadEndGpx).issues.find(
    (issue) => issue.code === "deadEnd",
  );
  assert.ok(dead?.blocking, "cul-de-sac non signalé");
  assert.ok(
    Math.abs((dead?.s ?? 0) - (REFUSAL_ARM - 250)) < 10,
    `cul-de-sac signalé à ${dead?.s}`,
  );

  // Boucle sous 8 m : le rayon reste trop serré une fois la jonction épinglée.
  const tightGpx = gpxOf(syntheticPath(6, REFUSAL_ARM), 250);
  refused(() => traceFromGpx(tightGpx), /trop serré/);
  const tight = analyzeTrace(tightGpx).issues.find(
    (issue) => issue.code === "tightLoop",
  );
  assert.ok(tight?.blocking, "boucle serrée non signalée");
  assert.ok(Math.abs((tight?.s ?? 0) - (REFUSAL_ARM - 250)) < 10, `à ${tight?.s}`);

  // Aller et retour qui ne recollent pas : en montée franche vers la jonction, ils restent à plus de 5 cm l'un de l'autre.
  const steepGpx = gpxOf(syntheticPath(12, REFUSAL_ARM), 250);
  const steep = inputsFor(steepGpx, slopedField(0, 0));
  const trace = traceFromGpx(steepGpx);
  const armEnd = trace.roundTrip?.armEnd ?? 0;
  const returnStart = trace.roundTrip?.returnStart ?? 0;
  const uphill = inputsFor(gpxOf(syntheticPath(25, REFUSAL_ARM), 250), slopedField(0.08, 0));
  refused(() => buildStage(uphill, "pente"), /en hauteur/);

  // Le cache : des altitudes pour tout l'axe n'ont plus cours, le retour n'en a pas.
  assert.throws(
    () =>
      buildStage(
        {
          ...steep,
          altitudes: [...steep.altitudes, ...steep.altitudes.slice(0, armEnd)],
        },
        "cache",
      ),
    /altitudes en cache/,
  );

  // Une recopie annoncée à tort est refusée à la lecture.
  const stage = buildStage({ ...steep, terrain: null }, "codec");
  const json = JSON.parse(JSON.stringify(stageToJson(stage))) as Record<
    string,
    unknown
  >;
  for (const shared of [
    {},
    { armEnd: 1.5, returnStart },
    { armEnd, returnStart: returnStart + 1 },
    { armEnd: armEnd + 1, returnStart: returnStart - 1 },
  ])
    assert.throws(() => parseStage({ ...json, shared }), /Spéciale invalide/);

  // Les vraies spéciales ne sont pas touchées par la détection.
  for (const fixture of ["road", "mountain"])
    assert.equal(
      detectRoundTrip(
        parseGpx(readFileSync(`fixtures/stages/${fixture}.gpx`, "utf8")),
      ),
      null,
      fixture,
    );
};

/** Un vrai aller-retour BRouter : une ligne droite devant, le tour, puis le retour coupé par `splitRoundTrip`. */
const realCase = (name: string, ring: number[]) => {
  const json = JSON.parse(
    readFileSync(
      join("fixtures/brouter/roundabouts", `${name}.geojson`),
      "utf8",
    ),
  ) as { features: { geometry: { coordinates: number[][] } }[] };
  // c-6.07 : BRouter accroche son point de départ sur une petite voie, en crochet : à retirer pour y coller un bras droit.
  const trim = name === "c-6.07" ? [3, 2] : [0, 0];
  const all = json.features[0].geometry.coordinates;
  const coords: LatLon[] = all
    .slice(trim[0], all.length - trim[1])
    .map(([lon, lat]) => ({ lat, lon }));
  const origin = coords[0];
  const plane = coords.map((p) => project(p, origin));
  const target = project({ lat: ring[1], lon: ring[0] }, origin);
  let via = 0;
  plane.forEach((p, i) => {
    if (
      Math.hypot(p.x - target.x, p.z - target.z) <
      Math.hypot(plane[via].x - target.x, plane[via].z - target.z)
    )
      via = i;
  });
  // Dos au rond-point : le premier segment de BRouter part parfois à l'envers de la route.
  const dx = plane[via].x - plane[0].x;
  const dz = plane[via].z - plane[0].z;
  const norm = Math.hypot(dx, dz) || 1;
  const lead: LatLon[] = [];
  for (let d = LEAD; d > 0; d -= 50)
    lead.push(
      unproject(
        { x: plane[0].x - (dx / norm) * d, z: plane[0].z - (dz / norm) * d },
        origin,
      ),
    );
  const route = [...lead, ...coords, ...reversed(lead)];
  const split = splitRoundTrip(route, lead.length + via);
  assert.ok(split, `${name} : pas de bras commun`);
  const gpx = gpxOf(split.path, 250);
  const way: OsmWay = { id: 1, tags: { highway: "tertiary" }, geometry: route };
  return {
    gpx,
    realReturn: split.realReturn,
    inputs: inputsFor(gpx, ignField(name, origin), [way]),
  };
};

const fullCheck = (name: string, inputs: StageInputs): StageData => {
  const stage = buildStage(inputs, name);
  const track = createStageTrack(stage);
  checkAxis(name, stage);
  checkOnce(name, track, stage);
  checkJunction(name, track, stage);
  checkNearest(name, track, stage);
  return stage;
};

export default async function roundTripCheck(): Promise<void> {
  await initRapier();
  checkRefusals();

  const synth = syntheticPath(25);
  // Route vers un plateau, puis en pente franche : sans marquage, le prolongement inventé est recopié lui aussi.
  const flat = fullCheck(
    "synthétique",
    inputsFor(gpxOf(synth, 250), slopedField(0, 0)),
  );
  fullCheck(
    "synthétique sans marquage",
    inputsFor(gpxOf(synth, null), slopedField(0, 0.05)),
  );
  const sloped = fullCheck(
    "synthétique en pente",
    inputsFor(gpxOf(synth, 250), slopedField(0, 0.15)),
  );

  // Même spéciale, mêmes entrées : même temps au pas près, à la génération et depuis un cache rejoué.
  const first = checkRun("synthétique", flat);
  const again = checkRun(
    "synthétique relu",
    parseStage(JSON.parse(JSON.stringify(stageToJson(flat)))),
  );
  assert.equal(again.lapMs, first.lapMs, "temps différent depuis le cache");
  assert.equal(again.final, first.final, "course différente depuis le cache");
  checkRun("synthétique en pente", sloped);
  checkRespawn("synthétique", flat);

  for (const { name, ring } of CASES) {
    const { gpx, inputs, realReturn } = realCase(name, ring);
    const stage = fullCheck(name, inputs);
    const replay = buildStage(
      JSON.parse(JSON.stringify(inputs)) as StageInputs,
      name,
    );
    assert.deepEqual(replay, stage, `${name} : génération rejouée`);
    const run = checkRun(name, stage);
    assert.equal(checkRun(`${name} relu`, replay).lapMs, run.lapMs, name);
    checkRespawn(name, stage);

    const analysis = analyzeTrace(gpx, { realReturn });
    assert.equal(
      analysis.issues.filter((issue) => issue.blocking).length,
      0,
      `${name} : ${analysis.issues.map((issue) => issue.message).join(" ; ")}`,
    );
    const gap = analysis.issues.find((i) => i.code === "returnDeviation");
    if (name === "b-0.90") assert.equal(gap, undefined, name);
    if (name === "c-6.07")
      assert.ok(gap && !gap.blocking, "c-6.07 non signalé");
    console.log(
      `     ${name} : ${analysis.issues.map((i) => i.message).join(" ; ")}`,
    );
  }
}
