import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { updateRumble } from "../../src/audio/gamepadRumble";
import { createInputRecorder, replayInputs } from "../../src/input/recorder";
import { carConfig } from "../../src/sim/carConfig";
import { FIXED_DT } from "../../src/sim/fixedStep";
import { createLightProps, isLightProp } from "../../src/sim/lightProps";
import { initRapier, RAPIER } from "../../src/sim/rapier";
import { createRecovery, isWrongWay } from "../../src/sim/recovery";
import { createSimulation } from "../../src/sim/simulation";
import { parseStage } from "../../src/sim/track/stageCodec";
import {
  NEUTRAL_INPUT,
  type CarState,
  type SceneryItem,
  type StageData,
  type TrackSample,
} from "../../src/sim/types";
import { createVehicle } from "../../src/sim/vehicle";

const fakeTrack = (distance: () => number) => ({
  width: 6,
  nearest: (): TrackSample => ({
    s: 0,
    point: { x: 0, y: 0, z: 0 },
    tangent: { x: 0, y: 0, z: -1 },
    distance: distance(),
    width: 6,
  }),
});

const stepsUntilFire = (
  update: () => boolean,
  max = 60 * 30,
): number | null => {
  for (let i = 1; i <= max; i++) if (update()) return i;
  return null;
};

const FACING_TANGENT = { x: 0, y: 0, z: 0, w: 1 };
const FACING_BACK = { x: 0, y: 1, z: 0, w: 0 };
const AT_ORIGIN = { x: 0, y: 0, z: 0 };
const STILL = { x: 0, y: 0, z: 0 };
const input = (held: boolean, overrides = {}) => ({
  held,
  position: AT_ORIGIN,
  rotation: FACING_TANGENT,
  velocity: STILL,
  ...overrides,
});

const checkRecovery = (): void => {
  // Maintien : 3 s exactement, annulable, et pas de nouvelle remise sans relâcher.
  let distance = 0;
  const hold = createRecovery(fakeTrack(() => distance));
  for (let i = 0; i < 120; i++) assert.equal(hold.update(input(true)), false);
  assert.equal(hold.status()?.kind, "hold");
  hold.update(input(false));
  assert.equal(hold.status(), null, "relâcher annule le décompte");
  assert.equal(
    stepsUntilFire(() => hold.update(input(true))),
    180,
    "appui maintenu pendant 3 s",
  );
  for (let i = 0; i < 400; i++)
    assert.equal(hold.update(input(true)), false, "il faut relâcher d'abord");

  // Hors piste : 3 s dès qu'on quitte le bas-côté (3 m de chaussée + 2,5 m), décompte visible tout de suite.
  distance = 5.4;
  const off = createRecovery(fakeTrack(() => distance));
  for (let i = 0; i < 600; i++)
    assert.equal(off.update(input(false)), false, "le bas-côté reste permis");
  assert.equal(off.status(), null);
  distance = 5.6;
  off.update(input(false));
  assert.equal(off.status()?.kind, "offroad");
  assert.equal(
    stepsUntilFire(() => off.update(input(false))),
    179,
  );

  // Enchaîner les coupes courtes finit par coûter : le compteur se vide, il ne repart pas de zéro.
  const cuts = createRecovery(fakeTrack(() => distance));
  distance = 8;
  for (let i = 0; i < 120; i++) cuts.update(input(false));
  distance = 0;
  for (let i = 0; i < 60; i++) cuts.update(input(false));
  assert.equal(cuts.status(), null, "de retour sur la route, plus de décompte");
  distance = 8;
  assert.equal(
    stepsUntilFire(() => cuts.update(input(false))),
    120,
  );

  // Contresens : 2 s de grâce, puis 3 s de décompte visible.
  distance = 0;
  const backward = { rotation: FACING_BACK, velocity: { x: 0, y: 0, z: 5 } };
  const wrong = createRecovery(fakeTrack(() => distance));
  for (let i = 0; i < 100; i++) wrong.update(input(false, backward));
  assert.equal(wrong.status(), null, "pas de décompte pendant la grâce");
  for (let i = 0; i < 30; i++) wrong.update(input(false, backward));
  assert.equal(wrong.status()?.kind, "wrongway");
  assert.equal(
    stepsUntilFire(() => wrong.update(input(false, backward))),
    170,
  );

  // Reculer pour se dégager, ou être à l'arrêt face au mauvais sens, ne compte pas.
  const reversing = createRecovery(fakeTrack(() => distance));
  const backing = { velocity: { x: 0, y: 0, z: 5 } };
  const stopped = { rotation: FACING_BACK };
  for (let i = 0; i < 1200; i++) {
    assert.equal(reversing.update(input(false, backing)), false);
    assert.equal(reversing.update(input(false, stopped)), false);
  }

  // Le sens de la voiture est lu correctement sur le vrai tracé.
  const sim = createSimulation();
  const { rotation, position } = sim.track.startPose;
  const { tangent } = sim.track.nearest(position.x, position.z);
  const along = { x: tangent.x * 10, y: 0, z: tangent.z * 10 };
  const against = { x: -along.x, y: 0, z: -along.z };
  assert.equal(isWrongWay(rotation, along, tangent), false);
  const turned = {
    x: 0,
    y: rotation.w,
    z: 0,
    w: -rotation.y,
  };
  assert.equal(isWrongWay(turned, against, tangent), true);
  sim.free();
};

/** Sur une spéciale à terrain : sortie du couloir ou passage sous le sol, remise en piste sans attendre. */
const checkTerrainRecovery = (): void => {
  let ground: number | null = 0;
  const recovery = createRecovery(
    fakeTrack(() => 0),
    () => ground,
  );
  const atHeight = (y: number) => input(false, { position: { x: 0, y, z: 0 } });
  assert.equal(recovery.update(atHeight(0.5)), false, "posée sur le sol");
  assert.equal(recovery.update(atHeight(-0.5)), false, "caisse dans une bosse");
  assert.equal(recovery.update(atHeight(-1.5)), true, "passée sous le sol");
  assert.equal(recovery.status(), null);
  ground = null;
  assert.equal(recovery.update(atHeight(50)), true, "sortie du couloir");
};

/** Aucun objet léger ne bouge sans choc au chargement, même en pente, ni après une relance. */
const checkPropsOnStage = (name: string, stage: StageData): void => {
  const sim = createSimulation(carConfig, stage);
  const items = sim.scenery.filter((item) => isLightProp(item.kind));
  assert.ok(items.length > 0, `${name} : aucun objet léger`);
  const assertStill = (when: string): void => {
    let worst = 0;
    sim.props.poses().forEach((pose, i) => {
      const moved = Math.hypot(
        pose.position.x - items[i].position.x,
        pose.position.z - items[i].position.z,
      );
      worst = Math.max(worst, moved);
      assert.ok(
        moved < 0.3,
        `${name}, ${when} : ${items[i].kind} déplacé de ${moved} m sans choc`,
      );
      assert.ok(
        Math.abs(pose.rotation.x) + Math.abs(pose.rotation.z) < 0.2,
        `${name}, ${when} : ${items[i].kind} renversé sans choc`,
      );
    });
    console.log(
      `     ${name}, ${when} : ${items.length} objets légers, déplacement max ${worst.toFixed(3)} m`,
    );
  };
  for (let i = 0; i < 240; i++) sim.step(NEUTRAL_INPUT);
  assertStill("au chargement");
  sim.restart();
  for (let i = 0; i < 240; i++) sim.step(NEUTRAL_INPUT);
  assertStill("après relance");
  sim.free();
};

const checkRideHeight = (): void => {
  const sim = createSimulation();
  for (let i = 0; i < 240; i++) sim.step(NEUTRAL_INPUT);
  const settled = sim.state();
  const y = settled.position.y;
  const pointY = sim.track.nearest(settled.position.x, settled.position.z).point
    .y;
  assert.ok(
    Math.abs(y - pointY - carConfig.ride.height) < 0.02,
    `ride.height à recaler : ${(y - pointY).toFixed(3)}`,
  );
  const sag = settled.wheels.reduce((sum, wheel) => sum + wheel.offsetY, 0) / 4;
  assert.ok(
    Math.abs(sag - carConfig.ride.sag) < 0.02,
    `ride.sag à recaler : ${sag.toFixed(3)}`,
  );

  const start = sim.scenery.filter((item) => isLightProp(item.kind));
  sim.props.poses().forEach((pose, i) => {
    const moved = Math.hypot(
      pose.position.x - start[i].position.x,
      pose.position.z - start[i].position.z,
    );
    assert.ok(moved < 0.3, `${start[i].kind} déplacé de ${moved} m sans choc`);
    assert.ok(
      Math.abs(pose.rotation.x) + Math.abs(pose.rotation.z) < 0.2,
      `${start[i].kind} renversé sans choc`,
    );
  });

  sim.restart();
  for (let i = 0; i < 240; i++) sim.step(NEUTRAL_INPUT);
  sim.props.poses().forEach((pose, i) => {
    const moved = Math.hypot(
      pose.position.x - start[i].position.x,
      pose.position.z - start[i].position.z,
    );
    assert.ok(
      moved < 0.3,
      `${start[i].kind} déplacé après relance : ${moved} m`,
    );
  });

  // Remise en piste : aucune chute ni remontée brutale des roues.
  sim.respawn();
  const atOnce = sim.state();
  assert.ok(Math.abs(atOnce.wheels[0].offsetY - carConfig.ride.sag) < 1e-9);
  let peak = 0;
  for (let i = 0; i < 60; i++) {
    sim.step(NEUTRAL_INPUT);
    for (const wheel of sim.state().wheels)
      peak = Math.max(peak, wheel.offsetY);
  }
  assert.ok(peak < carConfig.ride.sag + 0.03, `pic de suspension : ${peak}`);
  assert.ok(sim.state().speed < 0.2);

  // L'entrée `respawn` passe bien par la simulation, et coûte 3 s de chrono.
  sim.restart();
  for (let i = 0; i < 180; i++)
    sim.step({ steer: 0.2, throttle: 1, brake: 0, handbrake: false });
  const before = sim.respawnCount();
  for (let i = 0; i < 179; i++) sim.step({ ...NEUTRAL_INPUT, respawn: true });
  assert.equal(sim.respawnCount(), before);
  sim.step({ ...NEUTRAL_INPUT, respawn: true });
  assert.equal(sim.respawnCount(), before + 1);
  assert.ok(
    (sim.lap.currentMs() ?? 0) >= 5900,
    "le chrono continue pendant le maintien",
  );
  sim.free();
};

const flatWorld = () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_DT;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(2000, 1, 2000).setTranslation(0, -1, 0),
  );
  return world;
};

const checkLightProps = (): void => {
  // Voiture à 60 km/h qui percute une botte puis un plot : elle continue, eux s'envolent.
  const world = flatWorld();
  const item = (kind: SceneryItem["kind"], z: number): SceneryItem => ({
    kind,
    position: { x: 0, y: 0, z },
    yaw: 0,
    scale: 1,
    colliderRadius: 0.5,
  });
  const props = createLightProps(world, [
    item("hay", -60),
    item("post", -90),
    item("sign", -110),
  ]);
  const vehicle = createVehicle(
    world,
    carConfig,
    {
      position: { x: 0, y: carConfig.ride.height, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    () => "asphalt",
  );
  world.step();
  props.rest();
  let reached = 0;
  for (let i = 0; i < 60 * 15 && vehicle.state().position.z > -140; i++) {
    const s = vehicle.state();
    reached = Math.max(reached, s.speed);
    vehicle.step(
      {
        steer: 0,
        throttle: s.speed < 60 / 3.6 ? 1 : 0,
        brake: 0,
        handbrake: false,
      },
      FIXED_DT,
    );
    world.step();
  }
  const end = vehicle.state();
  assert.ok(end.position.z <= -140, `voiture stoppée à z=${end.position.z}`);
  assert.ok(end.speed > 0.7 * (60 / 3.6), `vitesse après choc : ${end.speed}`);
  const [hay, post, sign] = props.poses();
  assert.ok(
    1 - Math.abs(hay.rotation.w) > 0.1,
    `la botte n'a pas roulé : w=${hay.rotation.w}`,
  );
  assert.ok(
    Math.hypot(sign.position.x, sign.position.z + 110) > 2,
    "panneau immobile",
  );
  assert.ok(
    Math.hypot(hay.position.x, hay.position.z + 60) > 2,
    "botte immobile",
  );
  assert.ok(
    Math.hypot(post.position.x, post.position.z + 90) > 2,
    "plot immobile",
  );

  props.reset();
  const [back] = props.poses();
  assert.equal(back.position.z, -60);
  world.free();
};

const checkUpsideDownRespawn = (): void => {
  const world = flatWorld();
  const vehicle = createVehicle(
    world,
    carConfig,
    {
      position: { x: 0, y: 1, z: 0 },
      // Sur le toit.
      rotation: { x: 0, y: 0, z: 1, w: 0 },
    },
    () => "asphalt",
  );
  // L'anti-tonneau redresse la caisse : on la remet en piste dès le premier pas, encore à l'envers.
  vehicle.step(NEUTRAL_INPUT, FIXED_DT);
  world.step();
  const upBefore =
    1 - 2 * (vehicle.state().rotation.x ** 2 + vehicle.state().rotation.z ** 2);
  assert.ok(upBefore < 0, "la voiture devait être sur le toit");
  vehicle.respawn({
    position: { x: 0, y: carConfig.ride.height, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  });
  for (let i = 0; i < 120; i++) {
    vehicle.step(NEUTRAL_INPUT, FIXED_DT);
    world.step();
  }
  const s = vehicle.state();
  assert.ok(1 - 2 * (s.rotation.x ** 2 + s.rotation.z ** 2) > 0.99);
  assert.ok(s.wheels.every((wheel) => wheel.inContact));
  world.free();
};

const checkRecorder = (): void => {
  const recorder = createInputRecorder();
  const inputs = [
    { ...NEUTRAL_INPUT },
    { ...NEUTRAL_INPUT, respawn: true },
    { ...NEUTRAL_INPUT, handbrake: true, respawn: true },
    { ...NEUTRAL_INPUT, handbrake: true },
  ];
  for (const input of inputs) recorder.record(input);
  const replay = replayInputs(recorder.frames());
  for (const input of inputs) assert.deepEqual(replay.next(), input);
};

const checkRumble = async (): Promise<void> => {
  // Glisse continue pendant 5 s à 60 images/s : très peu d'envois vers la manette.
  let calls = 0;
  let concurrent = 0;
  let maxConcurrent = 0;
  const pad = {
    vibrationActuator: {
      playEffect: async (): Promise<string> => {
        calls++;
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await Promise.resolve();
        concurrent--;
        return "complete";
      },
    },
  };
  Object.defineProperty(globalThis.navigator, "getGamepads", {
    configurable: true,
    value: () => [pad],
  });
  const state = {
    impact: 0,
    speed: 25,
    wheels: [{ inContact: true, slip: 0.8, surface: "asphalt" }],
  } as unknown as CarState;
  const start = 1_000_000;
  for (let frame = 0; frame < 300; frame++) {
    updateRumble(state, start + (frame * 1000) / 60);
    await Promise.resolve();
    await Promise.resolve();
  }
  Reflect.deleteProperty(globalThis.navigator, "getGamepads");
  assert.ok(calls >= 2, `vibration jamais envoyée : ${calls}`);
  // Un effet dure 300 ms : il faut le renouveler pour une vibration continue (62 envois avant la limite).
  assert.ok(calls <= 20, `trop d'envois : ${calls} en 5 s`);
  assert.equal(maxConcurrent, 1);
};

export default async function check(): Promise<void> {
  await initRapier();
  checkRecovery();
  checkTerrainRecovery();
  checkRideHeight();
  for (const fixture of ["road", "mountain"]) {
    const path = `public/stages/${fixture}.json`;
    if (existsSync(path))
      checkPropsOnStage(
        fixture,
        parseStage(JSON.parse(readFileSync(path, "utf8"))),
      );
  }
  checkLightProps();
  checkUpsideDownRespawn();
  checkRecorder();
  await checkRumble();
}
