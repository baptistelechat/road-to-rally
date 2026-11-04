import assert from "node:assert/strict";
import { createInputRecorder, replayInputs } from "../../src/input/recorder";
import { botInput } from "../../src/sim/bot";
import { FIXED_DT } from "../../src/sim/fixedStep";
import {
  createGhostPlayer,
  createPoseRecorder,
  parseGhost,
} from "../../src/sim/ghostTrack";
import { initRapier } from "../../src/sim/rapier";
import { createSimulation } from "../../src/sim/simulation";
import type { Pose } from "../../src/sim/types";

const STEPS = 60 * 30 + 3; // hors grille : le dernier échantillon tombe sur le dernier pas
const RESPAWN_AT = 60 * 20 + 2;
const STEP_MS = FIXED_DT * 1000;

const copy = ({ position: p, rotation: r }: Pose): Pose => ({
  position: { ...p },
  rotation: { ...r },
});

const gap = (a: Pose, b: Pose): { pos: number; rot: number } => ({
  pos: Math.hypot(
    a.position.x - b.position.x,
    a.position.y - b.position.y,
    a.position.z - b.position.z,
  ),
  // 1 - |q·q'| : nul pour la même rotation, quel que soit le signe.
  rot:
    1 -
    Math.abs(
      a.rotation.x * b.rotation.x +
        a.rotation.y * b.rotation.y +
        a.rotation.z * b.rotation.z +
        a.rotation.w * b.rotation.w,
    ),
});

export default async function check(): Promise<void> {
  await initRapier();

  // 30 s de bot, une remise en piste au milieu, chaque pas chronométré.
  const sim = createSimulation();
  const inputs = createInputRecorder();
  const poses = createPoseRecorder();
  const truth: Pose[] = [];
  for (let i = 0; i < STEPS; i++) {
    const input = botInput(sim.state(), sim.track);
    inputs.record(input);
    sim.step(input);
    if (i === RESPAWN_AT) sim.respawn();
    poses.record(sim.state(), sim.respawnCount());
    truth.push(copy(sim.state()));
  }
  const finalPose = copy(sim.state());
  sim.free();

  const built = poses.build(inputs.frames());
  assert.ok(built, "fantôme vide");
  // Le stockage passe par JSON : on relit ce qui serait réellement écrit.
  const json = JSON.stringify(built);
  const ghost = parseGhost(JSON.parse(json));
  assert.ok(ghost, "fantôme valide refusé");
  assert.ok(ghost.inputs, "entrées du bot écartées");
  const posesOnly = JSON.stringify({ ...ghost, inputs: undefined }).length;
  console.log(
    `     fantôme ${(json.length / 1024).toFixed(1)} Ko pour 30 s, dont poses ${(posesOnly / 1024).toFixed(1)} Ko, coupures ${ghost.cuts.length}`,
  );
  assert.equal(ghost.cuts.length, 1, "remise en piste non marquée");
  assert.equal(
    poses.build()?.samples.length,
    ghost.samples.length,
    "build non rejouable",
  );

  // Chaque pas, échantillonné ou interpolé, reste près de la vraie pose ; la coupure ne balaie pas le décor.
  const player = createGhostPlayer(ghost);
  let worstPos = 0;
  let worstRot = 0;
  for (let i = 0; i < STEPS; i++) {
    const pose = player.poseAt((i + 1) * STEP_MS);
    assert.ok(pose, `pas ${i} sans pose`);
    const { pos, rot } = gap(pose, truth[i]);
    // Les pas avant la coupure tiennent la pose d'avant, au plus une période.
    if (i >= RESPAWN_AT - ghost.period && i < RESPAWN_AT + ghost.period)
      continue;
    worstPos = Math.max(worstPos, pos);
    worstRot = Math.max(worstRot, rot);
  }
  console.log(
    `     écart max ${(worstPos * 100).toFixed(1)} cm, 1-|q·q'| max ${worstRot.toExponential(1)}`,
  );
  assert.ok(worstPos < 0.1, `fantôme trop loin : ${worstPos} m`);
  assert.ok(worstRot < 1e-3, `fantôme mal orienté : ${worstRot}`);
  const end = player.poseAt(STEPS * STEP_MS);
  assert.ok(end && gap(end, finalPose).pos < 0.01, "arrivée manquée");
  assert.equal(
    player.poseAt((STEPS + 1) * STEP_MS),
    null,
    "fantôme visible après sa fin",
  );

  // Données abîmées : refusées, jamais de plantage.
  assert.equal(parseGhost(null), null);
  assert.equal(parseGhost({ ...ghost, version: 1 }), null);
  assert.equal(parseGhost({ ...ghost, penalties: [1] }), null);
  assert.equal(parseGhost({ ...ghost, samples: ghost.samples.slice(1) }), null);
  assert.equal(parseGhost({ ...ghost, cuts: [0] }), null);
  assert.equal(parseGhost({ ...ghost, inputs: { runs: [1], count: 1 } }), null);

  // Les entrées stockées rejouent la même course au bit près.
  const replay = createSimulation();
  const next = replayInputs(ghost.inputs);
  for (let i = 0; i < STEPS; i++) {
    const input = next.next();
    assert.ok(input, `entrée ${i} manquante`);
    replay.step(input);
    if (i === RESPAWN_AT) replay.respawn();
  }
  assert.deepEqual(
    copy(replay.state()),
    finalPose,
    "rejeu des entrées divergent",
  );
  replay.free();
}
