import assert from "node:assert/strict";
import {
  buildCycle,
  cycleSpectrum,
  ENGINE_PRESETS,
} from "../../src/audio/enginePresets";
import { stepTurbine, turbineLevel } from "../../src/audio/engineVoice";
import {
  createDemo,
  createRevState,
  stepRev,
} from "../../src/app/labo-son/revSim";
import { carConfig } from "../../src/sim/carConfig";

const DT = 1 / 60;
const { idleRpm, redlineRpm } = carConfig.engine;

const checkCycle = (): void => {
  for (const preset of ENGINE_PRESETS) {
    const { real, imag } = cycleSpectrum(buildCycle(preset));
    const energy = (harmonic: number): number =>
      real[harmonic] ** 2 + imag[harmonic] ** 2;
    const firingOrder = preset.pulses.length;
    let strongest = 1;
    let subOrders = 0;
    for (let harmonic = 1; harmonic < real.length; harmonic++) {
      if (energy(harmonic) > energy(strongest)) strongest = harmonic;
      if (harmonic < firingOrder) subOrders += energy(harmonic);
    }
    assert.equal(
      strongest % firingOrder,
      0,
      `${preset.id} : le rythme des explosions doit dominer (harmonique ${strongest})`,
    );
    // Sans écart entre cylindres, ces harmoniques seraient nulles et le son redeviendrait parfaitement régulier.
    assert.ok(subOrders > 1e-6, `${preset.id} : cylindres trop réguliers`);
  }
};

const checkRev = (): void => {
  const rev = createRevState();
  for (let i = 0; i < 60 * 8; i++) {
    stepRev(rev, 1, 2, DT);
    assert.ok(rev.rpm <= redlineRpm);
  }
  assert.ok(rev.rpm > redlineRpm * 0.9, "le gaz doit amener au rupteur");
  let cuts = 0;
  for (let i = 0; i < 60; i++) {
    stepRev(rev, 1, 2, DT);
    if (rev.throttle === 0) cuts++;
  }
  assert.ok(cuts > 0, "le rupteur doit couper la charge");

  const before = rev.rpm;
  for (let i = 0; i < 30; i++) stepRev(rev, 0, 2, DT);
  assert.ok(rev.rpm < before, "le frein moteur doit faire baisser le régime");
  for (let i = 0; i < 60 * 8; i++) stepRev(rev, 0, 2, DT);
  assert.equal(rev.rpm, idleRpm);
};

const checkDemo = (): void => {
  const rev = createRevState();
  const demo = createDemo();
  const gears = new Set<number>();
  let frames = 0;
  while (demo.step(rev, DT)) {
    gears.add(rev.gear);
    assert.ok(++frames < 60 * 60, "la démo doit se terminer");
  }
  assert.ok(gears.has(4), "la démo doit monter les rapports");
  assert.equal(rev.gear, 0);
};

const checkTurbine = (): void => {
  const spoolS = 0.45;
  const turbine = { spin: 0, surge: 0 };
  const run = (seconds: number, load: number): void => {
    for (let i = 0; i < seconds * 30; i++)
      stepTurbine(turbine, spoolS, load, 6000, 1 / 30);
  };
  // Le pic s'entend à la montée en régime, puis le pied au plancher ne laisse qu'un fond discret.
  let peak = 0;
  for (let i = 0; i < 30; i++) {
    run(1 / 30, 1);
    peak = Math.max(peak, turbineLevel(turbine));
  }
  run(5, 1);
  const sustained = turbineLevel(turbine);
  assert.ok(turbine.spin > 0.99, `turbine : ${turbine.spin}`);
  assert.ok(sustained < peak * 0.6, `fond ${sustained}, pic ${peak}`);

  // Un passage de rapport ne fait presque pas retomber la turbine, ni remonter le sifflement.
  run(0.12, 0);
  assert.ok(turbine.spin > 0.9, `après le passage : ${turbine.spin}`);
  let afterShift = 0;
  for (let i = 0; i < 30; i++) {
    run(1 / 30, 1);
    afterShift = Math.max(afterShift, turbineLevel(turbine));
  }
  assert.ok(afterShift < peak, `reprise ${afterShift}, pic ${peak}`);

  // Sous le régime utile, le turbo ne tourne pas.
  const idle = { spin: 0, surge: 0 };
  stepTurbine(idle, spoolS, 1, 1500, 1 / 30);
  assert.equal(idle.spin, 0);
};

export default function check(): void {
  checkTurbine();
  checkCycle();
  checkRev();
  checkDemo();
}
