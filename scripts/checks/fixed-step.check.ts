import assert from "node:assert/strict";
import { createFixedStepper, FIXED_DT } from "../../src/sim/fixedStep";
import { initRapier, RAPIER } from "../../src/sim/rapier";

// Une boîte qui tombe : mêmes pas = mêmes positions au bit près.
const runBox = (): number[] => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.5, 50));
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0.1, 8, 0.2)
      .setRotation({ x: 0.1, y: 0.2, z: 0.05, w: 0.97 }),
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5), body);
  for (let i = 0; i < 600; i++) world.step();
  const t = body.translation();
  const r = body.rotation();
  world.free();
  return [t.x, t.y, t.z, r.x, r.y, r.z, r.w];
};

export default async function check(): Promise<void> {
  await initRapier();
  assert.deepEqual(runBox(), runBox());

  // Une seconde découpée en images de durées différentes donne le même nombre de pas.
  const stepsAt = (fps: number): number => {
    const stepper = createFixedStepper();
    let steps = 0;
    for (let i = 0; i < fps; i++) stepper.advance(1 / fps, () => steps++);
    return steps;
  };
  for (const fps of [30, 60, 144])
    assert.ok(
      Math.abs(stepsAt(fps) - 60) <= 1,
      `${fps} FPS : ${stepsAt(fps)} pas`,
    );

  // Après un gros trou (onglet en arrière-plan), on plafonne et on ne garde pas de retard.
  const stepper = createFixedStepper();
  let steps = 0;
  stepper.advance(10, () => steps++);
  assert.equal(steps, 5);
  const before = steps;
  stepper.advance(FIXED_DT / 2, () => steps++);
  assert.equal(steps, before);
}
