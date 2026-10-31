import assert from "node:assert/strict";
import { botInput } from "../../src/sim/bot";
import { FIXED_DT } from "../../src/sim/fixedStep";
import { initRapier } from "../../src/sim/rapier";
import { createSimulation } from "../../src/sim/simulation";
import { NEUTRAL_INPUT } from "../../src/sim/types";

interface LapRun {
  lapMs: number;
  maxDistance: number;
  maxVerticalJolt: number;
  minUp: number;
  fingerprint: number[];
}

// Le pilote automatique boucle un tour : prouve l'assemblage complet, sans rendu.
const runLap = (): LapRun => {
  const sim = createSimulation();
  let maxDistance = 0;
  let maxVerticalJolt = 0;
  let minUp = 1;
  let lastVy = 0;
  let lapMs: number | null = null;
  for (let i = 0; i < 60 * 240 && lapMs === null; i++) {
    lapMs = sim.step(botInput(sim.state(), sim.track));
    const state = sim.state();
    const { x, z } = state.position;
    maxDistance = Math.max(maxDistance, sim.track.nearest(x, z).distance);
    maxVerticalJolt = Math.max(
      maxVerticalJolt,
      Math.abs(state.linearVelocity.y - lastVy) / FIXED_DT,
    );
    lastVy = state.linearVelocity.y;
    const q = state.rotation;
    minUp = Math.min(minUp, 1 - 2 * (q.x * q.x + q.z * q.z));
  }
  const final = sim.state();
  const fingerprint = [
    final.position.x,
    final.position.y,
    final.position.z,
    final.rotation.w,
  ];
  sim.free();
  assert.notEqual(lapMs, null, "le pilote automatique n'a pas bouclé le tour");
  return {
    lapMs: lapMs ?? 0,
    maxDistance,
    maxVerticalJolt,
    minUp,
    fingerprint,
  };
};

export default async function check(): Promise<void> {
  await initRapier();

  const first = runLap();
  console.log(
    `     tour auto ${(first.lapMs / 1000).toFixed(2)} s, écart max à l'axe ${first.maxDistance.toFixed(1)} m, ` +
      `à-coup vertical max ${first.maxVerticalJolt.toFixed(0)} m/s², haut de caisse min ${first.minUp.toFixed(2)}`,
  );
  assert.ok(first.minUp > 0.7, `caisse trop inclinée : ${first.minUp}`);
  assert.ok(first.maxDistance < 12, `hors route : ${first.maxDistance} m`);

  const second = runLap();
  assert.deepEqual(
    second.fingerprint,
    first.fingerprint,
    "tour non déterministe",
  );
  assert.equal(second.lapMs, first.lapMs);

  // Un raccourci ne valide pas le tour : on téléporte sur la ligne sans passer les points.
  const sim = createSimulation();
  for (let i = 0; i < 120; i++) sim.step(NEUTRAL_INPUT);
  sim.restart();
  assert.equal(sim.lap.currentMs(), null);
  let lap: number | null = null;
  for (let i = 0; i < 600; i++) lap = lap ?? sim.step(NEUTRAL_INPUT);
  assert.equal(lap, null, "un tour validé sans rouler");
  sim.free();

  // La remise en piste repose la voiture sur ses roues, même après un roulage.
  const sim2 = createSimulation();
  for (let i = 0; i < 300; i++)
    sim2.step({ steer: 0.3, throttle: 1, brake: 0, handbrake: false });
  sim2.respawn();
  for (let i = 0; i < 180; i++) sim2.step(NEUTRAL_INPUT);
  const after = sim2.state();
  const { x, z } = after.position;
  assert.ok(sim2.track.nearest(x, z).distance < sim2.track.width / 2);
  assert.ok(after.speed < 1, `encore en mouvement : ${after.speed}`);
  assert.equal(sim2.respawnCount(), 1);
  sim2.free();
}
