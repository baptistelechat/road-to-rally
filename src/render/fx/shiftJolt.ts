// À-coup du passage de rapport, partagé par la caisse et la caméra. Fonction du temps écoulé, indépendante de la cadence.
const FREQUENCY = 20;
const DECAY = 7;
const DOWNSHIFT_STRENGTH = 0.6;

export interface ShiftJolt {
  /** Valeur courante, positive = l'avant plonge. Environ -1 à 1. */
  update: (gear: number, dt: number) => number;
  /** Recale le rapport sans à-coup, par exemple après une remise en piste */
  reset: (gear: number) => void;
}

export const createShiftJolt = (): ShiftJolt => {
  let lastGear: number | null = null;
  let age = Number.POSITIVE_INFINITY;
  let strength = 0;

  return {
    update: (gear, dt) => {
      // La marche arrière ne compte pas : elle ne se passe qu'à l'arrêt.
      if (lastGear !== null && lastGear > 0 && gear > 0 && gear !== lastGear) {
        age = 0;
        strength = gear > lastGear ? 1 : DOWNSHIFT_STRENGTH;
      } else {
        age += dt;
      }
      lastGear = gear;
      if (age === Number.POSITIVE_INFINITY) return 0;
      // Le couple coupé fait plonger l'avant, le couple revenu le relève.
      return strength * Math.exp(-DECAY * age) * Math.sin(FREQUENCY * age);
    },
    reset: (gear) => {
      lastGear = gear;
      age = Number.POSITIVE_INFINITY;
    },
  };
};
