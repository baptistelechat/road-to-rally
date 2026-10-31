// Sonde de déterminisme : mêmes entrées scriptées, même empreinte attendue dans Node et dans le navigateur.
import { carConfig } from "./carConfig";
import { FIXED_DT } from "./fixedStep";
import { initRapier, RAPIER } from "./rapier";
import type { CarInput } from "./types";
import { createVehicle } from "./vehicle";

const PROBE_SECONDS = 60;

/** Durée en secondes, puis entrées. Le script boucle jusqu'à 60 s. */
const SCRIPT: readonly (readonly [number, CarInput])[] = [
  [4, { steer: 0, throttle: 1, brake: 0, handbrake: false }],
  [1.5, { steer: 0.7, throttle: 0.6, brake: 0, handbrake: false }],
  [0.6, { steer: -0.5, throttle: 0, brake: 0, handbrake: true }],
  [1.2, { steer: 0.8, throttle: 0.4, brake: 0, handbrake: false }],
  [2, { steer: -1, throttle: 1, brake: 0, handbrake: false }],
  [1.5, { steer: 0, throttle: 0, brake: 1, handbrake: false }],
  [1.5, { steer: 0.3, throttle: 0, brake: 1, handbrake: false }],
  [1, { steer: -0.2, throttle: 0, brake: 0, handbrake: false }],
];

const inputAt = (time: number): CarInput => {
  const total = SCRIPT.reduce((sum, [duration]) => sum + duration, 0);
  let t = time % total;
  for (const [duration, input] of SCRIPT) {
    if (t < duration) return input;
    t -= duration;
  }
  return SCRIPT[0][1];
};

/** Empreinte des octets IEEE 754 : FNV-1a 32 bits passé deux fois, avec deux graines. */
const fingerprint = (values: number[]): string => {
  const bytes = new Uint8Array(new Float64Array(values).buffer);
  const hashes = [0x811c9dc5, 0x1b873593].map((seed) => {
    let hash = seed;
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193);
    return (hash >>> 0).toString(16).padStart(8, "0");
  });
  return hashes.join("");
};

export const runDeterminismProbe = async (): Promise<string> => {
  await initRapier();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_DT;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(5000, 0.5, 5000).setTranslation(0, -0.5, 0),
  );
  const vehicle = createVehicle(
    world,
    carConfig,
    { position: { x: 0, y: 0.75, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
    () => "asphalt",
  );
  const steps = PROBE_SECONDS * 60;
  for (let i = 0; i < steps; i++) {
    vehicle.step(inputAt(i / 60), FIXED_DT);
    world.step();
  }
  const {
    position: p,
    rotation: r,
    linearVelocity: v,
    rpm,
    gear,
  } = vehicle.state();
  vehicle.free();
  world.free();
  return fingerprint([
    p.x,
    p.y,
    p.z,
    r.x,
    r.y,
    r.z,
    r.w,
    v.x,
    v.y,
    v.z,
    rpm,
    gear,
  ]);
};
