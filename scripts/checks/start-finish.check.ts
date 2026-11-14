// Départ arrêté, pénalité de remise en piste et temps d'arrivée d'une spéciale (stories 4.1 et 4.3).
import assert from "node:assert/strict";
import { botInput } from "../../src/sim/bot";
import { FIXED_DT } from "../../src/sim/fixedStep";
import { initRapier } from "../../src/sim/rapier";
import {
  COUNTDOWN_S,
  createSimulation,
  RESPAWN_PENALTY_MS,
} from "../../src/sim/simulation";
import { createNotesBenchStage } from "../../src/sim/track/notesBenchTrack";
import { NEUTRAL_INPUT } from "../../src/sim/types";

const FULL_GAS = { steer: 0, throttle: 1, brake: 0, handbrake: false };
const COUNTDOWN_STEPS = Math.round(COUNTDOWN_S / FIXED_DT);

/** Gaz à fond dès le premier pas : la voiture reste sur la ligne et le chrono part au GO, pas avant. */
const checkCountdown = (): void => {
  const sim = createSimulation(undefined, createNotesBenchStage());
  const start = { ...sim.state().position };
  assert.equal(sim.countdown(), COUNTDOWN_S);
  for (let i = 1; i < COUNTDOWN_STEPS; i++) {
    sim.step(FULL_GAS);
    assert.equal(sim.lap.currentMs(), null, "chrono parti avant le GO");
    assert.ok((sim.countdown() ?? 0) > 0, "décompte fini trop tôt");
  }
  const { x, z } = sim.state().position;
  assert.ok(
    Math.hypot(x - start.x, z - start.z) < 1e-6,
    "faux départ : la voiture a bougé pendant le décompte",
  );
  sim.step(FULL_GAS);
  assert.equal(sim.countdown(), null);
  assert.equal(sim.lap.currentMs(), Math.round(FIXED_DT * 1000));

  // Pénalité après le GO, comptée dans le chrono et remise à zéro par la relance.
  for (let i = 0; i < 120; i++) sim.step(FULL_GAS);
  const before = sim.lap.currentMs() ?? 0;
  sim.respawn();
  assert.equal(sim.lap.penaltyMs(), RESPAWN_PENALTY_MS);
  assert.equal(sim.lap.penaltyCount(), 1);
  assert.equal(sim.lap.currentMs(), before + RESPAWN_PENALTY_MS);

  sim.restart();
  assert.equal(sim.countdown(), COUNTDOWN_S);
  assert.equal(sim.lap.currentMs(), null);
  assert.equal(sim.lap.penaltyMs(), 0);
  // Pendant le décompte, ni remise en piste ni pénalité.
  for (let i = 0; i < 200; i++) sim.step({ ...NEUTRAL_INPUT, respawn: true });
  assert.equal(sim.lap.penaltyCount(), 0);
  sim.free();
};

/** Une remise en piste puis l'arrivée : le temps rendu inclut la pénalité, plus rien ne s'ajoute ensuite. */
const runToFinish = (): number => {
  const sim = createSimulation(undefined, createNotesBenchStage());
  for (let i = 0; i < COUNTDOWN_STEPS + 60; i++)
    sim.step(botInput(sim.state(), sim.track, sim.routeS()));
  sim.respawn();
  let lapMs: number | null = null;
  for (let i = 0; i < 60 * 600 && lapMs === null; i++)
    lapMs = sim.step(botInput(sim.state(), sim.track, sim.routeS()));
  assert.notEqual(lapMs, null, "le bot n'a pas fini la spéciale");
  assert.equal(lapMs, sim.lap.currentMs());
  assert.equal(sim.lap.penaltyMs(), RESPAWN_PENALTY_MS);
  sim.respawn();
  assert.equal(
    sim.lap.penaltyMs(),
    RESPAWN_PENALTY_MS,
    "pénalité après l'arrivée",
  );
  assert.equal(sim.lap.currentMs(), lapMs);
  sim.free();
  return lapMs ?? 0;
};

export default async function check(): Promise<void> {
  await initRapier();
  checkCountdown();
  const first = runToFinish();
  assert.equal(runToFinish(), first, "temps d'arrivée non déterministe");
  console.log(
    `     décompte ${COUNTDOWN_S} s, arrivée en ${(first / 1000).toFixed(2)} s dont ${RESPAWN_PENALTY_MS / 1000} s de pénalité`,
  );
}
