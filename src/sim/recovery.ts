import { FIXED_DT } from "./fixedStep";
import { SHOULDER_WIDTH } from "./track/ribbon";
import type { Quat, Track, Vec3 } from "./types";

// Remise en piste : maintenue pour coûter du temps, automatique si on coupe ou si on roule à contresens.
export const RESPAWN_HOLD_S = 3;
const OFFROAD_LIMIT_S = 3;
const WRONG_WAY_GRACE_S = 2;
const WRONG_WAY_COUNTDOWN_S = 3;
/** En dessous, la voiture manœuvre : pas de contresens. */
const WRONG_WAY_MIN_SPEED = 2;

export interface RecoveryStatus {
  kind: "hold" | "offroad" | "wrongway";
  /** Secondes restantes avant la remise en piste */
  remaining: number;
}

export interface RecoveryInput {
  held: boolean;
  position: Vec3;
  rotation: Quat;
  velocity: Vec3;
}

export interface Recovery {
  /** À appeler à chaque pas. Renvoie `true` quand la voiture doit être remise en piste. */
  update: (input: RecoveryInput) => boolean;
  status: () => RecoveryStatus | null;
  reset: () => void;
}

/** Roule vers l'arrière de la route en regardant vers l'arrière. Reculer pour se dégager n'en fait pas partie. */
export const isWrongWay = (
  rotation: Quat,
  velocity: Vec3,
  tangent: Vec3,
): boolean => {
  const { x, y, z, w } = rotation;
  // Avant local = -Z, projeté sur le plan horizontal.
  const forwardX = -2 * (x * z + w * y);
  const forwardZ = -(1 - 2 * (x * x + y * y));
  return (
    forwardX * tangent.x + forwardZ * tangent.z < 0 &&
    velocity.x * tangent.x + velocity.z * tangent.z < -WRONG_WAY_MIN_SPEED
  );
};

export const createRecovery = (
  track: Pick<Track, "nearest" | "width">,
): Recovery => {
  const holdSteps = Math.round(RESPAWN_HOLD_S / FIXED_DT);
  const offroadSteps = Math.round(OFFROAD_LIMIT_S / FIXED_DT);
  const wrongWayGrace = Math.round(WRONG_WAY_GRACE_S / FIXED_DT);
  const wrongWaySteps = Math.round(WRONG_WAY_COUNTDOWN_S / FIXED_DT);
  let hold = 0;
  // Se vide au même rythme sur la route : enchaîner les coupes courtes finit par coûter.
  let offroad = 0;
  let isOff = false;
  let wrongWay = 0;
  // Après une remise en piste, il faut relâcher avant d'en demander une autre.
  let awaitingRelease = false;

  const clear = (): void => {
    hold = 0;
    offroad = 0;
    isOff = false;
    wrongWay = 0;
  };

  return {
    update: ({ held, position, rotation, velocity }) => {
      if (!held) awaitingRelease = false;
      hold = held && !awaitingRelease ? hold + 1 : 0;

      const { distance, tangent } = track.nearest(position.x, position.z);
      isOff = distance > track.width / 2 + SHOULDER_WIDTH;
      offroad = isOff ? offroad + 1 : Math.max(0, offroad - 1);
      wrongWay = isWrongWay(rotation, velocity, tangent) ? wrongWay + 1 : 0;

      if (
        hold < holdSteps &&
        offroad < offroadSteps &&
        wrongWay < wrongWayGrace + wrongWaySteps
      )
        return false;
      clear();
      awaitingRelease = held;
      return true;
    },
    status: () => {
      if (hold > 0)
        return { kind: "hold", remaining: (holdSteps - hold) * FIXED_DT };
      if (wrongWay > wrongWayGrace)
        return {
          kind: "wrongway",
          remaining: (wrongWayGrace + wrongWaySteps - wrongWay) * FIXED_DT,
        };
      if (isOff)
        return {
          kind: "offroad",
          remaining: (offroadSteps - offroad) * FIXED_DT,
        };
      return null;
    },
    reset: clear,
  };
};
