import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { botInput } from "../../src/sim/bot";
import { carConfig } from "../../src/sim/carConfig";
import { FIXED_DT } from "../../src/sim/fixedStep";
import { createLapTimer } from "../../src/sim/lapTimer";
import { initRapier } from "../../src/sim/rapier";
import { createSimulation } from "../../src/sim/simulation";
import { createStageTrack } from "../../src/sim/track/stage";
import { parseStage, stageToJson } from "../../src/sim/track/stageCodec";
import { NEUTRAL_INPUT, type StageData, type Vec3 } from "../../src/sim/types";

const STEP = 2;

/** Portion du tracé : ligne droite si `turn` vaut 0, sinon arc de `turn` radians (positif à droite). */
export interface Leg {
  length: number;
  turn: number;
}

/** Axe à pas constant de 2 m, à partir d'une suite de portions et d'une pente en fonction de l'abscisse. */
export const axisFrom = (legs: Leg[], grade: (s: number) => number): Vec3[] => {
  const points: Vec3[] = [{ x: 0, y: 0, z: 0 }];
  // Cap de départ quelconque : sur un axe aligné au repère, les rayons de contrôle tombent pile sur les arêtes du maillage.
  let heading = 0.37;
  let s = 0;
  for (const { length, turn } of legs) {
    const count = Math.floor(length / STEP);
    for (let i = 0; i < count; i++) {
      const g = grade(s);
      const flat = STEP / Math.hypot(1, g);
      heading += turn / count;
      const last = points[points.length - 1];
      points.push({
        x: last.x + Math.cos(heading) * flat,
        y: last.y + flat * g,
        z: last.z + Math.sin(heading) * flat,
      });
      s += STEP;
    }
  }
  // Le contrat veut y >= 0.
  const lowest = points.reduce((min, p) => Math.min(min, p.y), 0);
  return points.map((p) => ({ ...p, y: p.y - lowest }));
};

/**
 * Spéciale de montagne d'environ 5 km : lacets à 15 %, épingles de rayon 8 m, largeur de 3,5 à 9 m, puis virages liés.
 */
export const syntheticStage = (): StageData => {
  const hairpin = Math.PI * 8;
  const legs: Leg[] = [{ length: 80, turn: 0 }];
  for (let i = 0; i < 18; i++) {
    legs.push({ length: 170, turn: 0 });
    legs.push({ length: hairpin, turn: i % 2 ? -Math.PI : Math.PI });
  }
  legs.push({ length: 60, turn: 0 });
  // Lacet terminé : courbes rapides pour reprendre de la vitesse, dans le prolongement.
  for (let i = 0; i < 6; i++)
    legs.push({ length: 110, turn: i % 2 ? -1.2 : 1.2 });
  legs.push({ length: 700, turn: 0 });

  // Pente qui s'inverse doucement : montée à 15 % sur les lacets, descente à 15 % sur la fin.
  const climbEnd = 3600;
  const grade = (s: number): number => {
    const blend = Math.max(-1, Math.min(1, (climbEnd - s) / 120));
    return 0.15 * blend;
  };
  const points = axisFrom(legs, grade);
  const widths = points.map(
    (_, i) => 6.25 + 2.75 * Math.sin((2 * Math.PI * i * STEP) / 700),
  );
  return {
    name: "Synthétique",
    origin: { lat: 44, lon: 7 },
    baseAltitude: 0,
    points,
    widths,
    startS: 30,
    finishS: (points.length - 1) * STEP - 30,
    terrain: null,
    pipelineVersion: 1,
    generatedAt: "2026-11-01T00:00:00.000Z",
    hash: "",
  };
};

const checkCodec = (stage: StageData): void => {
  const json = JSON.parse(JSON.stringify(stageToJson(stage))) as Record<
    string,
    unknown
  >;
  assert.deepEqual(parseStage(json), stage);

  const withTerrain = {
    ...json,
    terrain: { positions: [0, 0, 0, 1, 0, 0, 0, 0, 1], indices: [0, 1, 2] },
  };
  const parsed = parseStage(withTerrain);
  assert.ok(parsed.terrain?.positions instanceof Float32Array);
  assert.ok(parsed.terrain?.indices instanceof Uint32Array);
  assert.deepEqual(
    JSON.parse(JSON.stringify(stageToJson(parsed))),
    withTerrain,
  );

  for (const field of Object.keys(json)) {
    const partial = { ...json };
    delete partial[field];
    assert.throws(() => parseStage(partial), /Spéciale invalide/, field);
  }
  for (const bad of [
    null,
    42,
    [],
    { ...json, points: [{ x: 0, y: 0, z: 0 }] },
    { ...json, widths: [6] },
    { ...json, finishS: 0 },
    { ...json, terrain: { positions: [0, 0], indices: [] } },
    { ...json, terrain: { positions: [0, 0, 0], indices: [0, 0, 1] } },
  ])
    assert.throws(() => parseStage(bad), /Spéciale invalide/);
};

const checkRun = (name: string, stage: StageData): number => {
  const sim = createSimulation(carConfig, stage);
  const { track, lap } = sim;

  // Au départ : sur la route, l'arche devant, le chrono à zéro.
  const start = sim.state().position;
  const onStart = track.nearest(start.x, start.z);
  assert.ok(onStart.distance < 0.01, `départ à ${onStart.distance} m de l'axe`);
  assert.ok(Math.abs(onStart.s - track.startS) < 0.01, "départ hors de startS");

  let result: number | null = null;
  let maxDistance = 0;
  let minUp = 1;
  let maxJolt = 0;
  let lastVy = 0;
  let steps = 0;
  for (; steps < 60 * 900 && result === null; steps++) {
    result = sim.step(botInput(sim.state(), track));
    const { position: p, rotation: q } = sim.state();
    maxDistance = Math.max(maxDistance, track.nearest(p.x, p.z).distance);
    minUp = Math.min(minUp, 1 - 2 * (q.x * q.x + q.z * q.z));
    const vy = sim.state().linearVelocity.y;
    maxJolt = Math.max(maxJolt, Math.abs(vy - lastVy) / FIXED_DT);
    lastVy = vy;
  }
  const reached = track.nearest(sim.state().position.x, sim.state().position.z);
  assert.notEqual(
    result,
    null,
    `${name} : arrivée non atteinte, arrêt à s=${reached.s.toFixed(0)} sur ${track.finishS.toFixed(0)}, ` +
      `${lap.checkpoints()} points de passage, ${sim.respawnCount()} remises en piste`,
  );
  console.log(
    `     ${name} : ${track.length.toFixed(0)} m, arrivée en ${((result ?? 0) / 1000).toFixed(1)} s, ` +
      `écart max ${maxDistance.toFixed(1)} m, haut de caisse min ${minUp.toFixed(2)}, à-coup max ${maxJolt.toFixed(0)} m/s², ${sim.respawnCount()} remises en piste`,
  );
  assert.equal(sim.respawnCount(), 0, `${name} : remise en piste forcée`);
  assert.equal(lap.finished(), true);

  // Chrono figé après l'arrivée. La voiture s'arrête seule, même pied au plancher, sans enclencher la marche arrière.
  const frozen = lap.currentMs();
  assert.equal(frozen, result);
  let later: number | null = null;
  for (let i = 0; i < 60 * 15; i++)
    later =
      later ?? sim.step({ steer: 0, throttle: 1, brake: 0, handbrake: false });
  assert.equal(later, null, "arrivée validée deux fois");
  assert.equal(lap.currentMs(), frozen, "chrono non figé");
  const stopped = sim.state();
  assert.ok(stopped.speed < 0.01, `encore à ${stopped.speed} m/s après l'arrivée`);
  assert.ok(stopped.gear > 0, `rapport ${stopped.gear} après l'arrivée`);
  const end = track.nearest(stopped.position.x, stopped.position.z);
  // Le tracé synthétique ne garde que 30 m : seules les fixtures ont la place de s'arrêter à fond.
  if (track.length - track.finishS > 200)
    assert.ok(end.s < track.length, "arrêt au-delà de la route");

  sim.restart();
  assert.equal(lap.finished(), false);
  assert.equal(lap.currentMs(), null);
  sim.free();
  return result ?? 0;
};

/** Immobile sur la ligne jusqu'au premier gaz, chrono compris. Reculer derrière la ligne ramène au départ. */
const checkStartLine = (stage: StageData): void => {
  const sim = createSimulation(carConfig, stage);
  const { track, lap } = sim;
  const at = { ...sim.state().position };
  for (let i = 0; i < 180; i++)
    sim.step({ ...NEUTRAL_INPUT, brake: i % 2, steer: 0.5 });
  const still = sim.state().position;
  assert.equal(Math.hypot(still.x - at.x, still.y - at.y, still.z - at.z), 0);
  assert.equal(lap.currentMs(), null, "chrono lancé sans gaz");

  for (let i = 0; i < 30; i++) sim.step({ ...NEUTRAL_INPUT, throttle: 1 });
  assert.ok(lap.currentMs() !== null, "chrono non lancé par le gaz");
  for (let i = 0; i < 60 * 30 && sim.respawnCount() === 0; i++)
    sim.step({ ...NEUTRAL_INPUT, brake: 1 });
  assert.equal(sim.respawnCount(), 1, "recul derrière la ligne non rattrapé");
  const back = sim.state().position;
  assert.ok(
    Math.abs(track.nearest(back.x, back.z).s - track.startS) < 0.5,
    "pas ramenée à la ligne",
  );
  sim.free();
};

/** Un raccourci ne valide rien : l'arrivée seule ne fige pas le chrono, tous les points de passage sont exigés. */
const checkShortcut = (stage: StageData): void => {
  const track = createStageTrack(stage);
  const lap = createLapTimer(track, track.startPose);
  const at = (s: number): Vec3 => track.poseAt(s).position;
  const course = track.finishS - track.startS;
  const end = at(track.finishS + 2);

  assert.equal(lap.update(end.x, end.z), null, "raccourci validé");
  assert.equal(lap.finished(), false);
  assert.equal(lap.checkpoints(), 0);
  for (let i = 0; i < 16; i++) {
    const p = at(track.startS + (course * i) / 16 + 2);
    assert.equal(lap.update(p.x, p.z), null);
  }
  assert.equal(lap.checkpoints(), 15);
  const ms = lap.update(end.x, end.z);
  assert.ok(ms !== null && ms > 0, "arrivée non validée");
  assert.equal(lap.finished(), true);
  assert.equal(lap.update(end.x, end.z), null, "arrivée validée deux fois");
  lap.reset();
  assert.equal(lap.finished(), false);
  assert.equal(lap.currentMs(), null);
  assert.equal(lap.checkpoints(), 0);
};

/** Remise en piste en pleine pente, en montée comme en descente : ni bond, ni chute. */
const checkSlopeRespawn = (stage: StageData): void => {
  const sim = createSimulation(carConfig, stage);
  const { track } = sim;
  // Les pentes les plus raides du tracé, dans chaque sens : une route presque plate n'a rien à prouver.
  const steepest = { [1]: 0, [-1]: 0 };
  for (let i = 1; i < track.points.length; i++) {
    const a = track.points[i - 1];
    const b = track.points[i];
    const slope = (b.y - a.y) / (Math.hypot(b.x - a.x, b.z - a.z) || 1);
    const key = slope > 0 ? 1 : -1;
    steepest[key] = Math.max(steepest[key], Math.abs(slope));
  }
  const wanted = [1, -1].filter((sign) => steepest[sign as 1 | -1] > 0.03);
  const up = new Set<number>();
  let result: number | null = null;
  for (
    let i = 0;
    i < 60 * 900 && result === null && up.size < wanted.length;
    i++
  ) {
    result = sim.step(botInput(sim.state(), track));
    const { position, speed } = sim.state();
    const here = track.nearest(position.x, position.z);
    const sign = Math.sign(here.tangent.y);
    if (
      !wanted.includes(sign) ||
      up.has(sign) ||
      speed < 3 ||
      Math.abs(here.tangent.y) < 0.6 * steepest[sign as 1 | -1]
    )
      continue;
    up.add(sign);

    sim.respawn();
    const pose = sim.state();
    const forward = {
      x:
        -2 *
        (pose.rotation.x * pose.rotation.z + pose.rotation.w * pose.rotation.y),
      y:
        -2 *
        (pose.rotation.y * pose.rotation.z - pose.rotation.w * pose.rotation.x),
      z: -(1 - 2 * (pose.rotation.x ** 2 + pose.rotation.y ** 2)),
    };
    const tangent = track.nearest(pose.position.x, pose.position.z).tangent;
    assert.ok(
      forward.x * tangent.x + forward.y * tangent.y + forward.z * tangent.z >
        0.999,
      "la pose ne suit pas la pente",
    );
    // Roulis nul : le côté droit de la caisse reste à l'horizontale.
    const rightY =
      2 *
      (pose.rotation.x * pose.rotation.y + pose.rotation.w * pose.rotation.z);
    assert.ok(Math.abs(rightY) < 1e-6, `roulis ${rightY}`);

    const rest = carConfig.ride.height;
    let lastVy = sim.state().linearVelocity.y;
    for (let k = 0; k < 90; k++) {
      sim.step({ ...NEUTRAL_INPUT, brake: 1 });
      const state = sim.state();
      const road = track.nearest(state.position.x, state.position.z).point.y;
      const clearance = state.position.y - road;
      assert.ok(
        clearance > rest - 0.25 && clearance < rest + 0.25,
        `caisse à ${clearance.toFixed(2)} m de la route au pas ${k}, repos ${rest}`,
      );
      const vy = state.linearVelocity.y;
      assert.ok(
        Math.abs(vy - lastVy) / FIXED_DT < 40,
        `à-coup vertical ${((vy - lastVy) / FIXED_DT).toFixed(0)} m/s²`,
      );
      assert.ok(vy < 1.5, `bond à ${vy.toFixed(2)} m/s`);
      lastVy = vy;
    }
  }
  assert.equal(up.size, wanted.length, "pente attendue jamais rencontrée");
  sim.free();
};

export default async function check(): Promise<void> {
  await initRapier();

  const synthetic = syntheticStage();
  checkCodec(synthetic);
  checkShortcut(synthetic);
  const first = checkRun("synthétique", synthetic);
  assert.equal(
    checkRun("synthétique bis", synthetic),
    first,
    "non déterministe",
  );
  checkSlopeRespawn(synthetic);

  for (const fixture of ["road", "mountain"]) {
    const path = `public/stages/${fixture}.json`;
    if (!existsSync(path)) continue;
    const stage = parseStage(JSON.parse(readFileSync(path, "utf8")));
    checkShortcut(stage);
    checkStartLine(stage);
    checkRun(fixture, stage);
    checkSlopeRespawn(stage);
  }
}
