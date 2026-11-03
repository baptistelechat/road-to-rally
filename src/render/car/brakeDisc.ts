// Chauffe des disques de frein, purement visuelle : la physique n'en sait rien.
const HEATING = 0.5;
const COOLING = 0.18;
/** Vitesse à laquelle un freinage à fond chauffe au rythme nominal, en m/s */
const REFERENCE_SPEED = 30;
const NEUTRAL_SHARE = 0.5;
const GLOW_START = 0.25;
const GLOW_MAX = 1.6;

/** Chauffe de 0 à 1 après `dt` secondes. */
export const stepDiscHeat = (
  heat: number,
  brake: number,
  speed: number,
  brakeShare: number,
  dt: number,
): number => {
  const power =
    HEATING * brake * (speed / REFERENCE_SPEED) * (brakeShare / NEUTRAL_SHARE);
  return Math.min(1, (heat + power * dt) * Math.exp(-COOLING * dt));
};

/** Intensité lumineuse du disque : éteint à froid, rouge orangé une fois bien chaud. */
export const discGlow = (heat: number): number => {
  const t = Math.max(0, (heat - GLOW_START) / (1 - GLOW_START));
  return GLOW_MAX * t * t;
};
