// Aller-retour en milieu de spéciale : deux chaussées séparées par un terre-plein, sans réseau.
import assert from "node:assert/strict";
import { analyzeTrace } from "../../src/geo/analyzeTrace";
import { DUAL_WIDTH, MEDIAN_WIDTH } from "../../src/geo/config";
import {
  parseGpx,
  project,
  traceFromGpx,
  unproject,
  type LatLon,
} from "../../src/geo/gpx";
import { axisHash, buildStage, type StageInputs } from "../../src/geo/pipeline";
import { corridorNodes } from "../../src/geo/terrain";
import { botInput } from "../../src/sim/bot";
import { initRapier } from "../../src/sim/rapier";
import { createSimulation } from "../../src/sim/simulation";
import { createMeshHeight } from "../../src/sim/track/meshHeight";
import { shoulderStrips } from "../../src/sim/track/ribbon";
import { parseStage, stageToJson } from "../../src/sim/track/stageCodec";
import type { MeshData, StageData } from "../../src/sim/types";

const ORIGIN: LatLon = { lat: 48, lon: 0.2 };

/**
 * Une rue latérale arrive au T, le tracé file vers l'ouest jusqu'au rond-point, en fait le tour et repasse devant le T vers l'est.
 * `fromSouth` : la rue arrive du sud, l'entrée coupe la chaussée du retour. `separation` : écart entre les chaussées d'OSM,
 * 0 pour une seule route, 8 comme l'avenue Bollée au Mans et son tram. Coordonnées x à l'est, y au nord.
 */
const tJunctionGpx = (fromSouth = false, separation = 0): string => {
  const h = separation / 2;
  const a0 = Math.asin(h / 15);
  const points: { x: number; y: number }[] = [];
  const line = (ax: number, ay: number, bx: number, by: number): void => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 10);
    for (let i = 1; i <= n; i++)
      points.push({
        x: ax + ((bx - ax) * i) / n,
        y: ay + ((by - ay) * i) / n,
      });
  };
  points.push({ x: 0, y: fromSouth ? -1000 : 1000 });
  line(0, fromSouth ? -1000 : 1000, 0, h);
  line(0, h, -215 + 15 * Math.cos(a0), h);
  // Giratoire dans le sens trigonométrique, île à gauche : centre (-215, 0), 15 m de rayon.
  for (let k = 1; k <= 36; k++) {
    const angle = a0 + (k / 36) * (2 * Math.PI - 2 * a0);
    points.push({ x: -215 + 15 * Math.cos(angle), y: 15 * Math.sin(angle) });
  }
  line(-215 + 15 * Math.cos(a0), -h, 1200, -h);
  return [
    "<gpx><trk><trkseg>",
    ...points.map(({ x, y }) => {
      const { lat, lon } = unproject({ x, z: -y }, ORIGIN);
      return `<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"></trkpt>`;
    }),
    "</trkseg></trk></gpx>",
  ].join("\n");
};

const altitudeAt = (p: LatLon): number => {
  const { x, z } = project(p, ORIGIN);
  return 80 + 0.01 * x + 3 * Math.sin(x / 90) * Math.cos(z / 70);
};

const inputsFor = (gpx: string): StageInputs => {
  const trace = traceFromGpx(gpx);
  return {
    gpx,
    axisHash: axisHash(trace),
    altitudes: trace.points.map((p) => altitudeAt(unproject(p, trace.origin))),
    ways: null,
    terrain: corridorNodes(trace.points).map((p) =>
      altitudeAt(unproject(p, trace.origin)),
    ),
    generatedAt: "2026-11-04T00:00:00.000Z",
  };
};

const planArea = ({ positions: p, indices }: MeshData, t: number): number => {
  const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
  return (
    ((p[b + 2] - p[a + 2]) * (p[c] - p[a]) -
      (p[b] - p[a]) * (p[c + 2] - p[a + 2])) /
    2
  );
};

/** Le long de la glissière : deux chaussées à l'écart, du sol partout, rien du terrain sur la route. */
const checkMedian = (stage: StageData): void => {
  const sim = createSimulation(undefined, stage);
  const { track } = sim;
  assert.equal(track.medians.length, 1, "une glissière attendue");
  const median = track.medians[0].points;
  const length = median
    .slice(1)
    .reduce(
      (sum, p, i) => sum + Math.hypot(p.x - median[i].x, p.z - median[i].z),
      0,
    );
  assert.ok(length > 150, `glissière de ${length.toFixed(0)} m seulement`);

  // Le bord de chaque chaussée reste à l'écart de la glissière.
  for (const p of median) {
    const { distance, width } = track.nearest(p.x, p.z);
    assert.ok(
      distance - width / 2 >= MEDIAN_WIDTH / 2 - 0.65,
      `glissière à ${(distance - width / 2).toFixed(2)} m du bord de la route`,
    );
  }

  const terrain = stage.terrain;
  assert.ok(terrain, "terrain absent");
  let flat = 0;
  for (let t = 0; t < terrain.indices.length; t += 3)
    if (planArea(terrain, t) <= 1e-4) flat++;
  assert.equal(flat, 0, `${flat} triangles dégénérés ou retournés`);

  const { points, widths, shoulders } = track.unique;
  const top = createMeshHeight([
    track.ribbon,
    ...shoulderStrips(points, widths, shoulders, false),
    terrain,
  ]);
  const road = createMeshHeight([track.ribbon]);
  const ground = createMeshHeight([terrain]);
  let holes = 0;
  let poke = 0;
  // En travers du terre-plein, d'une chaussée à l'autre, tous les 10 m.
  for (let i = 0; i < median.length; i += 5) {
    const a = median[Math.max(0, i - 1)];
    const b = median[Math.min(median.length - 1, i + 1)];
    const norm = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const across = { x: -(b.z - a.z) / norm, z: (b.x - a.x) / norm };
    for (let k = -DUAL_WIDTH * 1.5; k <= DUAL_WIDTH * 1.5; k += 0.1) {
      const x = median[i].x + across.x * k + 0.0137;
      const z = median[i].z + across.z * k + 0.0211;
      if (top(x, z) === null) holes++;
      const r = road(x, z);
      const g = ground(x, z);
      if (r !== null && g !== null) poke = Math.max(poke, g - r);
    }
  }
  assert.equal(holes, 0, `${holes} trous dans le terre-plein`);
  assert.ok(poke < 0.01, `terrain ${poke.toFixed(3)} m sur la route`);
  sim.free();
};

/** Le bot roule l'aller, le tour et le retour sans sortie, sans contresens, sans toucher la glissière au point d'en sortir. */
const checkRun = (name: string, stage: StageData): string => {
  const sim = createSimulation(undefined, stage);
  const { track } = sim;
  let lapMs: number | null = null;
  let previous = sim.routeS();
  let wrong = 0;
  for (let steps = 0; steps < 60 * 600 && lapMs === null; steps++) {
    lapMs = sim.step(botInput(sim.state(), track, sim.routeS()));
    const s = sim.routeS();
    assert.ok(s >= previous - 1, `${name} : abscisse en arrière`);
    assert.ok(s <= previous + 5, `${name} : saut de ${previous} à ${s}`);
    previous = s;
    if (sim.recovery()?.kind === "wrongway") wrong++;
  }
  assert.notEqual(
    lapMs,
    null,
    `${name} : arrivée non atteinte à s=${previous}`,
  );
  assert.equal(sim.respawnCount(), 0, `${name} : remise en piste forcée`);
  assert.equal(wrong, 0, `${name} : contresens`);
  const { position, rotation, linearVelocity } = sim.state();
  sim.free();
  console.log(
    `     ${name} : arrivée en ${((lapMs ?? 0) / 1000).toFixed(1)} s`,
  );
  return JSON.stringify({ position, rotation, linearVelocity, lapMs });
};

export default async function dualCarriagewayCheck(): Promise<void> {
  await initRapier();

  const gpx = tJunctionGpx();
  const analysis = analyzeTrace(gpx);
  assert.deepEqual(
    analysis.issues.filter((issue) => issue.blocking).map((i) => i.message),
    [],
    "T par la droite refusé",
  );
  assert.equal(analysis.axis?.dual?.length, 1, "tronçon partagé non détecté");

  // Tourner à gauche coupe la chaussée du retour : refusé, comme tout croisement.
  const left = analyzeTrace(tJunctionGpx(true));
  assert.ok(
    left.issues.some((issue) => issue.blocking),
    "T par la gauche accepté",
  );

  const inputs = inputsFor(gpx);
  const stage = buildStage(inputs, "T");
  assert.equal(stage.shared, undefined, "deux chaussées, pas de recopie");
  assert.ok(stage.medians, "glissière absente de la spéciale");
  assert.deepEqual(
    buildStage(JSON.parse(JSON.stringify(inputs)) as StageInputs, "T"),
    stage,
    "génération rejouée",
  );
  checkMedian(stage);

  const first = checkRun("T", stage);
  const replay = checkRun(
    "T relu",
    parseStage(JSON.parse(JSON.stringify(stageToJson(stage)))),
  );
  assert.equal(replay, first, "course différente depuis le cache");

  // Deux chaussées déjà séparées dans OSM, comme une avenue à tram : reconnues, gardées en place, sans contact.
  const avenue = tJunctionGpx(false, 8);
  const split = analyzeTrace(avenue, {
    widthsByHighway: [
      {
        points: parseGpx(avenue),
        ways: [{ fromIndex: 0, highway: "primary" }],
      },
    ],
  });
  assert.deepEqual(
    split.issues.filter((issue) => issue.blocking).map((i) => i.message),
    [],
    "avenue à deux chaussées refusée",
  );
  assert.equal(split.axis?.dual?.length, 1, "avenue non détectée");
  const avenueStage = buildStage(inputsFor(avenue), "avenue");
  checkMedian(avenueStage);
  checkRun("avenue", avenueStage);
}
