import assert from "node:assert/strict";
import { carConfig, type CarConfig } from "../../src/sim/carConfig";
import { runDeterminismProbe } from "../../src/sim/determinismProbe";
import { FIXED_DT } from "../../src/sim/fixedStep";
import { initRapier, RAPIER } from "../../src/sim/rapier";
import type { CarInput, CarState, Surface, Vec3 } from "../../src/sim/types";
import { createVehicle, type Vehicle } from "../../src/sim/vehicle";

const DEG = 180 / Math.PI;

const quatRotate = (q: CarState["rotation"], v: Vec3): Vec3 => {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + q.y * tz - q.z * ty,
    y: v.y + q.w * ty + q.z * tx - q.x * tz,
    z: v.z + q.w * tz + q.x * ty - q.y * tx,
  };
};

interface Probe {
  vehicle: Vehicle;
  /** Déroule `seconds` secondes ; `input` reçoit le temps écoulé et l'état courant. */
  run: (
    seconds: number,
    input: (t: number, s: CarState) => Partial<CarInput>,
    each?: (s: CarState, t: number) => void,
  ) => CarState;
  dispose: () => void;
}

const makeProbe = (
  surface: Surface = "asphalt",
  config: CarConfig = carConfig,
): Probe => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_DT;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(5000, 0.5, 5000).setTranslation(0, -0.5, 0),
  );
  const vehicle = createVehicle(
    world,
    config,
    { position: { x: 0, y: 0.75, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
    () => surface,
  );
  const run: Probe["run"] = (seconds, input, each) => {
    let s = vehicle.state();
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++) {
      const t = i / 60;
      vehicle.step(
        { steer: 0, throttle: 0, brake: 0, handbrake: false, ...input(t, s) },
        FIXED_DT,
      );
      world.step();
      s = vehicle.state();
      each?.(s, t);
    }
    return s;
  };
  // Laisse la voiture se poser sur ses roues.
  run(1.5, () => ({}));
  return { vehicle, run, dispose: () => world.free() };
};

const forwardOf = (s: CarState): Vec3 =>
  quatRotate(s.rotation, { x: 0, y: 0, z: -1 });
const rightOf = (s: CarState): Vec3 =>
  quatRotate(s.rotation, { x: 1, y: 0, z: 0 });
const upOf = (s: CarState): Vec3 =>
  quatRotate(s.rotation, { x: 0, y: 1, z: 0 });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
/** Tangage en degrés, positif = nez vers le bas. */
const pitchOf = (s: CarState): number => -Math.asin(forwardOf(s).y) * DEG;
/** Roulis en degrés, positif = côté droit vers le bas. */
const rollOf = (s: CarState): number => -Math.asin(rightOf(s).y) * DEG;
/** Dérive signée en degrés, positive = la voiture glisse vers sa droite. */
const driftOf = (s: CarState): number =>
  Math.atan2(
    dot(s.linearVelocity, rightOf(s)),
    Math.abs(dot(s.linearVelocity, forwardOf(s))),
  ) * DEG;
/** Vitesse de lacet approchée par différence finie de cap. */
const headingOf = (s: CarState): number => {
  const f = forwardOf(s);
  return Math.atan2(f.x, -f.z);
};

export interface VehicleMeasures {
  zeroTo100: number;
  topSpeedKmh: number;
  handbrakeDrift: number;
  recoverDrift: number;
  liftOffDrift: number;
  brakeDive: number;
  cornerRoll: number;
  grassTop: number;
  flickDrift: number;
  wallImpact: number;
  asphaltTop: number;
}

const measures: Partial<VehicleMeasures> = {};

export default async function check(): Promise<void> {
  await initRapier();

  // --- Convention : gaz vers -Z, steer +1 vers la droite (+X), rapports et régime qui montent.
  {
    const p = makeProbe();
    const start = p.vehicle.state().position;
    assert.ok(Math.abs(start.y - 0.71) < 0.1, `hauteur posée ${start.y}`);
    const s = p.run(3, () => ({ throttle: 1 }));
    assert.ok(s.position.z < start.z - 5, `gaz : z = ${s.position.z}`);
    assert.ok(
      Math.abs(s.position.x) < 0.05,
      `ligne droite : x = ${s.position.x}`,
    );
    assert.ok(s.forwardSpeed > 5, `forwardSpeed = ${s.forwardSpeed}`);
    assert.ok(s.gear >= 1 && s.rpm > carConfig.engine.idleRpm);
    assert.ok(s.wheels[0].spinAngle > 1, "la roue tourne en marche avant");
    const turned = p.run(2, () => ({ throttle: 0.4, steer: 1 }));
    assert.ok(turned.position.x > 1, `steer +1 : x = ${turned.position.x}`);
    assert.ok(
      turned.wheels[0].steerAngle > 0 && turned.wheels[2].steerAngle === 0,
    );
    p.dispose();
  }

  // --- Marche arrière : le frein à l'arrêt recule ; les gaz ramènent en marche avant.
  {
    const p = makeProbe();
    const s = p.run(3, () => ({ brake: 1 }));
    assert.equal(s.gear, -1);
    assert.ok(s.forwardSpeed < -3, `recul : ${s.forwardSpeed}`);
    assert.ok(s.position.z > 2, `recule vers +Z : ${s.position.z}`);
    const back = p.run(3, () => ({ throttle: 1 }));
    assert.equal(back.gear > 0, true);
    assert.ok(back.forwardSpeed > 0);
    p.dispose();
  }

  // --- 0-100 km/h et vitesse de pointe, ligne droite sans décoller ni osciller.
  {
    const p = makeProbe();
    let t100 = -1;
    const samples: number[] = [];
    let minContacts = 4;
    const end = p.run(
      45,
      () => ({ throttle: 1 }),
      (s, t) => {
        if (t100 < 0 && s.speed >= 100 / 3.6) t100 = t;
        if (t > 1)
          minContacts = Math.min(
            minContacts,
            s.wheels.filter((w) => w.inContact).length,
          );
        if (t > 40) samples.push(s.position.y);
      },
    );
    const top = end.speed * 3.6;
    measures.zeroTo100 = t100;
    measures.topSpeedKmh = top;
    assert.ok(t100 >= 5 && t100 <= 9, `0-100 km/h = ${t100.toFixed(2)} s`);
    assert.ok(top >= 150 && top <= 190, `vitesse max = ${top.toFixed(1)} km/h`);
    assert.equal(minContacts, 4, "les quatre roues restent au sol");
    const yMin = Math.min(...samples);
    const yMax = Math.max(...samples);
    assert.ok(
      yMax - yMin < 0.005,
      `oscillation verticale ${(yMax - yMin).toFixed(4)} m`,
    );
    p.dispose();
  }

  // --- Plongée au freinage et cabrage à l'accélération, roulis en virage.
  {
    const p = makeProbe();
    p.run(5, () => ({ throttle: 1 }));
    const flat = pitchOf(p.vehicle.state());
    let dive = 0;
    const stopped = p.run(
      3,
      () => ({ brake: 1 }),
      (s) => {
        dive = Math.max(dive, pitchOf(s) - flat);
      },
    );
    measures.brakeDive = dive;
    assert.ok(dive > 0.8, `plongée au freinage = ${dive.toFixed(2)}°`);
    assert.ok(stopped.speed < 25, "le frein ralentit");
    p.dispose();

    const q = makeProbe();
    q.run(5, () => ({ throttle: 1 }));
    let rollRight = 0;
    q.run(
      2,
      () => ({ throttle: 0.5, steer: 0.8 }),
      (s) => {
        rollRight = Math.max(rollRight, -rollOf(s));
      },
    );
    measures.cornerRoll = rollRight;
    assert.ok(
      rollRight > 0.8,
      `roulis en virage à droite = ${rollRight.toFixed(2)}°`,
    );
    q.dispose();
  }

  // --- Pas de tonneau à pleine vitesse sur braquage sec, des deux côtés.
  for (const steer of [1, -1]) {
    const p = makeProbe();
    p.run(30, () => ({ throttle: 1 }));
    let minUp = 1;
    const end = p.run(
      6,
      (t) => ({ throttle: 1, steer: t < 3 ? steer : -steer }),
      (s) => {
        minUp = Math.min(minUp, upOf(s).y);
      },
    );
    assert.ok(
      minUp > 0.7,
      `tonneau, steer ${steer} : up.y min = ${minUp.toFixed(2)}`,
    );
    assert.ok(end.speed > 0);
    p.dispose();
  }

  // --- Frein à main à 60 km/h : dérive nette, puis rattrapage au contre-braquage, sans toupie.
  for (const dir of [1, -1]) {
    const p = makeProbe();
    p.run(20, (_, s) =>
      s.speed < 60 / 3.6 ? { throttle: 1 } : { brake: 0.3 },
    );
    const cruise = p.vehicle.state();
    assert.ok(
      Math.abs(cruise.speed * 3.6 - 60) < 8,
      `vitesse d'approche ${cruise.speed * 3.6}`,
    );
    let peak = 0;
    const startHeading = headingOf(cruise);
    p.run(
      0.7,
      () => ({ steer: dir * 0.7, handbrake: true }),
      (s) => {
        peak = Math.max(peak, Math.abs(driftOf(s)));
      },
    );
    p.run(
      0.8,
      (_, s) => ({
        steer: Math.max(-1, Math.min(1, driftOf(s) / 25)),
        throttle: 0.4,
      }),
      (s) => {
        peak = Math.max(peak, Math.abs(driftOf(s)));
      },
    );
    if (dir === 1) measures.handbrakeDrift = peak;
    assert.ok(peak > 15, `dérive frein à main ${dir} = ${peak.toFixed(1)}°`);
    assert.ok(peak < 75, `toupie ${dir} : ${peak.toFixed(1)}°`);
    // Contre-braquage scripté : on tourne les roues vers la vitesse, la dérive doit retomber.
    const end = p.run(3, (_, s) => ({
      steer: Math.max(-1, Math.min(1, driftOf(s) / 25)),
      throttle: 0.5,
    }));
    const recovered = Math.abs(driftOf(end));
    if (dir === 1) measures.recoverDrift = recovered;
    assert.ok(
      recovered < 8,
      `rattrapage ${dir} : reste ${recovered.toFixed(1)}°`,
    );
    assert.ok(
      end.forwardSpeed > 5,
      `repart vers l'avant : ${end.forwardSpeed}`,
    );
    assert.ok(Math.abs(headingOf(end) - startHeading) < Math.PI * 1.5);
    p.dispose();
  }

  // --- Lever de pied en virage à vitesse soutenue : la voiture décroche un peu, pas de toupie.
  {
    const p = makeProbe();
    p.run(20, (_, s) =>
      s.speed < 90 / 3.6 ? { throttle: 1 } : { brake: 0.2 },
    );
    let peak = 0;
    p.run(
      1,
      () => ({ throttle: 1, steer: 1 }),
      (s) => {
        peak = Math.max(peak, Math.abs(driftOf(s)));
      },
    );
    p.run(
      1,
      () => ({ throttle: 0, steer: 1 }),
      (s) => {
        peak = Math.max(peak, Math.abs(driftOf(s)));
      },
    );
    measures.liftOffDrift = peak;
    assert.ok(peak > 10 && peak < 75, `lever de pied : ${peak.toFixed(1)}°`);
    p.dispose();
  }

  // --- Herbe : moins d'adhérence, plus lente.
  {
    const asphalt = makeProbe("asphalt");
    const grass = makeProbe("grass");
    const a = asphalt.run(10, () => ({ throttle: 1 }));
    const g = grass.run(10, () => ({ throttle: 1 }));
    measures.asphaltTop = a.speed * 3.6;
    measures.grassTop = g.speed * 3.6;
    assert.equal(g.wheels[0].surface, "grass");
    assert.ok(
      g.speed < a.speed * 0.9,
      `herbe ${g.speed} contre asphalte ${a.speed}`,
    );
    // Même virage : l'herbe dérive plus.
    const cornerDrift = (p: Probe): number => {
      let peak = 0;
      p.run(
        2,
        () => ({ throttle: 0.5, steer: 1 }),
        (s) => {
          peak = Math.max(peak, Math.abs(driftOf(s)));
        },
      );
      return peak;
    };
    const da = cornerDrift(asphalt);
    const dg = cornerDrift(grass);
    assert.ok(
      dg > da,
      `dérive herbe ${dg.toFixed(1)}° contre asphalte ${da.toFixed(1)}°`,
    );
    asphalt.dispose();
    grass.dispose();
  }

  // --- À l'arrêt : ne rampe pas et ne tremble pas.
  {
    const p = makeProbe();
    const before = p.vehicle.state().position;
    const heights: number[] = [];
    const rest = p.run(
      5,
      () => ({}),
      (st) => heights.push(st.position.y),
    );
    const moved = Math.hypot(rest.position.x - before.x, rest.position.z - before.z);
    assert.ok(moved < 0.01, `dérive à l'arrêt : ${moved} m`);
    // Vitesse lue après world.step : la gravité du pas (0,16 m/s) y figure encore, seul l'horizontal compte ici.
    const flat = Math.hypot(rest.linearVelocity.x, rest.linearVelocity.z);
    assert.ok(flat < 0.01, `vitesse à l'arrêt : ${flat}`);
    const tail = heights.slice(-60);
    assert.ok(Math.max(...tail) - Math.min(...tail) < 0.001, 'tremblement vertical');
    p.dispose();
  }

  // --- Braquage inversé à pleine vitesse : glisse, mais ni tête-à-queue ni tonneau, puis la voiture se reprend.
  {
    const p = makeProbe();
    p.run(30, () => ({ throttle: 1 }));
    let peak = 0;
    p.run(
      5,
      (t) => ({ throttle: 1, steer: Math.floor(t) % 2 === 0 ? 1 : -1 }),
      (s) => {
        peak = Math.max(peak, Math.abs(driftOf(s)));
      },
    );
    assert.ok(peak < 75, `inversions à pleine vitesse : ${peak.toFixed(1)}°`);
    const end = p.run(3, () => ({ throttle: 0.5 }));
    assert.ok(Math.abs(driftOf(end)) < 5, `reprise : ${driftOf(end).toFixed(1)}°`);
    measures.flickDrift = peak;
    p.dispose();
  }

  // --- Choc de caisse : silencieux au roulage, net contre un mur, retombe vite.
  {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = FIXED_DT;
    world.createCollider(RAPIER.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(0, -0.5, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(10, 3, 0.5).setTranslation(0, 3, -40));
    const vehicle = createVehicle(
      world,
      carConfig,
      { position: { x: 0, y: 0.75, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      () => "asphalt",
    );
    let quiet = 0;
    let peak = 0;
    let frameOfPeak = 0;
    let after = 1;
    for (let i = 0; i < 60 * 9; i++) {
      vehicle.step({ steer: 0, throttle: 1, brake: 0, handbrake: false }, FIXED_DT);
      world.step();
      const { impact, position } = vehicle.state();
      if (position.z > -30 && i > 60) quiet = Math.max(quiet, impact);
      if (impact > peak) {
        peak = impact;
        frameOfPeak = i;
      }
      if (peak > 0 && i === frameOfPeak + 60) after = impact;
    }
    assert.ok(quiet < 0.05, `impact au roulage ${quiet}`);
    assert.ok(peak > 0.3, `impact contre le mur ${peak}`);
    assert.ok(after < peak * 0.1, `impact après 1 s : ${after} pour un pic de ${peak}`);
    measures.wallImpact = peak;
    vehicle.free();
    world.free();
  }

  // --- Respawn et changement de réglages à chaud.
  {
    const p = makeProbe();
    p.run(3, () => ({ throttle: 1, steer: 0.5 }));
    p.vehicle.respawn({ position: { x: 5, y: 0.75, z: 5 }, rotation: { x: 0, y: 0, z: 0, w: 1 } });
    const back = p.vehicle.state();
    assert.equal(back.position.x, 5);
    assert.equal(back.speed, 0);
    assert.equal(back.gear, 1);
    const settled = p.run(1, () => ({}));
    assert.ok(settled.speed < 0.5, `après respawn : ${settled.speed}`);
    p.vehicle.applyConfig({ ...carConfig, mass: 1400 });
    const heavier = p.run(2, () => ({ throttle: 1 }));
    assert.ok(heavier.forwardSpeed > 1 && heavier.wheels.every((w) => w.inContact));
    p.dispose();
  }

  // --- Déterminisme : deux exécutions, même empreinte.
  const a = await runDeterminismProbe();
  const b = await runDeterminismProbe();
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{16}$/);

  console.log("mesures véhicule", { empreinte: a, ...measures });
}
