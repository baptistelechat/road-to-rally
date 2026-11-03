// Régime simulé pour le labo son : assez crédible pour l'oreille, sans lien avec la physique du jeu.
import { carConfig } from "@/sim/carConfig";

const { idleRpm, redlineRpm, upshiftRpm, gears } = carConfig.engine;

/** Rapport 0 = point mort : le moteur monte et descend sans inertie de la voiture. */
const RISE_RPM_PER_S = [11000, 3200, 2400, 1700, 1300, 1000];
const FALL_RPM_PER_S = [4500, 1900, 1500, 1200, 950, 800];
const LIMITER_CUT_S = 0.06;
export const MANUAL_GEAR = 2;

export interface RevState {
  rpm: number;
  gear: number;
  /** Charge réellement appliquée, coupée par le rupteur */
  throttle: number;
  limiterS: number;
}

export const createRevState = (): RevState => ({
  rpm: idleRpm,
  gear: MANUAL_GEAR,
  throttle: 0,
  limiterS: 0,
});

/** Le régime suit le rapport de boîte quand on change de vitesse en prise. */
const shiftTo = (state: RevState, gear: number): void => {
  if (gear === state.gear) return;
  if (gear > 0 && state.gear > 0)
    state.rpm = Math.min(
      redlineRpm,
      Math.max(idleRpm, (state.rpm * gears[gear - 1]) / gears[state.gear - 1]),
    );
  state.gear = gear;
};

export const stepRev = (
  state: RevState,
  throttle: number,
  gear: number,
  dt: number,
): void => {
  shiftTo(state, gear);
  state.limiterS = Math.max(0, state.limiterS - dt);
  if (state.rpm >= redlineRpm) state.limiterS = LIMITER_CUT_S;
  state.throttle = state.limiterS > 0 ? 0 : throttle;
  const rise = RISE_RPM_PER_S[state.gear] * state.throttle;
  const fall = FALL_RPM_PER_S[state.gear] * (1 - state.throttle);
  state.rpm = Math.min(
    redlineRpm,
    Math.max(idleRpm, state.rpm + (rise - fall) * dt),
  );
};

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
