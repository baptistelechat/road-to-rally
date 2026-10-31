// Voiture : les raycasts de Rapier portent la suspension, nos propres pneus (courbe de glissement) portent la caisse.
// Le pneu du contrôleur n'a pas de courbe : ses essais à 60 km/h passaient de l'adhérence à la toupie sans glisse progressive.
//
// Déterminisme : uniquement + - * / et Math.sqrt, exacts au bit près selon IEEE 754.
// Math.sin, atan2, exp ou hypot ne sont pas garantis identiques d'un moteur JS à l'autre.
import { RAPIER } from "./rapier";
import { WHEEL_RAY_GROUPS } from "./lightProps";
import { type CarConfig, wheelAxle } from "./carConfig";
import {
  type CarInput,
  type CarState,
  type Pose,
  type Surface,
  type Vec3,
  WHEEL_COUNT,
} from "./types";

export interface Vehicle {
  /** À appeler une fois par pas, AVANT world.step() */
  step: (input: CarInput, dt: number) => void;
  /** État après le dernier world.step() */
  state: () => CarState;
  respawn: (pose: Pose) => void;
  applyConfig: (config: CarConfig) => void;
  free: () => void;
}

const HALF_PI = 1.5707963267948966;
const TWO_PI = 6.283185307179586;
const RAD_S_TO_RPM = 60 / TWO_PI;
// Sous cette vitesse, l'angle de dérive n'a plus de sens : le dénominateur est borné.
const SLIP_MIN_SPEED = 1;
// Seuil de sinus (environ 10°) sous lequel l'aide au redressement laisse vivre le roulis et le tangage.
const ANTI_ROLL_FREE_TILT = 0.17;
const ANTI_ROLL_GAIN = 120;
const YAW_LIMIT_GAIN = 0.25;
const RPM_RESPONSE = 12;
const LIFT_GRIP_RATE = 1.5;
const IMPACT_DEADZONE = 1;
const IMPACT_FULL = 10;
const IMPACT_DECAY = 7;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const scale = (a: Vec3, k: number): Vec3 => ({
  x: a.x * k,
  y: a.y * k,
  z: a.z * k,
});
const addScaled = (a: Vec3, b: Vec3, k: number): Vec3 => ({
  x: a.x + b.x * k,
  y: a.y + b.y * k,
  z: a.z + b.z * k,
});
const length = (a: Vec3): number => Math.sqrt(dot(a, a));
const normalized = (a: Vec3): Vec3 => {
  const l = length(a);
  return l > 1e-9 ? scale(a, 1 / l) : { x: 0, y: 0, z: 0 };
};

const rotate = (q: Pose["rotation"], v: Vec3): Vec3 => {
  const t = scale(cross(q, v), 2);
  return addScaled(addScaled(v, t, q.w), cross(q, t), 1);
};

/** atan(z) pour z >= 0, à 0,004 rad près. */
const atanPositive = (z: number): number =>
  z <= 1
    ? z * (0.7853981633974483 + 0.273 * (1 - z))
    : HALF_PI - atanPositive(1 / z);

/** Angle entre (y, x) signé par y, x >= 0. */
const signedAngle = (y: number, x: number): number =>
  Math.sign(y) * atanPositive(Math.abs(y) / Math.max(x, 1e-6));

/** Adhérence normalisée selon l'angle de dérive : monte jusqu'au pic, retombe vers le plateau de glisse. */
const tireCurve = (alpha: number, tires: CarConfig["tires"]): number => {
  if (alpha < tires.peakSlipAngle) {
    const x = alpha / tires.peakSlipAngle;
    return x * (1.5 - 0.5 * x * x);
  }
  const t = clamp(
    (alpha - tires.peakSlipAngle) /
      (tires.slideSlipAngle - tires.peakSlipAngle),
    0,
    1,
  );
  return lerp(1, tires.slideGripRatio, t);
};

interface WheelRuntime {
  spinAngle: number;
  surface: Surface;
  slip: number;
}

export const createVehicle = (
  world: RAPIER.World,
  config: CarConfig,
  spawn: Pose,
  surfaceAt: (x: number, z: number) => Surface,
): Vehicle => {
  let cfg = config;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.position.x, spawn.position.y, spawn.position.z)
      .setRotation(spawn.rotation)
      .setCanSleep(false)
      .setCcdEnabled(true),
  );
  // Toute la masse passe par les propriétés additionnelles : le collider ne sert qu'aux chocs.
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      cfg.bodyHalfExtents.x,
      cfg.bodyHalfExtents.y,
      cfg.bodyHalfExtents.z,
    )
      .setDensity(0)
      .setFriction(0.3)
      .setRestitution(0.1),
    body,
  );
  const controller = world.createVehicleController(body);
  // Avant local = -Z : le contrôleur calcule avant = normale × essieu, donc l'essieu est +X.
  controller.indexUpAxis = 1;
  controller.setIndexForwardAxis = 2;
  for (let i = 0; i < WHEEL_COUNT; i++) {
    controller.addWheel(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 1, y: 0, z: 0 },
      1,
      1,
    );
  }

  const wheels: WheelRuntime[] = Array.from({ length: WHEEL_COUNT }, () => ({
    spinAngle: 0,
    surface: "asphalt" as Surface,
    slip: 0,
  }));
  let steerAngle = 0;
  let gear = 1;
  let rpm = cfg.engine.idleRpm;
  let shiftTimer = 0;
  let throttle = 0;
  let brake = 0;
  let handbrake = false;
  let impact = 0;
  let rearLiftGrip = 1;
  let velocityBeforeWorldStep: Vec3 | null = null;
  // Après une remise en piste, la suspension n'a pas encore été recalculée : on affiche l'assiette de repos.
  let justReset = false;
  let yawInertia = 1;
  let rollInertia = 1;

  const apply = (next: CarConfig): void => {
    cfg = next;
    const { x: hx, y: hy, z: hz } = cfg.bodyHalfExtents;
    const m = cfg.mass;
    // Inertie d'un pavé plein.
    const inertia = {
      x: (m / 3) * (hy * hy + hz * hz),
      y: (m / 3) * (hx * hx + hz * hz) * cfg.yawInertiaScale,
      z: (m / 3) * (hx * hx + hy * hy),
    };
    yawInertia = inertia.y;
    rollInertia = inertia.z;
    body.setAdditionalMassProperties(
      m,
      { x: 0, y: cfg.centerOfMassY, z: 0 },
      inertia,
      { x: 0, y: 0, z: 0, w: 1 },
      true,
    );
    collider.setHalfExtents({ x: hx, y: hy, z: hz });
    for (let i = 0; i < WHEEL_COUNT; i++) {
      const axle = wheelAxle(cfg, i);
      const side = i % 2 === 0 ? -1 : 1;
      controller.setWheelChassisConnectionPointCs(i, {
        x: side * axle.halfTrack,
        y: axle.attachY,
        z: axle.z,
      });
      controller.setWheelSuspensionRestLength(i, axle.suspensionRestLength);
      controller.setWheelRadius(i, axle.wheelRadius);
      controller.setWheelMaxSuspensionTravel(i, axle.suspensionTravel);
      controller.setWheelSuspensionStiffness(i, axle.suspensionStiffness);
      controller.setWheelSuspensionCompression(i, axle.dampingCompression);
      controller.setWheelSuspensionRelaxation(i, axle.dampingRelaxation);
      controller.setWheelMaxSuspensionForce(i, cfg.maxSuspensionForce);
      // Le contrôleur ne porte plus aucune force de pneu, voir `applyTires`.
      controller.setWheelFrictionSlip(i, 0);
      controller.setWheelSideFrictionStiffness(i, 0);
      controller.setWheelEngineForce(i, 0);
      controller.setWheelBrake(i, 0);
    }
  };

  const reset = (pose: Pose): void => {
    body.setTranslation(pose.position, true);
    body.setRotation(pose.rotation, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    steerAngle = 0;
    gear = 1;
    rpm = cfg.engine.idleRpm;
    shiftTimer = 0;
    impact = 0;
    rearLiftGrip = 1;
    velocityBeforeWorldStep = null;
    justReset = true;
  };

  /** Mesure le choc de caisse : ce que world.step() a changé à la vitesse, hors gravité. */
  const settleImpact = (): void => {
    if (!velocityBeforeWorldStep) return;
    const v = body.linvel();
    const g = world.gravity;
    const t = world.timestep;
    const change = length({
      x: v.x - velocityBeforeWorldStep.x - g.x * t,
      y: v.y - velocityBeforeWorldStep.y - g.y * t,
      z: v.z - velocityBeforeWorldStep.z - g.z * t,
    });
    velocityBeforeWorldStep = null;
    impact = Math.max(
      impact,
      clamp((change - IMPACT_DEADZONE) / (IMPACT_FULL - IMPACT_DEADZONE), 0, 1),
    );
  };

  const updateTransmission = (
    forwardSpeed: number,
    grounded: boolean,
    dt: number,
  ): number => {
    const engine = cfg.engine;
    if (gear > 0 && brake > 0 && throttle === 0 && forwardSpeed < 0.5)
      gear = -1;
    else if (gear < 0 && throttle > 0 && forwardSpeed > -0.5) gear = 1;

    const ratio = gear > 0 ? engine.gears[gear - 1] : engine.reverseGear;
    const radius = cfg.rear.wheelRadius;
    const shaftRpm =
      (Math.abs(forwardSpeed) / radius) *
      ratio *
      engine.finalDrive *
      RAD_S_TO_RPM;

    if (gear > 0) {
      if (shaftRpm > engine.upshiftRpm && gear < engine.gears.length) {
        gear++;
        shiftTimer = engine.shiftTimeS;
      } else if (shaftRpm < engine.downshiftRpm && gear > 1) {
        gear--;
        shiftTimer = engine.shiftTimeS;
      }
    }
    shiftTimer = Math.max(0, shiftTimer - dt);

    const pedal = gear > 0 ? throttle : brake;
    // Embrayage qui patine au démarrage, moteur libre en l'air.
    const floorRpm = engine.idleRpm + pedal * engine.launchRpm;
    const targetRpm = grounded
      ? Math.max(shaftRpm, floorRpm)
      : engine.idleRpm + pedal * (engine.redlineRpm - engine.idleRpm);
    rpm +=
      (clamp(targetRpm, engine.idleRpm, engine.redlineRpm) - rpm) *
      Math.min(1, RPM_RESPONSE * dt);

    if (shiftTimer > 0 || shaftRpm >= engine.redlineRpm) return 0;
    if (gear < 0)
      return forwardSpeed < -cfg.engine.reverseMaxSpeed
        ? 0
        : -pedal * engine.maxForce * (ratio / engine.gears[0]);
    return pedal * engine.maxForce * (ratio / engine.gears[0]);
  };

  const updateSteering = (
    steerInput: number,
    forwardSpeed: number,
    driftAngle: number,
    dt: number,
  ): void => {
    const steering = cfg.steering;
    // Au-delà de cet angle, l'avant décroche et la voiture tire tout droit : on braque seulement ce qui sert.
    const wheelbase = cfg.rear.z - cfg.front.z;
    const speed2 = Math.max(forwardSpeed * forwardSpeed, 1);
    const reachable = Math.min(
      steering.maxAngle,
      steering.minAngleAtSpeed + (wheelbase * steering.gripAccel) / speed2,
    );
    // Le contre-braquage assisté suit la vitesse, y compris au-delà de la limite liée à la vitesse.
    const target = clamp(
      steerInput * reachable + cfg.assists.counterSteer * driftAngle,
      -steering.maxAngle,
      steering.maxAngle,
    );
    const maxDelta = steering.rate * dt;
    steerAngle += clamp(target - steerAngle, -maxDelta, maxDelta);
  };

  const applyTires = (
    driveForce: number,
    up: Vec3,
    forward: Vec3,
    right: Vec3,
    dt: number,
  ): void => {
    // sin et cos de l'angle de braquage, limité à moins de 0,7 rad : Taylor suffit.
    const s2 = steerAngle * steerAngle;
    const sinSteer = steerAngle * (1 - (s2 / 6) * (1 - s2 / 20));
    const cosSteer = 1 - (s2 / 2) * (1 - s2 / 12);
    const com = body.worldCom();
    const impulses: { force: Vec3; at: Vec3 }[] = [];

    for (let i = 0; i < WHEEL_COUNT; i++) {
      const axle = wheelAxle(cfg, i);
      const isFront = i < 2;
      const wheel = wheels[i];
      const contact = controller.wheelIsInContact(i)
        ? controller.wheelContactPoint(i)
        : null;
      const normal = contact ? controller.wheelContactNormal(i) : null;
      const load = controller.wheelSuspensionForce(i) ?? 0;
      const locked = !isFront && handbrake;

      if (!contact || !normal) {
        wheel.slip = 0;
        const free = dot(body.linvel(), forward);
        wheel.spinAngle += locked ? 0 : (free / axle.wheelRadius) * dt;
        continue;
      }
      wheel.surface = surfaceAt(contact.x, contact.z);
      const surface = cfg.surfaces[wheel.surface];

      const wheelForward = isFront
        ? addScaled(scale(forward, cosSteer), right, sinSteer)
        : forward;
      const groundForward = normalized(
        addScaled(wheelForward, normal, -dot(wheelForward, normal)),
      );
      const groundRight = cross(groundForward, normal);
      const velocity = body.velocityAtPoint(contact);
      const vLong = dot(velocity, groundForward);
      const vLat = dot(velocity, groundRight);

      // Longitudinal : moteur + ce qui s'oppose au roulement, sans pouvoir inverser le sens de marche.
      let resist = surface.rollingResistance / WHEEL_COUNT;
      if (gear > 0 && vLong > 0.5 && throttle === 0)
        resist += cfg.engine.engineBrake / WHEEL_COUNT;
      const wheelBrake = gear > 0 ? brake : throttle;
      resist += wheelBrake * cfg.brakes.maxForce * axle.brakeShare * 0.5;
      if (locked) resist += cfg.brakes.handbrakeForce * 0.5;
      const stopCap = (Math.abs(vLong) * cfg.mass) / (WHEEL_COUNT * dt);
      const fDrive = driveForce * axle.driveShare * 0.5;
      const longBudget = axle.frictionSlip * surface.grip * load;
      const fLong = clamp(
        fDrive - Math.sign(vLong) * Math.min(resist, stopCap),
        -longBudget,
        longBudget,
      );

      // Latéral : courbe de glissement, réduite par ce que le longitudinal consomme du budget du pneu.
      const alpha = atanPositive(
        Math.abs(vLat) / Math.max(Math.abs(vLong), SLIP_MIN_SPEED),
      );
      const usage = longBudget > 0 ? Math.abs(fLong) / longBudget : 0;
      const ellipse = Math.max(
        cfg.tires.minLateralShare,
        Math.sqrt(Math.max(0, 1 - usage * usage)),
      );
      const axleGrip = locked
        ? cfg.brakes.handbrakeSideFriction
        : isFront
          ? 1
          : rearLiftGrip;
      const latMax =
        axle.sideFriction * surface.grip * load * ellipse * axleGrip;
      // À basse vitesse, le pneu ne doit pas renvoyer plus que la vitesse à annuler : c'est ce qui évite le tremblement.
      const leverSquared = axle.z * axle.z;
      const effectiveMass = 1 / (1 / cfg.mass + leverSquared / yawInertia);
      const latStopCap = (Math.abs(vLat) * effectiveMass * 0.5) / dt;
      const fLat =
        -Math.sign(vLat) *
        Math.min(tireCurve(alpha, cfg.tires) * latMax, latStopCap);

      wheel.slip =
        clamp((alpha / cfg.tires.peakSlipAngle - 0.5) / 1.5, 0, 1) *
        clamp(length(velocity) / 3, 0, 1);
      wheel.spinAngle += locked ? 0 : (vLong / axle.wheelRadius) * dt;

      // Point d'application remonté vers le centre de gravité : garde le roulis lisible sans basculer la voiture.
      const toCom = dot(addScaled(com, contact, -1), up);
      impulses.push({
        force: scale(groundRight, fLat),
        at: addScaled(contact, up, toCom * (1 - cfg.tires.rollInfluence)),
      });
      impulses.push({
        force: scale(groundForward, fLong),
        at: addScaled(contact, up, toCom * (1 - cfg.tires.pitchInfluence)),
      });
    }

    for (const { force, at } of impulses)
      body.applyImpulseAtPoint(scale(force, dt), at, true);
  };

  const applyAssists = (up: Vec3, driftAngle: number, dt: number): void => {
    const { antiRoll, yawRateLimit, drag, driftStability, driftFreeAngle } =
      cfg.assists;
    const v = body.linvel();
    body.applyImpulse(scale(v, -drag * length(v) * dt), true);

    const w = body.angvel();
    if (yawRateLimit > 0) {
      const yawRate = dot(w, up);
      const excess = Math.abs(yawRate) - yawRateLimit;
      if (excess > 0)
        body.applyTorqueImpulse(
          scale(up, -Math.sign(yawRate) * excess * yawInertia * YAW_LIMIT_GAIN),
          true,
        );
    }
    // Au-delà de l'angle libre, ramène le nez vers la vitesse : la glisse reste une glisse, pas une toupie.
    const driftExcess = Math.abs(driftAngle) - driftFreeAngle;
    if (driftStability > 0 && driftExcess > 0) {
      const torque =
        -Math.sign(driftAngle) * driftStability * driftExcess * yawInertia * dt;
      body.applyTorqueImpulse(scale(up, torque), true);
    }
    if (antiRoll > 0) {
      // Axe de redressement : amène le haut de la voiture vers le haut du monde.
      const axis = { x: -up.z, y: 0, z: up.x };
      const sinTilt = up.y < 0 ? 1 : length(axis);
      const excess = sinTilt - ANTI_ROLL_FREE_TILT;
      if (excess > 0) {
        const torque = antiRoll * ANTI_ROLL_GAIN * excess * rollInertia * dt;
        body.applyTorqueImpulse(scale(normalized(axis), torque), true);
      }
    }
  };

  const step = (input: CarInput, dt: number): void => {
    settleImpact();
    impact = Math.max(0, impact - impact * IMPACT_DECAY * dt);
    throttle = clamp(input.throttle, 0, 1);
    brake = clamp(input.brake, 0, 1);
    handbrake = input.handbrake;
    // Simcade : pied levé, le train arrière décroche un peu pour que la voiture s'inscrive et glisse.
    const liftTarget =
      throttle === 0 && brake === 0 ? cfg.tires.liftOffRearGrip : 1;
    rearLiftGrip += clamp(
      liftTarget - rearLiftGrip,
      -LIFT_GRIP_RATE * dt,
      LIFT_GRIP_RATE * dt,
    );

    const rotation = body.rotation();
    const forward = rotate(rotation, { x: 0, y: 0, z: -1 });
    const right = rotate(rotation, { x: 1, y: 0, z: 0 });
    const up = rotate(rotation, { x: 0, y: 1, z: 0 });
    const v = body.linvel();
    const forwardSpeed = dot(v, forward);
    const lateralSpeed = dot(v, right);
    const driftAngle =
      forwardSpeed > 3 ? signedAngle(lateralSpeed, forwardSpeed) : 0;

    updateSteering(clamp(input.steer, -1, 1), forwardSpeed, driftAngle, dt);
    controller.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS);
    justReset = false;

    let grounded = false;
    for (let i = 0; i < WHEEL_COUNT; i++)
      grounded ||= controller.wheelIsInContact(i);
    const driveForce = updateTransmission(forwardSpeed, grounded, dt);
    applyTires(driveForce, up, forward, right, dt);
    applyAssists(up, driftAngle, dt);

    const after = body.linvel();
    velocityBeforeWorldStep = { x: after.x, y: after.y, z: after.z };
  };

  const state = (): CarState => {
    settleImpact();
    const position = body.translation();
    const rotation = body.rotation();
    const linearVelocity = body.linvel();
    const forward = rotate(rotation, { x: 0, y: 0, z: -1 });
    return {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      linearVelocity: {
        x: linearVelocity.x,
        y: linearVelocity.y,
        z: linearVelocity.z,
      },
      speed: length(linearVelocity),
      forwardSpeed: dot(linearVelocity, forward),
      rpm,
      gear,
      throttle,
      brake,
      handbrake,
      impact,
      wheels: wheels.map((wheel, i) => {
        const axle = wheelAxle(cfg, i);
        const suspension =
          controller.wheelSuspensionLength(i) ?? axle.suspensionRestLength;
        const offsetY = justReset
          ? cfg.ride.sag
          : axle.suspensionRestLength - suspension;
        return {
          steerAngle: i < 2 ? steerAngle : 0,
          spinAngle: wheel.spinAngle,
          offsetY,
          compression: clamp(offsetY / axle.suspensionTravel, 0, 1),
          inContact: controller.wheelIsInContact(i),
          surface: wheel.surface,
          slip: wheel.slip,
        };
      }),
    };
  };

  apply(cfg);

  return {
    step,
    state,
    respawn: reset,
    applyConfig: apply,
    free: () => {
      world.removeVehicleController(controller);
      world.removeRigidBody(body);
    },
  };
};
