// Logique pure de la caméra : aucun React, aucun accès à la simulation, utilisable sans navigateur.
// Le lissage est exponentiel et dépend du temps écoulé, jamais d'un facteur fixe par image.
import { Euler, Quaternion, Vector3 } from "three";
import { createShiftJolt } from "@/render/fx/shiftJolt";
import type { CarState, Pose, Track, Vec3 } from "@/sim/types";

export type CameraMode = "chase" | "hood";

export interface RigInput {
  pose: Pose;
  velocity: Vec3;
  /** Vitesse projetée sur l'avant de la voiture, négative en marche arrière */
  forwardSpeed: number;
  /** Part des roues au sol qui sont sur l'herbe, 0 à 1 */
  grass: number;
  impact: number;
  /** Rapport engagé : son changement donne un à-coup. Constant = aucun à-coup. */
  gear: number;
  /** Rotation demandée autour de la voiture, -1 à 1, en poursuite seulement */
  orbit: number;
}

export interface RigOutput {
  position: Vector3;
  quaternion: Quaternion;
  fov: number;
  /** Cap lissé en radians (sans vibration), 0 = regarde vers -Z */
  yaw: number;
}

export interface CameraRig {
  output: RigOutput;
  update: (input: RigInput, dt: number, mode: CameraMode) => void;
  /** Se place directement sur la cible, sans balayage */
  snap: (input: RigInput, mode: CameraMode) => void;
}

export const RIG_TUNING = {
  /** En dessous de `followSpeedLow`, seul l'avant de la caisse compte : le vecteur vitesse n'y est que du bruit */
  followSpeedLow: 2,
  followSpeedHigh: 6,
  /** Part du vecteur vitesse dans le cap de poursuite, le reste vient de l'avant de la caisse */
  velocityFollow: 0.8,
  /** Rapport vitesse avant / vitesse sous lequel on revient vers la caisse (voiture en travers ou qui recule) */
  alignmentFull: 0.35,
  headingLambda: 5,
  /** Angle atteint stick à fond : un demi-tour, pour voir la voiture de face */
  orbitRange: Math.PI,
  orbitLambda: 6,
  heightLambda: 7,
  distanceLambda: 2.5,
  fovLambda: 3,
  chaseDistance: 7,
  chaseDistancePerSpeed: 0.03,
  chaseHeight: 2.25,
  /** Hauteur minimale de la caméra de poursuite au-dessus du sol */
  groundClearance: 1,
  /** Vitesse à laquelle la caméra redescend une fois le relief passé */
  groundLiftLambda: 4,
  lookAhead: 4,
  lookHeight: 0.9,
  chaseFov: 60,
  hoodFov: 72,
  fovBoost: 14,
  fovSpeedLow: 8,
  fovSpeedHigh: 60,
  /** Position de la vue capot dans le repère voiture */
  hoodOffset: { x: 0, y: 0.58, z: -0.55 },
  /** Part du tangage et du roulis de la caisse transmise à la vue capot */
  hoodAttitude: 0.3,
  hoodAttitudeLambda: 10,
  shakeLambda: 6,
  shakeHighSpeed: 0.0014,
  shakeGrass: 0.0028,
  shakeImpact: 0.007,
  impactDecay: 7,
  hoodShakeScale: 0.6,
  /** Plongée de la caméra au passage de rapport, en radians */
  shiftPitch: 0.008,
} as const;

export const damp = (
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number => target + (current - target) * Math.exp(-lambda * dt);

const shortestArc = (from: number, to: number): number => {
  const delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) return delta - Math.PI * 2;
  if (delta < -Math.PI) return delta + Math.PI * 2;
  return delta;
};

export const dampAngle = (
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number => damp(current, current + shortestArc(current, target), lambda, dt);

export const smoothstep = (
  low: number,
  high: number,
  value: number,
): number => {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

/**
 * Poids du vecteur vitesse dans le cap, 0 à 1.
 * Nul à faible vitesse et dès que la voiture recule, ce qui évite tout retournement.
 */
export const velocityWeight = (
  horizontalSpeed: number,
  forwardSpeed: number,
): number => {
  if (horizontalSpeed <= 0 || forwardSpeed <= 0) return 0;
  const { followSpeedLow, followSpeedHigh, alignmentFull } = RIG_TUNING;
  return (
    smoothstep(followSpeedLow, followSpeedHigh, horizontalSpeed) *
    smoothstep(0, alignmentFull, forwardSpeed / horizontalSpeed)
  );
};

/** Remplit `out` depuis l'état de voiture, sans allocation. */
export const fillRigInput = (
  out: RigInput,
  pose: Pose,
  state: CarState,
): void => {
  let contacts = 0;
  let grass = 0;
  for (const wheel of state.wheels) {
    if (!wheel.inContact) continue;
    contacts++;
    if (wheel.surface === "grass") grass++;
  }
  out.pose = pose;
  out.velocity = state.linearVelocity;
  out.forwardSpeed = state.forwardSpeed;
  out.grass = contacts > 0 ? grass / contacts : 0;
  out.impact = state.impact;
  out.gear = state.gear;
};

/** `groundAt` absent ou qui renvoie `null` : la caméra ignore le relief. */
export const createCameraRig = (
  groundAt: Track["groundAt"] = () => null,
): CameraRig => {
  const tuning = RIG_TUNING;
  const output: RigOutput = {
    position: new Vector3(),
    quaternion: new Quaternion(),
    fov: tuning.chaseFov,
    yaw: 0,
  };
  const carRotation = new Quaternion();
  const forward = new Vector3();
  const right = new Vector3();
  const offset = new Vector3();
  const euler = new Euler(0, 0, 0, "YXZ");

  let time = 0;
  let yaw = 0;
  let orbit = 0;
  let height = 0;
  let groundLift = 0;
  let distance: number = tuning.chaseDistance;
  let hoodPitch = 0;
  let hoodRoll = 0;
  let shake = 0;
  let kick = 0;
  let lastImpact = 0;
  const shiftJolt = createShiftJolt();

  const step = (
    input: RigInput,
    dt: number,
    mode: CameraMode,
    instant: boolean,
  ): void => {
    // `Infinity` annule le terme exponentiel : chaque valeur lissée tombe sur sa cible.
    const h = instant ? Number.POSITIVE_INFINITY : dt;
    if (!instant) time += dt;

    const { position, rotation } = input.pose;
    carRotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
    forward.set(0, 0, -1).applyQuaternion(carRotation);
    right.set(1, 0, 0).applyQuaternion(carRotation);

    const flat = Math.hypot(forward.x, forward.z);
    // Caisse à la verticale : l'avant ne donne plus de cap exploitable, on garde le précédent.
    const bodyX = flat > 0.05 ? forward.x / flat : -Math.sin(yaw);
    const bodyZ = flat > 0.05 ? forward.z / flat : -Math.cos(yaw);
    const bodyYaw = Math.atan2(-bodyX, -bodyZ);
    const horizontalSpeed = Math.hypot(input.velocity.x, input.velocity.z);

    let pitch = 0;
    let roll = 0;
    if (mode === "chase") {
      const weight =
        velocityWeight(horizontalSpeed, input.forwardSpeed) *
        tuning.velocityFollow;
      const velX = weight > 0 ? input.velocity.x / horizontalSpeed : 0;
      const velZ = weight > 0 ? input.velocity.z / horizontalSpeed : 0;
      const targetYaw = Math.atan2(
        -(bodyX * (1 - weight) + velX * weight),
        -(bodyZ * (1 - weight) + velZ * weight),
      );
      yaw = dampAngle(yaw, targetYaw, tuning.headingLambda, h);
      orbit = damp(
        orbit,
        input.orbit * tuning.orbitRange,
        tuning.orbitLambda,
        h,
      );
      height = damp(height, position.y, tuning.heightLambda, h);
      distance = damp(
        distance,
        tuning.chaseDistance + tuning.chaseDistancePerSpeed * horizontalSpeed,
        tuning.distanceLambda,
        h,
      );
      // La voiture reste liée à la caméra en X et Z : aucun retard de position, donc aucune saccade.
      const sin = Math.sin(yaw + orbit);
      const cos = Math.cos(yaw + orbit);
      const x = position.x + sin * distance;
      const y = height + tuning.chaseHeight;
      const z = position.z + cos * distance;
      // Le relief pousse la caméra vers le haut sans délai, elle redescend ensuite en douceur.
      const ground = groundAt(x, z);
      const lift =
        ground === null ? 0 : Math.max(0, ground + tuning.groundClearance - y);
      groundLift = Math.max(
        lift,
        damp(groundLift, lift, tuning.groundLiftLambda, h),
      );
      output.position.set(x, y + groundLift, z);
      pitch = Math.atan2(
        tuning.lookHeight - tuning.chaseHeight - groundLift,
        distance + tuning.lookAhead,
      );
    } else {
      yaw = bodyYaw;
      orbit = 0;
      height = position.y;
      const bodyPitch = Math.asin(Math.min(1, Math.max(-1, forward.y)));
      const cosPitch = Math.max(0.05, Math.cos(bodyPitch));
      const bodyRoll = Math.asin(Math.min(1, Math.max(-1, right.y / cosPitch)));
      const { hoodAttitude, hoodAttitudeLambda, hoodOffset } = tuning;
      hoodPitch = damp(
        hoodPitch,
        bodyPitch * hoodAttitude,
        hoodAttitudeLambda,
        h,
      );
      hoodRoll = damp(hoodRoll, bodyRoll * hoodAttitude, hoodAttitudeLambda, h);
      pitch = hoodPitch;
      roll = hoodRoll;
      euler.set(pitch, yaw, roll);
      output.quaternion.setFromEuler(euler);
      offset
        .set(hoodOffset.x, hoodOffset.y, hoodOffset.z)
        .applyQuaternion(output.quaternion);
      output.position.set(position.x, position.y, position.z).add(offset);
    }

    const baseFov = mode === "chase" ? tuning.chaseFov : tuning.hoodFov;
    output.fov = damp(
      output.fov,
      baseFov +
        tuning.fovBoost *
          smoothstep(tuning.fovSpeedLow, tuning.fovSpeedHigh, horizontalSpeed),
      tuning.fovLambda,
      h,
    );
    output.yaw = yaw;

    // Vibration en fonction du temps écoulé, indépendante de la cadence.
    if (input.impact > lastImpact + 0.02) kick = Math.max(kick, input.impact);
    lastImpact = input.impact;
    kick = instant ? 0 : damp(kick, 0, tuning.impactDecay, h);
    shake = damp(
      shake,
      instant
        ? 0
        : tuning.shakeHighSpeed * smoothstep(45, 70, horizontalSpeed) +
            tuning.shakeGrass *
              input.grass *
              smoothstep(3, 25, horizontalSpeed),
      tuning.shakeLambda,
      h,
    );
    const scale = mode === "chase" ? 1 : tuning.hoodShakeScale;
    const amplitude = (shake + kick * tuning.shakeImpact) * scale;
    if (instant) shiftJolt.reset(input.gear);
    const nod = instant ? 0 : shiftJolt.update(input.gear, dt);
    euler.set(
      pitch -
        nod * tuning.shiftPitch * scale +
        amplitude * (Math.sin(time * 37) + 0.5 * Math.sin(time * 61)),
      yaw + orbit + amplitude * 0.7 * Math.sin(time * 43 + 1),
      roll + amplitude * 0.5 * Math.sin(time * 29 + 2),
    );
    output.quaternion.setFromEuler(euler);
  };

  return {
    output,
    update: (input, dt, mode) => step(input, dt, mode, false),
    snap: (input, mode) => step(input, 0, mode, true),
  };
};
