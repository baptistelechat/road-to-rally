// Régime libre, sans lien avec la physique du jeu : assez crédible pour l'oreille.
// Sert au labo son et au décompte, où la voiture ne bouge pas mais le moteur doit monter sous les gaz.
import { carConfig } from "@/sim/carConfig";

const { idleRpm, redlineRpm, gears } = carConfig.engine;

/** Rapport 0 = point mort : le moteur monte et descend sans inertie de la voiture. */
const RISE_RPM_PER_S = [11000, 3200, 2400, 1700, 1300, 1000];
const FALL_RPM_PER_S = [4500, 1900, 1500, 1200, 950, 800];
const LIMITER_CUT_S = 0.06;
export const NEUTRAL_GEAR = 0;

export interface RevState {
  rpm: number;
  gear: number;
  /** Charge réellement appliquée, coupée par le rupteur */
  throttle: number;
  limiterS: number;
}

export const createRevState = (gear: number = NEUTRAL_GEAR): RevState => ({
  rpm: idleRpm,
  gear,
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
