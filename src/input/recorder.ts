import type { CarInput } from "../sim/types";

const RUN_SIZE = 5;
const HANDBRAKE_FLAG = 1;
const RESPAWN_FLAG = 2;

/**
 * Plages d'entrées identiques : steer, throttle, brake, drapeaux (frein à main, remise en piste), répétitions.
 * Valeurs en double complets et non en Float32, sinon le rejeu ne serait plus exact au bit près.
 * Sérialisable tel quel en JSON pour le fantôme.
 */
export interface InputFrames {
  runs: readonly number[];
  /** Nombre total de pas enregistrés */
  count: number;
}

export interface InputRecorder {
  record: (input: Readonly<CarInput>) => void;
  frames: () => InputFrames;
}

export interface InputReplay {
  /** Entrée du pas suivant, `null` une fois l'enregistrement épuisé */
  next: () => CarInput | null;
}

export const createInputRecorder = (): InputRecorder => {
  const runs: number[] = [];
  let count = 0;

  return {
    record: (input) => {
      const flag =
        (input.handbrake ? HANDBRAKE_FLAG : 0) +
        (input.respawn ? RESPAWN_FLAG : 0);
      const last = runs.length - RUN_SIZE;
      count++;
      // Object.is et non === : distingue 0 de -0, le rejeu doit rendre les mêmes bits.
      if (
        last >= 0 &&
        Object.is(runs[last], input.steer) &&
        Object.is(runs[last + 1], input.throttle) &&
        Object.is(runs[last + 2], input.brake) &&
        runs[last + 3] === flag
      ) {
        runs[last + 4]++;
        return;
      }
      runs.push(input.steer, input.throttle, input.brake, flag, 1);
    },
    frames: () => ({ runs: runs.slice(), count }),
  };
};

export const replayInputs = ({ runs }: InputFrames): InputReplay => {
  let offset = 0;
  let used = 0;

  return {
    next: () => {
      if (offset >= runs.length) return null;
      const input: CarInput = {
        steer: runs[offset],
        throttle: runs[offset + 1],
        brake: runs[offset + 2],
        handbrake: (runs[offset + 3] & HANDBRAKE_FLAG) !== 0,
      };
      if (runs[offset + 3] & RESPAWN_FLAG) input.respawn = true;
      used++;
      if (used === runs[offset + 4]) {
        offset += RUN_SIZE;
        used = 0;
      }
      return input;
    },
  };
};
