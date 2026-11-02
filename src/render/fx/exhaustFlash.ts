// Calendrier des flammes : aucune dépendance au rendu ni au son, vérifiable sans navigateur.
const MAX_FLASHES = 8;
const LIFE_S = 0.14;
const DECAY_S = 0.035;

export interface ExhaustFlash {
  /** Programme une flamme dans `delayS` secondes */
  trigger: (delayS: number, strength: number) => void;
  /** Avance le temps et renvoie l'intensité courante. `onStart` est appelé quand une flamme part. */
  update: (dt: number, onStart: (strength: number) => void) => number;
}

export const createExhaustFlash = (): ExhaustFlash => {
  const ages = new Float32Array(MAX_FLASHES).fill(LIFE_S);
  const strengths = new Float32Array(MAX_FLASHES);
  let cursor = 0;

  return {
    trigger: (delayS, strength) => {
      // Toujours négatif : même une flamme immédiate passe par `onStart`.
      ages[cursor] = -Math.max(delayS, 0.001);
      strengths[cursor] = strength;
      cursor = (cursor + 1) % MAX_FLASHES;
    },
    update: (dt, onStart) => {
      let peak = 0;
      for (let i = 0; i < MAX_FLASHES; i++) {
        if (ages[i] >= LIFE_S) continue;
        const waiting = ages[i] < 0;
        ages[i] += dt;
        if (ages[i] < 0) continue;
        if (waiting) onStart(strengths[i]);
        if (ages[i] < LIFE_S)
          peak = Math.max(peak, strengths[i] * Math.exp(-ages[i] / DECAY_S));
      }
      return peak;
    },
  };
};
