export const FIXED_DT = 1 / 60;
// Au-delà, on abandonne le retard plutôt que de geler le navigateur (retour d'un onglet en arrière-plan).
const MAX_STEPS_PER_FRAME = 5;

export interface FixedStepper {
  /** Fait avancer le temps et renvoie la fraction d'interpolation entre les deux derniers pas, de 0 à 1. */
  advance: (frameDt: number, step: () => void) => number;
}

export const createFixedStepper = (
  dt: number = FIXED_DT,
  maxSteps: number = MAX_STEPS_PER_FRAME,
): FixedStepper => {
  let accumulator = 0;
  return {
    advance: (frameDt, step) => {
      accumulator += frameDt;
      let steps = 0;
      while (accumulator >= dt && steps < maxSteps) {
        step();
        accumulator -= dt;
        steps++;
      }
      if (accumulator >= dt) accumulator = 0;
      return accumulator / dt;
    },
  };
};
