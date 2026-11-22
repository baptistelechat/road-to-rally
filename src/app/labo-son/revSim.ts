// Régime simulé pour le labo son : assez crédible pour l'oreille, sans lien avec la physique du jeu.
import { carConfig } from "@/sim/carConfig";
import { createRevState as createFreeRev, stepRev, type RevState } from "@/audio/revModel";

export { stepRev, type RevState };

const { upshiftRpm } = carConfig.engine;

export const MANUAL_GEAR = 2;

export const createRevState = (): RevState => createFreeRev(MANUAL_GEAR);

/** Une étape dure `seconds`, ou jusqu'à atteindre le régime de passage de rapport. */
type DemoStep = { throttle: number; gear: number; seconds?: number };

const CUT_S = 0.09;
const DEMO_STEPS: readonly DemoStep[] = [
  { throttle: 0, gear: 0, seconds: 1.2 },
  { throttle: 1, gear: 0, seconds: 0.2 },
  { throttle: 0, gear: 0, seconds: 0.8 },
  { throttle: 1, gear: 0, seconds: 0.3 },
  { throttle: 0, gear: 0, seconds: 1 },
  { throttle: 1, gear: 1 },
  { throttle: 0, gear: 2, seconds: CUT_S },
  { throttle: 1, gear: 2 },
  { throttle: 0, gear: 3, seconds: CUT_S },
  { throttle: 1, gear: 3 },
  { throttle: 0, gear: 4, seconds: CUT_S },
  { throttle: 1, gear: 4 },
  { throttle: 0, gear: 4, seconds: 2 },
  { throttle: 0.8, gear: 3, seconds: 0.14 },
  { throttle: 0, gear: 3, seconds: 1.5 },
  { throttle: 0.8, gear: 2, seconds: 0.14 },
  { throttle: 0, gear: 2, seconds: 1.6 },
  { throttle: 0, gear: 0, seconds: 1 },
];

export interface Demo {
  /** Renvoie `false` quand la démo est finie */
  step: (state: RevState, dt: number) => boolean;
}

export const createDemo = (): Demo => {
  let index = 0;
  let elapsed = 0;
  return {
    step: (state, dt) => {
      const current = DEMO_STEPS[index];
      if (!current) return false;
      stepRev(state, current.throttle, current.gear, dt);
      elapsed += dt;
      const finished =
        current.seconds === undefined
          ? state.rpm >= upshiftRpm
          : elapsed >= current.seconds;
      if (finished) {
        index++;
        elapsed = 0;
      }
      return index < DEMO_STEPS.length;
    },
  };
};
