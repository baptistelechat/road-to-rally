// Régime montré au joueur autour du départ, compteur et son confondus (PR-17, B-11). La simulation n'en sait rien :
// elle retient la voiture pendant le décompte et repart du ralenti au GO, ce qui ne se voit ni ne s'entend ici.
import { createRevState, NEUTRAL_GEAR, stepRev } from "@/audio/revModel";
import type { CarState } from "@/sim/types";

/** Au GO, le régime libre rejoint celui de la simulation comme un embrayage qu'on relâche, en secondes */
const CLUTCH_RELEASE_S = 0.35;
/** En dessous de cet écart, la simulation reprend la main, en tr/min */
const HANDOFF_RPM = 50;

export interface ShownRev {
  rpm: number;
  throttle: number;
}

export interface StartRev {
  /**
   * @param counting le décompte tourne et la course est à l'écran
   * @param pedal pédale du joueur, que la simulation ignore pendant le décompte
   * @param dt 0 quand le jeu est en pause
   * @returns `null` quand le régime de la simulation suffit
   */
  update: (
    state: CarState,
    counting: boolean,
    pedal: number,
    dt: number,
  ) => ShownRev | null;
}

export const createStartRev = (): StartRev => {
  const free = createRevState();
  let active = false;
  return {
    update: (state, counting, pedal, dt) => {
      if (counting) {
        if (!active) free.rpm = state.rpm;
        active = true;
        stepRev(free, pedal, NEUTRAL_GEAR, dt);
        return { rpm: free.rpm, throttle: free.throttle };
      }
      if (!active) return null;
      free.rpm += (state.rpm - free.rpm) * Math.min(1, dt / CLUTCH_RELEASE_S);
      if (free.rpm - state.rpm <= HANDOFF_RPM) {
        active = false;
        return null;
      }
      return { rpm: free.rpm, throttle: state.throttle };
    },
  };
};
